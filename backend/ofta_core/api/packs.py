# ofta_core/api/packs.py
"""
Daily Pack endpoints for OFTA
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
import uuid

from ofta_core.utils.firebase_auth import get_current_user, get_optional_user
from ofta_core.utils.util_db import get_db_connector

router = APIRouter()


# ────────────────────────────────────────────────
# Response Models
# ────────────────────────────────────────────────

class PersonBrief(BaseModel):
    id: str
    full_name: str
    primary_category: str
    nationality: Optional[str] = None
    hints_easy: Optional[list] = []


class PackQuestion(BaseModel):
    id: str
    mode: str
    difficulty: int
    person: Optional[PersonBrief] = None
    person_a: Optional[PersonBrief] = None
    person_b: Optional[PersonBrief] = None


class DailyPackResponse(BaseModel):
    pack_date: str
    questions: List[PackQuestion]
    question_count: int
    is_completed: bool = False
    user_score: Optional[int] = None


# ────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────

@router.get("/daily/{pack_date}", response_model=DailyPackResponse)
async def get_daily_pack(
    pack_date: str,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """
    Get the daily challenge pack for a specific date.
    If no pack exists, generate one on the fly from random questions.
    """
    db = get_db_connector()

    # Validate date format
    try:
        target_date = datetime.strptime(pack_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD"
        )

    # Check if pack exists
    pack_df = db.select_df(
        "SELECT * FROM ofta_prod.ofta_daily_pack WHERE pack_date = :pack_date",
        params={"pack_date": target_date}
    )

    # Generate a pack on the fly if none exists
    # Use a deterministic seed based on date for consistency
    questions_df = db.select_df(
        """
        SELECT
            qt.id,
            qt.mode,
            qt.difficulty,
            qt.person_id,
            qt.person_id_a,
            qt.person_id_b,
            c.id as celeb_id,
            c.full_name as celeb_name,
            c.primary_category as celeb_category,
            c.nationality as celeb_nationality,
            c.hints_easy as celeb_hints,
            ca.id as celeb_a_id,
            ca.full_name as celeb_a_name,
            ca.primary_category as celeb_a_category,
            ca.nationality as celeb_a_nationality,
            ca.hints_easy as celeb_a_hints,
            cb.id as celeb_b_id,
            cb.full_name as celeb_b_name,
            cb.primary_category as celeb_b_category,
            cb.nationality as celeb_b_nationality,
            cb.hints_easy as celeb_b_hints
        FROM ofta_prod.ofta_question_template qt
        LEFT JOIN ofta_prod.ofta_person c ON qt.person_id = c.id
        LEFT JOIN ofta_prod.ofta_person ca ON qt.person_id_a = ca.id
        LEFT JOIN ofta_prod.ofta_person cb ON qt.person_id_b = cb.id
        WHERE qt.is_active = TRUE
        ORDER BY md5(qt.id::text || :date_seed)
        LIMIT 10
        """,
        params={"date_seed": pack_date}
    )

    if questions_df.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No questions available for daily pack on {pack_date}"
        )

    # Format questions
    questions = []
    for _, row in questions_df.iterrows():
        q = PackQuestion(
            id=str(row['id']),
            mode=row['mode'],
            difficulty=row['difficulty'],
        )

        if row['person_id'] is not None:
            q.person = PersonBrief(
                id=str(row['celeb_id']),
                full_name=row['celeb_name'],
                primary_category=row['celeb_category'],
                nationality=row.get('celeb_nationality'),
                hints_easy=row.get('celeb_hints', []) or [],
            )

        if row['person_id_a'] is not None:
            q.person_a = PersonBrief(
                id=str(row['celeb_a_id']),
                full_name=row['celeb_a_name'],
                primary_category=row['celeb_a_category'],
                nationality=row.get('celeb_a_nationality'),
                hints_easy=row.get('celeb_a_hints', []) or [],
            )
            q.person_b = PersonBrief(
                id=str(row['celeb_b_id']),
                full_name=row['celeb_b_name'],
                primary_category=row['celeb_b_category'],
                nationality=row.get('celeb_b_nationality'),
                hints_easy=row.get('celeb_b_hints', []) or [],
            )

        questions.append(q)

    # Check if user has already completed this daily
    is_completed = False
    user_score = None
    if current_user:
        user_df = db.select_df(
            "SELECT id FROM ofta_prod.ofta_user_account WHERE firebase_uid = :firebase_uid",
            params={"firebase_uid": current_user["firebase_uid"]}
        )
        if not user_df.empty:
            lb_df = db.select_df(
                """
                SELECT score FROM ofta_prod.ofta_leaderboard_daily
                WHERE pack_date = :pack_date AND user_id = :user_id
                """,
                params={"pack_date": target_date, "user_id": user_df.iloc[0]['id']}
            )
            if not lb_df.empty:
                is_completed = True
                user_score = int(lb_df.iloc[0]['score'])

    return DailyPackResponse(
        pack_date=pack_date,
        questions=questions,
        question_count=len(questions),
        is_completed=is_completed,
        user_score=user_score,
    )


@router.get("/daily/{pack_date}/status")
async def get_pack_status(
    pack_date: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if user has completed today's daily challenge."""
    db = get_db_connector()

    user_df = db.select_df(
        "SELECT id FROM ofta_prod.ofta_user_account WHERE firebase_uid = :firebase_uid",
        params={"firebase_uid": current_user["firebase_uid"]}
    )

    if user_df.empty:
        return {"completed": False, "score": None}

    lb_df = db.select_df(
        """
        SELECT score FROM ofta_prod.ofta_leaderboard_daily
        WHERE pack_date = :pack_date AND user_id = :user_id
        """,
        params={"pack_date": pack_date, "user_id": user_df.iloc[0]['id']}
    )

    if lb_df.empty:
        return {"completed": False, "score": None}

    return {"completed": True, "score": int(lb_df.iloc[0]['score'])}
