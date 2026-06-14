# ofta_core/utils/util_db.py
"""
Database connector for OFTA - adapted from TASC pattern
"""

from io import StringIO
import os
import json
import numpy as np
from dotenv import load_dotenv
import pandas as pd
from pandas import DataFrame
from sqlalchemy import create_engine, text, engine as sa_engine
from sqlalchemy.exc import SQLAlchemyError, OperationalError, InterfaceError
from psycopg2 import sql, extras
import logging
import atexit
import time

# Load environment variables
load_dotenv()

# Database credentials
ofta_db_username = os.getenv('TASC_DB_USERNAME') or os.getenv('OFTA_DB_USERNAME')
ofta_db_password = os.getenv('TASC_DB_PASSWORD') or os.getenv('OFTA_DB_PASSWORD')
ofta_db_host = os.getenv('TASC_DB_HOST') or os.getenv('OFTA_DB_HOST')
ofta_db_port = os.getenv('TASC_DB_PORT') or os.getenv('OFTA_DB_PORT')
ofta_db_name = os.getenv('TASC_DB_NAME') or os.getenv('OFTA_DB_NAME')

logger = logging.getLogger(__name__)

# Global connection instance for singleton pattern
_global_db_connector = None


def get_db_connector(force_new=False):
    """
    Singleton pattern to ensure only one database connector per process.
    
    Args:
        force_new (bool): Force creation of new connector (useful for testing)
    
    Returns:
        OftaDBConnector: Shared database connector instance
    """
    global _global_db_connector
    
    if _global_db_connector is None or force_new:
        _global_db_connector = OftaDBConnector()
        atexit.register(_cleanup_connections)
        logger.info("Created OftaDBConnector")
    
    return _global_db_connector


def _cleanup_connections():
    """Cleanup function to close all connections on exit"""
    global _global_db_connector
    if _global_db_connector:
        _global_db_connector.close_all_connections()


class OftaDBConnector:
    """Handles connections and operations for the OFTA database with optimized pooling."""
    
    def __init__(
        self,
        server_adapter: str = 'postgresql+psycopg2',
        host: str = ofta_db_host,
        database: str = ofta_db_name,
        port: int = ofta_db_port,
        username: str = '',
        password: str = '',
        ssl_mode: str = 'require',
        pool_size: int = 6,
        max_overflow: int = 2,
        pool_recycle: int = 60,
        pool_pre_ping: bool = True,
        pool_timeout: int = 60
    ) -> None:
        username = username or ofta_db_username
        password = password or ofta_db_password
        
        # Log connection attempt
        if os.getenv("K_SERVICE"):
            connection_name = os.getenv('DB_CONNECTION_NAME')
            logger.info(f"Initializing Cloud SQL connection to: {connection_name}")
        else:
            logger.info(f"Initializing TCP connection to: {host}:{port}")
        
        # Create connection string
        connection_string = self.get_connection_string(
            server_adapter, host, database, port, username, password, ssl_mode
        )
        
        # Create engine with proper pooling configuration
        self.engine = create_engine(
            connection_string,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_pre_ping=pool_pre_ping,
            pool_recycle=pool_recycle,
            pool_timeout=pool_timeout,
            echo=False,  # Set to True for SQL debugging
            connect_args={
                "keepalives_idle": "600",
                "keepalives_interval": "30",
                "keepalives_count": "3",
            } if not os.getenv("K_SERVICE") else {}
        )
        
        logger.info(f"Database engine created with pool_size={pool_size}, max_overflow={max_overflow}")
        self.confirm_connection()
    
    @staticmethod
    def get_connection_string(server_adapter, host, database, port: int, username='', password='', ssl_mode='require'):
        """Create a connection string with SSL enforced."""
        if os.getenv("K_SERVICE"):
            # Running on Cloud Run: use Unix socket
            logger.info("Detected Cloud Run environment, using Unix socket connection")
            connection_url = sa_engine.URL.create(
                drivername=server_adapter,
                username=username,
                password=password,
                host="",
                database=database,
                query={
                    'host': f"/cloudsql/{os.getenv('DB_CONNECTION_NAME')}",
                    'sslmode': ssl_mode
                }
            )
        else:
            # Running locally: use TCP connection
            logger.info("Using TCP connection for local development")
            connection_url = sa_engine.URL.create(
                drivername=server_adapter,
                username=username,
                password=password,
                host=host,
                port=port,
                database=database,
                query={'sslmode': ssl_mode}
            )
        return connection_url
    
    def confirm_connection(self):
        """Confirms that the connection to the database is successful."""
        try:
            with self.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
                logger.info("Database connection successful.")
        except SQLAlchemyError as e:
            logger.error(f"Database connection failed: {e}")
            raise
    
    def select_df(self, query: str, params: dict = None) -> DataFrame:
        """
        Executes a SELECT query and returns results as a Pandas DataFrame.
        
        Args:
            query (str): SQL SELECT query
            params (dict, optional): Query parameters
        
        Returns:
            DataFrame: Query result as a Pandas DataFrame
        """
        connection = None
        try:
            connection = self.engine.connect()
            if params:
                result = pd.read_sql_query(text(query), connection, params=params)
            else:
                result = pd.read_sql_query(text(query), connection)
            return result
        except SQLAlchemyError as e:
            logger.error(f"Query execution failed: {e}")
            return DataFrame()
        finally:
            if connection:
                connection.close()
    
    def execute_query(self, query: str, params: dict = None) -> None:
        """
        Executes an INSERT, UPDATE, or DELETE query.
        
        Args:
            query (str): SQL command
            params (dict, optional): Query parameters
        """
        try:
            with self.engine.begin() as connection:
                if params:
                    connection.execute(text(query), params)
                else:
                    connection.execute(text(query))
                logger.debug(f"Query executed successfully")
        except SQLAlchemyError as e:
            logger.error(f"Query execution failed: {e}")
            raise
    
    def insert_df(
        self,
        table_schema: str,
        table_name: str,
        df: pd.DataFrame,
        on_conflict_do_nothing: bool = False
    ) -> None:
        """
        Inserts a DataFrame into schema.table_name.
        
        Args:
            table_schema (str): Schema name
            table_name (str): Table name
            df (pd.DataFrame): DataFrame to insert
            on_conflict_do_nothing (bool): Use ON CONFLICT DO NOTHING
        """
        if df is None or df.empty:
            logger.info("Nothing to insert.")
            return
        
        # Verify table exists
        exists = self.select_df(f"""
            SELECT EXISTS(
              SELECT FROM information_schema.tables
              WHERE table_schema='{table_schema}' AND table_name='{table_name}'
            )
        """).iloc[0, 0]
        
        if not exists:
            raise Exception(f"Table {table_schema}.{table_name} not found")
        
        conn = self.engine.raw_connection()
        try:
            columns = list(df.columns)
            
            if on_conflict_do_nothing:
                cursor = conn.cursor()
                insert_stmt = sql.SQL("INSERT INTO {}.{} ({}) VALUES %s ON CONFLICT DO NOTHING").format(
                    sql.Identifier(table_schema),
                    sql.Identifier(table_name),
                    sql.SQL(', ').join(map(sql.Identifier, columns))
                )
                values = [tuple(row) for row in df.values]
                extras.execute_values(cursor, insert_stmt, values, page_size=1000)
                conn.commit()
                cursor.close()
                logger.info(f"Inserted {len(df)} rows with ON CONFLICT DO NOTHING")
            else:
                # Use COPY for bulk inserts
                buffer = StringIO()
                df.to_csv(buffer, index=False, header=False, na_rep='')
                buffer.seek(0)
                
                cursor = conn.cursor()
                copy_stmt = sql.SQL("COPY {}.{} ({}) FROM STDIN WITH CSV").format(
                    sql.Identifier(table_schema),
                    sql.Identifier(table_name),
                    sql.SQL(', ').join(map(sql.Identifier, columns))
                )
                cursor.copy_expert(copy_stmt, buffer)
                conn.commit()
                cursor.close()
                logger.info(f"Inserted {len(df)} rows with COPY")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error inserting DataFrame: {e}")
            raise
        finally:
            conn.close()
    
    def bulk_upsert_df(
        self,
        df: DataFrame,
        table_schema: str,
        table_name: str,
        conflict_columns: list[str],
        where_cols: list[str] | None = None,
    ) -> None:
        """
        Efficiently upsert a large DataFrame using COPY + temp table.
        
        Args:
            df: DataFrame to upsert
            table_schema: Schema name
            table_name: Table name
            conflict_columns: Columns to use for conflict detection
            where_cols: Optional WHERE clause columns for partial updates
        """
        start_time = time.time()
        
        if df is None or df.empty:
            logger.info("Nothing to bulk upsert.")
            return
        
        # Remove 'id' column if exists to avoid PK conflicts
        if 'id' in df.columns:
            df = df.drop(columns=['id'])
        
        # Verify conflict columns exist
        if not set(conflict_columns).issubset(df.columns):
            raise ValueError(f"Conflict columns {conflict_columns} must be in DataFrame columns")
        
        # Create unique temp table name
        import uuid
        temp_table_name = f"{table_name}_tmp_{uuid.uuid4().hex[:12]}"
        
        # Process DataFrame
        processed_df = self._process_df_for_db(df)
        
        conn = self.engine.raw_connection()
        cursor = None
        
        try:
            cursor = conn.cursor()
            
            # Create temporary table
            logger.info(f"Creating temporary table {table_schema}.{temp_table_name}")
            create_temp_table_sql = f"""
            CREATE TABLE {table_schema}.{temp_table_name} 
            (LIKE {table_schema}.{table_name} INCLUDING ALL)
            """
            cursor.execute(create_temp_table_sql)
            
            # COPY data to temp table
            logger.info(f"Using COPY to insert {len(processed_df)} rows into temporary table")
            columns = list(processed_df.columns)
            buffer = StringIO()
            processed_df.to_csv(buffer, index=False, header=False, na_rep='')
            buffer.seek(0)
            
            copy_stmt = sql.SQL("COPY {}.{} ({}) FROM STDIN WITH CSV").format(
                sql.Identifier(table_schema),
                sql.Identifier(temp_table_name),
                sql.SQL(', ').join(map(sql.Identifier, columns))
            )
            cursor.copy_expert(copy_stmt, buffer)
            
            # Perform upsert
            logger.info(f"Performing upsert from temporary table to {table_schema}.{table_name}")
            col_list = ", ".join(columns)
            conflict_spec = f"({', '.join(conflict_columns)})"
            update_set_cols = [c for c in columns if c not in conflict_columns]
            
            if update_set_cols:
                update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_set_cols)
                where_sql = ""
                if where_cols:
                    checks = [f"t.{c} IS DISTINCT FROM EXCLUDED.{c}" for c in where_cols]
                    where_sql = "WHERE " + " OR ".join(checks)
                
                upsert_sql = f"""
                INSERT INTO {table_schema}.{table_name} AS t ({col_list})
                SELECT {col_list} FROM {table_schema}.{temp_table_name}
                ON CONFLICT {conflict_spec}
                DO UPDATE SET {update_set}
                {where_sql}
                """
            else:
                upsert_sql = f"""
                INSERT INTO {table_schema}.{table_name} AS t ({col_list})
                SELECT {col_list} FROM {table_schema}.{temp_table_name}
                ON CONFLICT {conflict_spec}
                DO NOTHING
                """
            
            cursor.execute(upsert_sql)
            conn.commit()
            
            elapsed_time = time.time() - start_time
            rows_per_second = len(df) / elapsed_time if elapsed_time > 0 else float('inf')
            logger.info(f"Bulk upserted {len(df)} rows in {elapsed_time:.2f}s ({rows_per_second:.0f} rows/sec)")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error during bulk upsert: {e}")
            raise
        finally:
            if cursor:
                try:
                    cursor.execute(f"DROP TABLE IF EXISTS {table_schema}.{temp_table_name}")
                    conn.commit()
                except Exception as e:
                    logger.warning(f"Error dropping temporary table: {e}")
                finally:
                    cursor.close()
            conn.close()
    
    def _process_df_for_db(self, df: DataFrame) -> DataFrame:
        """Process DataFrame to ensure column types are compatible with PostgreSQL."""
        processed_df = df.copy()
        
        # Process JSON columns
        for col in processed_df.columns:
            if col.endswith('_detail') or col.endswith('_json'):
                processed_df[col] = processed_df[col].apply(
                    lambda x: x if pd.isna(x) else (
                        json.dumps(x.adapted) if hasattr(x, 'adapted') else 
                        json.dumps(x) if not isinstance(x, str) else x
                    )
                )
            # Format PostgreSQL arrays
            elif any(isinstance(val, (list, tuple, np.ndarray)) for val in processed_df[col].head(10) if val is not None):
                processed_df[col] = processed_df[col].apply(
                    lambda x: None if x is None else (
                        '{' + ','.join(f'"{str(item).replace(chr(34), chr(92)+chr(34))}"' for item in x) + '}'
                    )
                )
        
        # Convert NaN to None
        for col in processed_df.columns:
            if processed_df[col].dtype == 'object' or pd.api.types.is_float_dtype(processed_df[col]):
                processed_df[col] = processed_df[col].replace({np.nan: None})
        
        return processed_df
    
    def get_pool_status(self):
        """Returns current connection pool status for monitoring."""
        pool = self.engine.pool
        return {
            "size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "total_connections": pool.checkedout() + pool.checkedin()
        }
    
    def close_all_connections(self):
        """Closes all connections in the pool."""
        if hasattr(self, 'engine'):
            self.engine.dispose()
            logger.info("All database connections closed")
