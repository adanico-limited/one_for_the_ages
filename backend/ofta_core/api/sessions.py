# ofta_core/api/sessions.py
"""
Game session endpoints for OFTA
"""

import os
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime, date, timedelta
import uuid

from slowapi import Limiter
from slowapi.util import get_remote_address

from ofta_core.utils.firebase_auth import get_current_user
from ofta_core.utils.util_db import get_db_connector

logger = logging.getLogger(__name__)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


# ────────────────────────────────────────────────
# Request/Response Models
# ────────────────────────────────────────────────

VALID_DB_CATEGORIES = {"Footballer", "Actor", "Actress", "Musician"}

# Percentile bounds within each category (PERCENT_RANK 0–1)
# Easy   = top third by popularity (most recognisable)
# Medium = middle third
# Hard   = bottom third (most obscure)
DIFFICULTY_CONFIG = {
    "easy":   {"pct_min": 0.67, "pct_max": 1.01, "spread": 5},
    "medium": {"pct_min": 0.34, "pct_max": 0.67, "spread": 3},
    "hard":   {"pct_min": 0.00, "pct_max": 0.34, "spread": 1},
}
ESCALATING_BATCHES = [
    {"count": 3, "key": "easy"},
    {"count": 4, "key": "medium"},
    {"count": 3, "key": "hard"},
]

class StartSessionRequest(BaseModel):
    mode: str = Field(..., pattern="^(AGE_GUESS|WHO_OLDER|REVERSE_DOB|REVERSE_SIGN|DAILY_CHALLENGE)$")
    pack_date: Optional[str] = None
    categories: Optional[List[str]] = None
    difficulty: Optional[str] = Field(None, pattern="^(easy|medium|hard|escalating)$")


class QuestionResponse(BaseModel):
    id: str
    mode: str
    person_id: Optional[str] = None
    person_id_a: Optional[str] = None
    person_id_b: Optional[str] = None
    person_name: Optional[str] = None
    person_name_a: Optional[str] = None
    person_name_b: Optional[str] = None
    person_image_url: Optional[str] = None
    person_image_url_a: Optional[str] = None
    person_image_url_b: Optional[str] = None
    difficulty: int
    hints: List[str] = []
    options: List[Any] = []
    correct_answer: Optional[Any] = None


class SessionResponse(BaseModel):
    id: str
    mode: str
    questions: List[QuestionResponse]
    started_at_tms: datetime


class SubmitAnswerRequest(BaseModel):
    question_template_id: str
    question_index: int = Field(..., ge=0, le=50)
    user_answer: Any
    response_time_ms: int = Field(..., ge=0, le=300000)
    hints_used: int = Field(default=0, ge=0, le=3)


class AnswerResponse(BaseModel):
    is_correct: bool
    score_awarded: int
    correct_answer: Any
    error_value: Optional[float] = None
    streak_bonus: Optional[float] = None


class EndSessionResponse(BaseModel):
    session_id: str
    total_score: int
    questions_count: int
    correct_count: int
    best_streak: int
    accuracy: float
    lifetime_score: int
    global_rank: int


# ────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────

@router.post("/start", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def start_session(
    request: Request,
    body: StartSessionRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Start a new game session.
    Generates questions based on mode.
    """
    db = get_db_connector()
    
    # Dev mock - only in development environment
    is_dev = current_user.get("firebase_uid") == "dev_user_123"
    if is_dev:
        if os.getenv("ENVIRONMENT") != "development":
            raise HTTPException(status_code=403, detail="Dev users not allowed in this environment")
        user_id = "00000000-0000-0000-0000-000000000001"
    else:
        # Get user from database
        user_df = db.select_df(
            "SELECT id FROM ofta_prod.ofta_user_account WHERE firebase_uid = :firebase_uid",
            params={"firebase_uid": current_user["firebase_uid"]}
        )

        if user_df.empty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found. Please register first."
            )

        user_id = user_df.iloc[0]['id']
    session_id = str(uuid.uuid4())
    
    import pandas as pd
    num_questions = 10

    db_cats = [c for c in (body.categories or []) if c in VALID_DB_CATEGORIES]

    def _cat_filter(alias: str) -> str:
        if not db_cats:
            return ""
        placeholders = ", ".join(f"'{c}'" for c in db_cats)
        return f"AND {alias}.primary_category IN ({placeholders})"

    def _fetch(mode: str, limit: int, pct_min: float, pct_max: float) -> "pd.DataFrame":
        if mode == "WHO_OLDER":
            return db.select_df(
                f"""
                WITH pool AS (
                    SELECT DISTINCT c.id, c.primary_category, c.popularity_score
                    FROM ofta_prod.ofta_question_template qt
                    JOIN ofta_prod.ofta_person c ON qt.person_id_a = c.id OR qt.person_id_b = c.id
                    WHERE qt.mode = 'WHO_OLDER' AND qt.is_active = TRUE
                      AND c.image_url IS NOT NULL AND c.image_url != ''
                ),
                ranked AS (
                    SELECT id,
                           PERCENT_RANK() OVER (
                               PARTITION BY primary_category ORDER BY popularity_score
                           ) AS pop_pct
                    FROM pool
                )
                SELECT qt.id, qt.mode, qt.person_id_a, qt.person_id_b, qt.difficulty,
                       ca.full_name AS person_name_a, cb.full_name AS person_name_b,
                       ca.image_url AS person_image_url_a, cb.image_url AS person_image_url_b,
                       ca.hints_easy AS hints_a, cb.hints_easy AS hints_b
                FROM ofta_prod.ofta_question_template qt
                JOIN ofta_prod.ofta_person ca ON qt.person_id_a = ca.id
                JOIN ofta_prod.ofta_person cb ON qt.person_id_b = cb.id
                JOIN ranked ra ON ra.id = ca.id
                JOIN ranked rb ON rb.id = cb.id
                WHERE qt.mode = 'WHO_OLDER' AND qt.is_active = TRUE
                  AND ca.image_url IS NOT NULL AND ca.image_url != ''
                  AND cb.image_url IS NOT NULL AND cb.image_url != ''
                  AND ra.pop_pct >= :pct_min AND ra.pop_pct < :pct_max
                  AND rb.pop_pct >= :pct_min AND rb.pop_pct < :pct_max
                  {_cat_filter('ca')} {_cat_filter('cb')}
                ORDER BY RANDOM() LIMIT :limit
                """,
                params={"limit": limit, "pct_min": pct_min, "pct_max": pct_max},
            )
        return db.select_df(
            f"""
            WITH pool AS (
                SELECT DISTINCT c.id, c.primary_category, c.popularity_score
                FROM ofta_prod.ofta_question_template qt
                JOIN ofta_prod.ofta_person c ON qt.person_id = c.id
                WHERE qt.mode = :mode AND qt.is_active = TRUE
                  AND c.image_url IS NOT NULL AND c.image_url != ''
            ),
            ranked AS (
                SELECT id,
                       PERCENT_RANK() OVER (
                           PARTITION BY primary_category ORDER BY popularity_score
                       ) AS pop_pct
                FROM pool
            )
            SELECT qt.id, qt.mode, qt.person_id, qt.difficulty,
                   c.full_name AS person_name, c.image_url AS person_image_url,
                   c.hints_easy AS hints, c.star_sign, c.date_of_birth,
                   EXTRACT(YEAR FROM c.date_of_birth) AS dob_year
            FROM ofta_prod.ofta_question_template qt
            JOIN ofta_prod.ofta_person c ON qt.person_id = c.id
            JOIN ranked r ON r.id = c.id
            WHERE qt.mode = :mode AND qt.is_active = TRUE
              AND c.image_url IS NOT NULL AND c.image_url != ''
              AND r.pop_pct >= :pct_min AND r.pop_pct < :pct_max
              {_cat_filter('c')}
            ORDER BY RANDOM() LIMIT :limit
            """,
            params={"mode": mode, "limit": limit, "pct_min": pct_min, "pct_max": pct_max},
        )

    diff = body.difficulty or "easy"

    if diff == "escalating":
        batches, spreads = [], []
        for batch in ESCALATING_BATCHES:
            cfg = DIFFICULTY_CONFIG[batch["key"]]
            df = _fetch(body.mode, batch["count"], cfg["pct_min"], cfg["pct_max"])
            batches.append(df)
            spreads.extend([cfg["spread"]] * len(df))
        questions_df = pd.concat(batches, ignore_index=True) if batches else pd.DataFrame()
    else:
        cfg = DIFFICULTY_CONFIG[diff]
        questions_df = _fetch(body.mode, num_questions, cfg["pct_min"], cfg["pct_max"])
        spreads = [cfg["spread"]] * len(questions_df)
    
    if questions_df.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No questions available for mode: {body.mode}"
        )
    
    # Create session
    db.execute_query(
        """
        INSERT INTO ofta_prod.ofta_game_session (
            id, user_id, mode, pack_date, started_at_tms
        ) VALUES (
            :id, :user_id, :mode, :pack_date, NOW()
        )
        """,
        params={
            "id": session_id,
            "user_id": user_id,
            "mode": body.mode,
            "pack_date": body.pack_date,
        }
    )
    
    # Format questions
    questions = []
    import random
    
    ZODIAC_SIGNS = [
        "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
        "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
    ]
    
    for i, (_, row) in enumerate(questions_df.iterrows()):
        question = QuestionResponse(
            id=str(row['id']),
            mode=row['mode'],
            difficulty=row['difficulty'],
            hints=row.get('hints', []) or []
        )

        if body.mode == "WHO_OLDER":
            question.person_id_a = str(row['person_id_a'])
            question.person_id_b = str(row['person_id_b'])
            question.person_name_a = row['person_name_a']
            question.person_name_b = row['person_name_b']
            question.person_image_url_a = row.get('person_image_url_a')
            question.person_image_url_b = row.get('person_image_url_b')
            # correct_answer: which person is older (a or b)
            dob_a = row['dob_a'] if 'dob_a' in row else None
            dob_b = row['dob_b'] if 'dob_b' in row else None
            if dob_a and dob_b:
                question.correct_answer = {"older": "a" if dob_a < dob_b else "b"}
        else:
            question.person_id = str(row['person_id'])
            question.person_name = row['person_name']
            question.person_image_url = row.get('person_image_url')

            if body.mode == "REVERSE_SIGN":
                correct_sign = row['star_sign']
                decoys = [s for s in ZODIAC_SIGNS if s != correct_sign]
                options = random.sample(decoys, 8) + [correct_sign]
                random.shuffle(options)
                question.options = options
                question.correct_answer = {"sign": correct_sign}

            elif body.mode == "REVERSE_DOB":
                correct_year = int(row['dob_year'])
                offsets = [-2, -1, 1, 2, 3, 4]
                if random.choice([True, False]):
                    offsets = [-3, -2, -1, 1, 2, 3, 4, 5]
                options = [correct_year + o for o in random.sample(offsets, 8)] + [correct_year]
                random.shuffle(options)
                question.options = options
                question.correct_answer = {"year": correct_year}

            elif body.mode in ("AGE_GUESS", "DAILY_CHALLENGE"):
                dob = row['date_of_birth']
                if hasattr(dob, 'to_pydatetime'):
                    dob = dob.to_pydatetime().date()
                elif isinstance(dob, datetime):
                    dob = dob.date()
                elif isinstance(dob, str):
                    dob = datetime.strptime(dob, '%Y-%m-%d').date()

                today = date.today()
                correct_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

                spread = spreads[i]
                pool = [correct_age + d for d in range(-spread, spread + 1)
                        if d != 0 and 16 <= correct_age + d <= 100]
                distractors = random.sample(pool, min(3, len(pool)))
                options = distractors + [correct_age]
                random.shuffle(options)
                question.options = options
                question.correct_answer = {"age": correct_age}
        
        questions.append(question)
    
    return SessionResponse(
        id=session_id,
        mode=body.mode,
        questions=questions,
        started_at_tms=datetime.utcnow()
    )


@router.post("/{session_id}/answer", response_model=AnswerResponse)
async def submit_answer(
    session_id: str,
    request: SubmitAnswerRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit an answer for a question in a session.
    Returns scoring and correctness.
    """
    db = get_db_connector()
    
    # Verify session belongs to user
    session_df = db.select_df(
        """
        SELECT gs.id, gs.mode, ua.firebase_uid
        FROM ofta_prod.ofta_game_session gs
        JOIN ofta_prod.ofta_user_account ua ON gs.user_id = ua.id
        WHERE gs.id = :session_id
        """,
        params={"session_id": session_id}
    )
    
    if session_df.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if session_df.iloc[0]['firebase_uid'] != current_user["firebase_uid"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to submit answers for this session"
        )
    
    mode = session_df.iloc[0]['mode']

    # Anti-cheat: flag suspiciously fast responses
    if request.response_time_ms < 200:
        logger.warning(
            f"Suspiciously fast answer: {request.response_time_ms}ms "
            f"from session {session_id}, question {request.question_index}"
        )

    # Get question and person data
    question_df = db.select_df(
        """
        SELECT 
            qt.*,
            c.date_of_birth,
            c.star_sign,
            ca.date_of_birth as dob_a,
            cb.date_of_birth as dob_b
        FROM ofta_prod.ofta_question_template qt
        LEFT JOIN ofta_prod.ofta_person c ON qt.person_id = c.id
        LEFT JOIN ofta_prod.ofta_person ca ON qt.person_id_a = ca.id
        LEFT JOIN ofta_prod.ofta_person cb ON qt.person_id_b = cb.id
        WHERE qt.id = :question_id
        """,
        params={"question_id": request.question_template_id}
    )
    
    if question_df.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    question = question_df.iloc[0]
    
    # Calculate correctness and score
    is_correct = False
    correct_answer = {}
    error_value = None
    score_awarded = 0
    
    if mode == "AGE_GUESS":
        dob = question['date_of_birth']
        if isinstance(dob, str):
            dob = datetime.strptime(dob, '%Y-%m-%d').date()
        
        correct_age = (date.today() - dob).days // 365
        user_age = request.user_answer.get('age', 0)
        error_value = abs(correct_age - user_age)
        
        # Scoring: Perfect = 100, within 1 year = 80, within 2 = 60, etc.
        if error_value == 0:
            score_awarded = 100
            is_correct = True
        elif error_value <= 1:
            score_awarded = 80
            is_correct = True
        elif error_value <= 2:
            score_awarded = 60
        elif error_value <= 3:
            score_awarded = 40
        elif error_value <= 5:
            score_awarded = 20
        
        # Apply hint penalty
        if request.hints_used > 0:
            score_awarded = int(score_awarded * 0.8)
        
        correct_answer = {"age": correct_age}
    
    elif mode == "WHO_OLDER":
        dob_a = question['dob_a']
        dob_b = question['dob_b']
        
        if isinstance(dob_a, str):
            dob_a = datetime.strptime(dob_a, '%Y-%m-%d').date()
        if isinstance(dob_b, str):
            dob_b = datetime.strptime(dob_b, '%Y-%m-%d').date()
        
        correct_choice = 'A' if dob_a < dob_b else 'B'
        user_choice = request.user_answer.get('choice', '')
        
        is_correct = user_choice == correct_choice
        score_awarded = 100 if is_correct else 0
        correct_answer = {"choice": correct_choice}

    elif mode == "REVERSE_SIGN":
        correct_sign = question['star_sign']
        user_sign = request.user_answer.get('sign', '')
        
        is_correct = user_sign == correct_sign
        score_awarded = 50 if is_correct else 0
        correct_answer = {"sign": correct_sign}

    elif mode == "REVERSE_DOB":
        dob = question['date_of_birth']
        if isinstance(dob, str):
            dob = datetime.strptime(dob, '%Y-%m-%d').date()
        
        correct_year = dob.year
        user_year = int(request.user_answer.get('year', 0))
        
        is_correct = user_year == correct_year
        score_awarded = 50 if is_correct else 0
        correct_answer = {"year": correct_year}
    
    # Calculate current streak from prior attempts in this session
    streak_df = db.select_df(
        """
        SELECT is_correct
        FROM ofta_prod.ofta_question_attempt
        WHERE session_id = :session_id
        ORDER BY question_index DESC
        """,
        params={"session_id": session_id}
    )
    current_streak = 0
    for _, attempt_row in streak_df.iterrows():
        if attempt_row['is_correct']:
            current_streak += 1
        else:
            break

    # Apply streak bonus multiplier
    streak_bonus = 1.0
    if is_correct:
        current_streak += 1  # Include the current correct answer
        if current_streak >= 10:
            streak_bonus = 2.0
        elif current_streak >= 5:
            streak_bonus = 1.5
        elif current_streak >= 3:
            streak_bonus = 1.2

        if streak_bonus > 1.0:
            score_awarded = int(score_awarded * streak_bonus)

    # Record attempt
    db.execute_query(
        """
        INSERT INTO ofta_prod.ofta_question_attempt (
            session_id, question_template_id, question_index,
            shown_at_tms, answered_at_tms, response_time_ms,
            user_answer, is_correct, error_value,
            hints_used, score_awarded, streak_at_time
        ) VALUES (
            :session_id, :question_template_id, :question_index,
            NOW(), NOW(), :response_time_ms,
            CAST(:user_answer AS jsonb), :is_correct, :error_value,
            :hints_used, :score_awarded, :streak_at_time
        )
        """,
        params={
            "session_id": session_id,
            "question_template_id": request.question_template_id,
            "question_index": request.question_index,
            "response_time_ms": request.response_time_ms,
            "user_answer": json.dumps(request.user_answer),
            "is_correct": is_correct,
            "error_value": error_value,
            "hints_used": request.hints_used,
            "score_awarded": score_awarded,
            "streak_at_time": current_streak,
        }
    )

    return AnswerResponse(
        is_correct=is_correct,
        score_awarded=score_awarded,
        correct_answer=correct_answer,
        error_value=error_value,
        streak_bonus=streak_bonus if streak_bonus > 1.0 else None,
    )


@router.post("/{session_id}/end", response_model=EndSessionResponse)
async def end_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    End a game session and calculate final stats.
    """
    db = get_db_connector()
    
    # Verify session
    session_df = db.select_df(
        """
        SELECT gs.id, gs.user_id, ua.firebase_uid
        FROM ofta_prod.ofta_game_session gs
        JOIN ofta_prod.ofta_user_account ua ON gs.user_id = ua.id
        WHERE gs.id = :session_id
        """,
        params={"session_id": session_id}
    )
    
    if session_df.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if session_df.iloc[0]['firebase_uid'] != current_user["firebase_uid"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    # Calculate stats
    stats_df = db.select_df(
        """
        SELECT 
            COUNT(*) as questions_count,
            SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
            SUM(score_awarded) as total_score
        FROM ofta_prod.ofta_question_attempt
        WHERE session_id = :session_id
        """,
        params={"session_id": session_id}
    )
    
    stats = stats_df.iloc[0]
    total_score = int(stats['total_score'] or 0)
    questions_count = int(stats['questions_count'] or 0)
    correct_count = int(stats['correct_count'] or 0)
    
    # Calculate best streak
    attempts_df = db.select_df(
        """
        SELECT is_correct
        FROM ofta_prod.ofta_question_attempt
        WHERE session_id = :session_id
        ORDER BY question_index
        """,
        params={"session_id": session_id}
    )
    
    best_streak = 0
    current_streak = 0
    for _, row in attempts_df.iterrows():
        if row['is_correct']:
            current_streak += 1
            best_streak = max(best_streak, current_streak)
        else:
            current_streak = 0
    
    # Update session
    db.execute_query(
        """
        UPDATE ofta_prod.ofta_game_session
        SET 
            ended_at_tms = NOW(),
            total_score = :total_score,
            questions_count = :questions_count,
            correct_count = :correct_count,
            best_streak = :best_streak
        WHERE id = :session_id
        """,
        params={
            "session_id": session_id,
            "total_score": total_score,
            "questions_count": questions_count,
            "correct_count": correct_count,
            "best_streak": best_streak,
        }
    )
    
    accuracy = (correct_count / questions_count * 100) if questions_count > 0 else 0
    user_id = session_df.iloc[0]['user_id']

    # Calculate daily streak before upsert
    existing_df = db.select_df(
        "SELECT current_streak, updated_at_tms FROM ofta_prod.ofta_user_stats WHERE user_id = :user_id",
        params={"user_id": user_id}
    )
    today = date.today()
    if existing_df.empty:
        new_daily_streak = 1
    else:
        ex = existing_df.iloc[0]
        last_updated = ex['updated_at_tms']
        prev_streak = int(ex['current_streak'] or 0)
        if last_updated is None:
            new_daily_streak = 1
        else:
            last_date = last_updated.date() if hasattr(last_updated, 'date') else date.fromisoformat(str(last_updated)[:10])
            if last_date == today:
                new_daily_streak = prev_streak
            elif last_date == today - timedelta(days=1):
                new_daily_streak = prev_streak + 1
            else:
                new_daily_streak = 1

    # Upsert user stats
    db.execute_query(
        """
        INSERT INTO ofta_prod.ofta_user_stats AS s (
            user_id, lifetime_score, best_streak, current_streak,
            games_played, total_correct, total_questions, accuracy_pct, updated_at_tms
        )
        VALUES (
            :user_id, :score, :best_streak, :daily_streak,
            1, :correct, :total, :accuracy, NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            lifetime_score  = s.lifetime_score + :score,
            best_streak     = GREATEST(s.best_streak, :best_streak),
            current_streak  = :daily_streak,
            games_played    = s.games_played + 1,
            total_correct   = s.total_correct + :correct,
            total_questions = s.total_questions + :total,
            accuracy_pct    = (s.total_correct + :correct)::float
                              / NULLIF(s.total_questions + :total, 0) * 100,
            updated_at_tms  = NOW()
        """,
        params={
            "user_id":       user_id,
            "score":         total_score,
            "best_streak":   best_streak,
            "daily_streak":  new_daily_streak,
            "correct":       correct_count,
            "total":         questions_count,
            "accuracy":      accuracy,
        }
    )

    # Read fresh lifetime score and rank
    user_stats_df = db.select_df(
        "SELECT lifetime_score FROM ofta_prod.ofta_user_stats WHERE user_id = :user_id",
        params={"user_id": user_id}
    )
    lifetime_score = int(user_stats_df.iloc[0]['lifetime_score']) if not user_stats_df.empty else total_score

    # Calculate rank (simple count > score)
    rank_df = db.select_df(
        """
        SELECT COUNT(*) as rank_above
        FROM ofta_prod.ofta_user_stats
        WHERE lifetime_score > :score
        """,
        params={"score": lifetime_score}
    )
    global_rank = int(rank_df.iloc[0]['rank_above']) + 1

    return EndSessionResponse(
        session_id=session_id,
        total_score=total_score,
        questions_count=questions_count,
        correct_count=correct_count,
        best_streak=best_streak,
        accuracy=accuracy,
        lifetime_score=lifetime_score,
        global_rank=global_rank
    )
