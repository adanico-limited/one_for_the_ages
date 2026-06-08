"""
Seed ofta_prod.ofta_person with footballer data from CSV.

- Inserts players not already in the table (matched by full_name, case-insensitive)
- Updates image_url on existing rows where it is currently NULL and CSV has one
- Does NOT overwrite existing popularity_score or hints (manually curated)
"""

import csv
import psycopg2
import os
import sys

CSV_PATH = os.path.join(os.path.dirname(__file__), "footballers_top5_2526.csv")

DB = {
    "host":     os.getenv("OFTA_DB_HOST", "34.71.254.207"),
    "port":     int(os.getenv("OFTA_DB_PORT", 5432)),
    "dbname":   os.getenv("OFTA_DB_NAME", "tasc_db"),
    "user":     os.getenv("OFTA_DB_USERNAME", "postgres"),
    "password": os.getenv("OFTA_DB_PASSWORD", "tascoask"),
}

INSERT_SQL = """
INSERT INTO ofta_prod.ofta_person (
    full_name, date_of_birth, star_sign, primary_category, secondary_category,
    nationality, gender, popularity_score, image_url, image_license,
    hints_easy, hints_medium, hints_hard, aliases,
    attr_desc_1, attr_value_1,
    attr_desc_2, attr_value_2,
    is_active
)
SELECT
    %(full_name)s, %(date_of_birth)s, %(star_sign)s,
    'Footballer', %(secondary_category)s,
    %(nationality)s, 'Male', 50.0,
    %(image_url)s, %(image_license)s,
    '[]', '[]', '[]', '{}',
    'Nationality', ARRAY[%(nationality)s],
    'Clubs',       ARRAY[%(current_team)s],
    true
WHERE NOT EXISTS (
    SELECT 1 FROM ofta_prod.ofta_person
    WHERE LOWER(full_name) = LOWER(%(full_name)s)
);
"""

UPDATE_IMAGE_SQL = """
UPDATE ofta_prod.ofta_person
SET image_url = %(image_url)s, updated_at_tms = CURRENT_TIMESTAMP
WHERE LOWER(full_name) = LOWER(%(full_name)s)
  AND image_url IS NULL
  AND %(image_url)s IS NOT NULL
  AND %(image_url)s != '';
"""

def main(dry_run: bool = False):
    rows = list(csv.DictReader(open(CSV_PATH, encoding="utf-8")))
    print(f"CSV rows: {len(rows)}")

    conn = psycopg2.connect(**DB)
    cur = conn.cursor()

    cur.execute("SELECT LOWER(full_name) FROM ofta_prod.ofta_person WHERE primary_category = 'Footballer'")
    existing_names = {row[0] for row in cur.fetchall()}
    print(f"Existing footballers in DB: {len(existing_names)}")

    inserted = 0
    updated = 0
    skipped = 0

    for row in rows:
        name_lower = row["full_name"].strip().lower()
        if not name_lower:
            continue

        image_url = row.get("image_url") or None
        params = {
            "full_name":          row["full_name"].strip(),
            "date_of_birth":      row["date_of_birth"] or None,
            "star_sign":          row["star_sign"] or None,
            "secondary_category": row["league"],
            "nationality":        row["nationality"] or None,
            "current_team":       row["current_team"],
            "image_url":          image_url,
            "image_license":      "CC BY-SA 4.0" if image_url and "wikimedia" in image_url.lower() else None,
        }

        if name_lower not in existing_names:
            if not dry_run:
                cur.execute(INSERT_SQL, params)
            inserted += 1
        else:
            # Try to fill image on existing record
            if image_url:
                if not dry_run:
                    cur.execute(UPDATE_IMAGE_SQL, params)
                    if cur.rowcount > 0:
                        updated += 1
                    else:
                        skipped += 1
            else:
                skipped += 1

    if not dry_run:
        conn.commit()
    cur.close()
    conn.close()

    print(f"{'[DRY RUN] ' if dry_run else ''}Inserted: {inserted} | Image-updated: {updated} | Skipped: {skipped}")

    if not dry_run:
        # Verify
        conn2 = psycopg2.connect(**DB)
        cur2 = conn2.cursor()
        cur2.execute("""
            SELECT secondary_category, COUNT(*), SUM(CASE WHEN image_url IS NOT NULL THEN 1 ELSE 0 END) as with_img
            FROM ofta_prod.ofta_person
            WHERE primary_category = 'Footballer'
            GROUP BY secondary_category ORDER BY COUNT(*) DESC
        """)
        print("\nDB state after seed:")
        for r in cur2.fetchall():
            print(f"  {r[0]}: {r[1]} players ({r[2]} with image)")
        cur2.close()
        conn2.close()

if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    main(dry_run=dry_run)
