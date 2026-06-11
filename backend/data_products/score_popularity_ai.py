"""
Score popularity for Footballers and Musicians using Google Gemini Flash Lite.

Sends batches of 30 names to the model and gets back a 1-99 fame score per person
based on its training knowledge of global recognition.

Usage:
    python score_popularity_ai.py --category Footballer
    python score_popularity_ai.py --category Musician
    python score_popularity_ai.py --category all
    python score_popularity_ai.py --category Footballer --dry-run
    python score_popularity_ai.py --category Footballer --batch-size 30 --concurrency 5
"""

import argparse
import asyncio
import json
import os
import sys

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

try:
    from google import genai
except ImportError:
    sys.exit("Missing: pip install google-genai")

try:
    import psycopg2
except ImportError:
    sys.exit("Missing: pip install psycopg2-binary")

DB = {
    "host":     os.getenv("OFTA_DB_HOST", "34.71.254.207"),
    "port":     int(os.getenv("OFTA_DB_PORT", 5432)),
    "dbname":   os.getenv("OFTA_DB_NAME", "tasc_db"),
    "user":     os.getenv("OFTA_DB_USERNAME", "postgres"),
    "password": os.getenv("OFTA_DB_PASSWORD", "tascoask"),
}

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = "gemini-2.5-flash"

PROMPT_TEMPLATE = """\
Rate the global fame and public recognition of each {category} below on a scale of 1 to 99:

  90-99 = Global superstar, universally recognised (Messi, Beyoncé level)
  70-89 = Internationally famous, known well beyond their home country
  50-69 = Well known in their field, some international recognition
  30-49 = Known to dedicated fans, limited broader recognition
  10-29 = Obscure, only known to specialists
   1-9  = Very niche, barely known

Be consistent — a higher score must mean genuinely more famous.

Return ONLY valid JSON with no explanation, no markdown:
{{"Full Name": score, ...}}

{category}s to score:
{names}"""


async def score_batch(
    client: genai.Client,
    batch: list[tuple],
    category: str,
    semaphore: asyncio.Semaphore,
) -> dict[str, int]:
    names_list = "\n".join(f"{i+1}. {name}" for i, (_, name) in enumerate(batch))
    prompt = PROMPT_TEMPLATE.format(category=category, names=names_list)

    async with semaphore:
        for attempt in range(3):
            try:
                response = await asyncio.to_thread(
                    client.models.generate_content,
                    model=MODEL,
                    contents=prompt,
                )
                raw = response.text.strip()
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                scores = json.loads(raw)
                return {k: max(1, min(99, int(v))) for k, v in scores.items()}
            except (json.JSONDecodeError, Exception) as e:
                if attempt == 2:
                    print(f"  FAILED batch after 3 attempts: {e}")
                    return {}
                await asyncio.sleep(2 ** attempt)
    return {}


async def run(category: str, batch_size: int, concurrency: int, dry_run: bool):
    if not GEMINI_API_KEY:
        sys.exit("Set GEMINI_API_KEY in .env")

    conn = psycopg2.connect(**DB)
    cur = conn.cursor()

    categories = ["Footballer", "Musician"] if category == "all" else [category]

    for cat in categories:
        print(f"\n{'='*50}")
        print(f"Category: {cat}  |  Model: {MODEL}")

        cur.execute(
            "SELECT id, full_name FROM ofta_prod.ofta_person WHERE primary_category = %s ORDER BY full_name",
            (cat,)
        )
        rows = cur.fetchall()
        print(f"Total persons: {len(rows)}")

        batches = [rows[i:i + batch_size] for i in range(0, len(rows), batch_size)]
        print(f"Batches of {batch_size}: {len(batches)}  |  Concurrency: {concurrency}")

        if dry_run:
            print(f"[DRY RUN] Would send {len(batches)} batches to Gemini")
            sample = [name for _, name in batches[0][:5]]
            print(f"  Sample (first 5 of batch 0): {sample}")
            continue

        client = genai.Client(api_key=GEMINI_API_KEY)
        semaphore = asyncio.Semaphore(concurrency)

        tasks = [score_batch(client, b, cat, semaphore) for b in batches]

        all_scores: dict[str, int] = {}
        completed = 0
        for coro in asyncio.as_completed(tasks):
            result = await coro
            all_scores.update(result)
            completed += 1
            if completed % 10 == 0 or completed == len(batches):
                print(f"  {completed}/{len(batches)} batches done — {len(all_scores)} scores so far")

        print(f"\nScores collected: {len(all_scores)}/{len(rows)}")

        # Reconnect — the async scoring phase leaves the connection idle long enough to drop
        cur.close()
        conn.close()
        conn = psycopg2.connect(**DB)
        cur = conn.cursor()

        updated = 0
        not_found = 0
        for person_id, full_name in rows:
            score = all_scores.get(full_name)
            if score is None:
                score = next(
                    (v for k, v in all_scores.items() if k.lower() == full_name.lower()),
                    None
                )
            if score is not None:
                cur.execute(
                    "UPDATE ofta_prod.ofta_person SET popularity_score = %s WHERE id = %s",
                    (float(score), person_id)
                )
                updated += 1
            else:
                not_found += 1

        conn.commit()
        print(f"DB updated: {updated}  |  Not matched: {not_found}")

        cur.execute("""
            SELECT
                ROUND(MIN(popularity_score)::numeric, 1) as min,
                ROUND(MAX(popularity_score)::numeric, 1) as max,
                ROUND(AVG(popularity_score)::numeric, 1) as avg,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY popularity_score)::numeric, 1) as median
            FROM ofta_prod.ofta_person WHERE primary_category = %s
        """, (cat,))
        r = cur.fetchone()
        print(f"New distribution — min:{r[0]}  max:{r[1]}  avg:{r[2]}  median:{r[3]}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--category", default="all",
                        choices=["Footballer", "Musician", "Actor", "Actress", "all"])
    parser.add_argument("--batch-size", type=int, default=30)
    parser.add_argument("--concurrency", type=int, default=5)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    asyncio.run(run(args.category, args.batch_size, args.concurrency, args.dry_run))
