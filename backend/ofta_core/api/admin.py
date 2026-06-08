# ofta_core/api/admin.py
"""
Admin API endpoints for OFTA content management.
These endpoints power the admin panel.
"""

import os
from fastapi import APIRouter, HTTPException, status, Depends, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import json
import uuid

from ofta_core.utils.util_db import get_db_connector


async def verify_admin_key(x_admin_key: Optional[str] = Header(None)):
    """Verify admin API key from X-Admin-Key header."""
    expected_key = os.getenv("ADMIN_API_KEY")
    if expected_key and x_admin_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin API key"
        )


router = APIRouter(dependencies=[Depends(verify_admin_key)])


# ────────────────────────────────────────────────
# Stats
# ────────────────────────────────────────────────

@router.get("/stats/persons")
async def stats_persons():
    db = get_db_connector()
    df = db.select_df("SELECT COUNT(*) as count FROM ofta_prod.ofta_person")
    return {"count": int(df.iloc[0]['count']) if not df.empty else 0}


@router.get("/stats/questions")
async def stats_questions():
    db = get_db_connector()
    df = db.select_df("SELECT COUNT(*) as count FROM ofta_prod.ofta_question_template")
    return {"count": int(df.iloc[0]['count']) if not df.empty else 0}


@router.get("/stats/users")
async def stats_users():
    db = get_db_connector()
    df = db.select_df("SELECT COUNT(*) as count FROM ofta_prod.ofta_user_account")
    return {"count": int(df.iloc[0]['count']) if not df.empty else 0}


@router.get("/stats/sessions")
async def stats_sessions():
    db = get_db_connector()
    df = db.select_df("SELECT COUNT(*) as count FROM ofta_prod.ofta_game_session")
    return {"count": int(df.iloc[0]['count']) if not df.empty else 0}


# ────────────────────────────────────────────────
# Celebrities CRUD
# ────────────────────────────────────────────────

class PersonCreateRequest(BaseModel):
    full_name: str
    date_of_birth: str
    star_sign: str
    primary_category: str
    nationality: Optional[str] = None
    gender: Optional[str] = None
    popularity_score: Optional[float] = 50.0
    hints_easy: Optional[list] = []
    hints_medium: Optional[list] = []
    hints_hard: Optional[list] = []


class PersonUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    full_name: Optional[str] = None
    popularity_score: Optional[float] = None


@router.get("/persons")
async def list_persons():
    db = get_db_connector()
    df = db.select_df("""
        SELECT id, full_name, date_of_birth, star_sign, primary_category,
               nationality, gender, popularity_score, is_active, created_at_tms
        FROM ofta_prod.ofta_person
        ORDER BY full_name
    """)

    persons = []
    for _, row in df.iterrows():
        persons.append({
            "id": str(row['id']),
            "full_name": row['full_name'],
            "date_of_birth": str(row['date_of_birth']),
            "star_sign": row['star_sign'],
            "primary_category": row['primary_category'],
            "nationality": row.get('nationality'),
            "gender": row.get('gender'),
            "popularity_score": float(row.get('popularity_score', 50)),
            "is_active": bool(row.get('is_active', True)),
            "created_at_tms": str(row.get('created_at_tms', '')),
        })

    return {"persons": persons}


@router.post("/persons")
async def create_person(request: PersonCreateRequest):
    db = get_db_connector()
    person_id = str(uuid.uuid4())

    db.execute_query(
        """
        INSERT INTO ofta_prod.ofta_person (
            id, full_name, date_of_birth, star_sign, primary_category,
            nationality, gender, popularity_score, hints_easy, hints_medium, hints_hard
        ) VALUES (
            :id, :full_name, :date_of_birth, :star_sign, :primary_category,
            :nationality, :gender, :popularity_score,
            :hints_easy::jsonb, :hints_medium::jsonb, :hints_hard::jsonb
        )
        """,
        params={
            "id": person_id,
            "full_name": request.full_name,
            "date_of_birth": request.date_of_birth,
            "star_sign": request.star_sign,
            "primary_category": request.primary_category,
            "nationality": request.nationality,
            "gender": request.gender,
            "popularity_score": request.popularity_score,
            "hints_easy": json.dumps(request.hints_easy or []),
            "hints_medium": json.dumps(request.hints_medium or []),
            "hints_hard": json.dumps(request.hints_hard or []),
        }
    )

    return {"id": person_id, "status": "created"}


@router.patch("/persons/{person_id}")
async def update_person(person_id: str, request: PersonUpdateRequest):
    db = get_db_connector()

    updates = []
    params = {"id": person_id}

    if request.is_active is not None:
        updates.append("is_active = :is_active")
        params["is_active"] = request.is_active

    if request.full_name is not None:
        updates.append("full_name = :full_name")
        params["full_name"] = request.full_name

    if request.popularity_score is not None:
        updates.append("popularity_score = :popularity_score")
        params["popularity_score"] = request.popularity_score

    if not updates:
        return {"status": "no changes"}

    updates.append("updated_at_tms = NOW()")
    set_clause = ", ".join(updates)

    db.execute_query(
        f"UPDATE ofta_prod.ofta_person SET {set_clause} WHERE id = :id",
        params=params
    )

    return {"status": "updated"}


# ────────────────────────────────────────────────
# Questions CRUD
# ────────────────────────────────────────────────

class QuestionUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    difficulty: Optional[int] = None


@router.get("/questions")
async def list_questions():
    db = get_db_connector()
    df = db.select_df("""
        SELECT 
            qt.id, qt.mode, qt.difficulty, qt.is_active,
            c.full_name as person_name,
            ca.full_name as person_a_name,
            cb.full_name as person_b_name
        FROM ofta_prod.ofta_question_template qt
        LEFT JOIN ofta_prod.ofta_person c ON qt.person_id = c.id
        LEFT JOIN ofta_prod.ofta_person ca ON qt.person_id_a = ca.id
        LEFT JOIN ofta_prod.ofta_person cb ON qt.person_id_b = cb.id
        ORDER BY qt.mode, qt.difficulty
    """)

    questions = []
    for _, row in df.iterrows():
        questions.append({
            "id": str(row['id']),
            "mode": row['mode'],
            "difficulty": int(row['difficulty']),
            "is_active": bool(row.get('is_active', True)),
            "person_name": row.get('person_name'),
            "person_a_name": row.get('person_a_name'),
            "person_b_name": row.get('person_b_name'),
        })

    return {"questions": questions}


@router.patch("/questions/{question_id}")
async def update_question(question_id: str, request: QuestionUpdateRequest):
    db = get_db_connector()

    updates = []
    params = {"id": question_id}

    if request.is_active is not None:
        updates.append("is_active = :is_active")
        params["is_active"] = request.is_active

    if request.difficulty is not None:
        updates.append("difficulty = :difficulty")
        params["difficulty"] = request.difficulty

    if not updates:
        return {"status": "no changes"}

    updates.append("updated_at_tms = NOW()")
    set_clause = ", ".join(updates)

    db.execute_query(
        f"UPDATE ofta_prod.ofta_question_template SET {set_clause} WHERE id = :id",
        params=params
    )

    return {"status": "updated"}


# ────────────────────────────────────────────────
# Users (Read-only)
# ────────────────────────────────────────────────

@router.get("/users")
async def list_users():
    db = get_db_connector()
    df = db.select_df("""
        SELECT id, display_name, email, auth_provider, is_banned,
               created_at_tms, last_active_at_tms
        FROM ofta_prod.ofta_user_account
        ORDER BY created_at_tms DESC
        LIMIT 200
    """)

    users = []
    for _, row in df.iterrows():
        users.append({
            "id": str(row['id']),
            "display_name": row.get('display_name'),
            "email": row.get('email'),
            "auth_provider": row.get('auth_provider', 'anonymous'),
            "is_banned": bool(row.get('is_banned', False)),
            "created_at_tms": str(row.get('created_at_tms', '')),
            "last_active_at_tms": str(row.get('last_active_at_tms', '')),
        })

    return {"users": users}


# ────────────────────────────────────────────────
# Config CRUD
# ────────────────────────────────────────────────

class ConfigRequest(BaseModel):
    key: str
    value: dict


@router.get("/config")
async def list_config():
    db = get_db_connector()
    df = db.select_df("SELECT key, value, updated_at_tms FROM ofta_prod.ofta_app_config ORDER BY key")

    configs = []
    for _, row in df.iterrows():
        configs.append({
            "key": row['key'],
            "value": row['value'],
            "updated_at_tms": str(row.get('updated_at_tms', '')),
        })

    return {"configs": configs}


@router.post("/config")
async def upsert_config(request: ConfigRequest):
    db = get_db_connector()

    db.execute_query(
        """
        INSERT INTO ofta_prod.ofta_app_config (key, value, updated_at_tms)
        VALUES (:key, :value::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE SET value = :value::jsonb, updated_at_tms = NOW()
        """,
        params={"key": request.key, "value": json.dumps(request.value)}
    )

    return {"status": "saved"}


# ────────────────────────────────────────────────
# Analytics
# ────────────────────────────────────────────────

@router.get("/analytics/sessions-per-day")
async def analytics_sessions_per_day():
    """Get sessions count per day for the last 7 days."""
    db = get_db_connector()
    df = db.select_df("""
        SELECT
            DATE(started_at_tms) as day,
            COUNT(*) as count
        FROM ofta_prod.ofta_game_session
        WHERE started_at_tms >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(started_at_tms)
        ORDER BY day DESC
    """)

    days = []
    for _, row in df.iterrows():
        days.append({
            "date": str(row['day']),
            "count": int(row['count'])
        })
    return {"days": days}


@router.get("/analytics/score-distribution")
async def analytics_score_distribution():
    """Get score distribution across all completed sessions."""
    db = get_db_connector()
    df = db.select_df("""
        SELECT
            CASE
                WHEN total_score < 100 THEN '0-99'
                WHEN total_score < 300 THEN '100-299'
                WHEN total_score < 500 THEN '300-499'
                WHEN total_score < 700 THEN '500-699'
                WHEN total_score < 900 THEN '700-899'
                ELSE '900+'
            END as bracket,
            COUNT(*) as count
        FROM ofta_prod.ofta_game_session
        WHERE ended_at_tms IS NOT NULL AND total_score IS NOT NULL
        GROUP BY bracket
        ORDER BY bracket
    """)

    buckets = []
    for _, row in df.iterrows():
        buckets.append({
            "bracket": row['bracket'],
            "count": int(row['count'])
        })
    return {"distribution": buckets}


@router.get("/analytics/active-users")
async def analytics_active_users():
    """Get active user counts for different time periods."""
    db = get_db_connector()

    dau = db.select_df(
        "SELECT COUNT(DISTINCT user_id) as cnt FROM ofta_prod.ofta_game_session WHERE started_at_tms >= NOW() - INTERVAL '1 day'"
    )
    wau = db.select_df(
        "SELECT COUNT(DISTINCT user_id) as cnt FROM ofta_prod.ofta_game_session WHERE started_at_tms >= NOW() - INTERVAL '7 days'"
    )
    mau = db.select_df(
        "SELECT COUNT(DISTINCT user_id) as cnt FROM ofta_prod.ofta_game_session WHERE started_at_tms >= NOW() - INTERVAL '30 days'"
    )

    return {
        "dau": int(dau.iloc[0]['cnt']) if not dau.empty else 0,
        "wau": int(wau.iloc[0]['cnt']) if not wau.empty else 0,
        "mau": int(mau.iloc[0]['cnt']) if not mau.empty else 0,
    }


# ────────────────────────────────────────────────
# Bulk Import
# ────────────────────────────────────────────────

@router.post("/persons/bulk-import")
async def bulk_import_persons(persons: List[PersonCreateRequest]):
    """Bulk import persons from a list."""
    db = get_db_connector()
    created = 0
    errors = []

    for celeb in persons:
        try:
            person_id = str(uuid.uuid4())
            db.execute_query(
                """
                INSERT INTO ofta_prod.ofta_person (
                    id, full_name, date_of_birth, star_sign, primary_category,
                    nationality, gender, popularity_score,
                    hints_easy, hints_medium, hints_hard
                ) VALUES (
                    :id, :full_name, :date_of_birth, :star_sign, :primary_category,
                    :nationality, :gender, :popularity_score,
                    :hints_easy::jsonb, :hints_medium::jsonb, :hints_hard::jsonb
                )
                """,
                params={
                    "id": person_id,
                    "full_name": celeb.full_name,
                    "date_of_birth": celeb.date_of_birth,
                    "star_sign": celeb.star_sign,
                    "primary_category": celeb.primary_category,
                    "nationality": celeb.nationality,
                    "gender": celeb.gender,
                    "popularity_score": celeb.popularity_score,
                    "hints_easy": json.dumps(celeb.hints_easy or []),
                    "hints_medium": json.dumps(celeb.hints_medium or []),
                    "hints_hard": json.dumps(celeb.hints_hard or []),
                }
            )
            created += 1
        except Exception as e:
            errors.append({"name": celeb.full_name, "error": str(e)})

    return {"created": created, "errors": errors}
