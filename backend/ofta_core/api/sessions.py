# ofta_core/api/sessions.py
"""
Game session endpoints for OFTA
"""

import os
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime, date
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

class StartSessionRequest(BaseModel):
    mode: str = Field(..., pattern="^(AGE_GUESS|WHO_OLDER|REVERSE_DOB|REVERSE_SIGN|DAILY_CHALLENGE)$")
    pack_date: Optional[str] = None  # For DAILY_CHALLENGE


class QuestionResponse(BaseModel):
    id: str
    mode: str
    celebrity_id: Optional[str] = None
    celebrity_id_a: Optional[str] = None
    celebrity_id_b: Optional[str] = None
    celebrity_name: Optional[str] = None
    celebrity_name_a: Optional[str] = None
    celebrity_name_b: Optional[str] = None
    difficulty: int
    hints: List[str] = []
    options: List[Any] = []


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
    
    # Generate questions (simplified for MVP - fetch random active questions)
    num_questions = 10
    
    if body.mode == "WHO_OLDER":
        questions_df = db.select_df(
            """
            SELECT 
                qt.id,
                qt.mode,
                qt.celebrity_id_a,
                qt.celebrity_id_b,
                qt.difficulty,
                ca.full_name as celebrity_name_a,
                cb.full_name as celebrity_name_b,
                ca.hints_easy as hints_a,
                cb.hints_easy as hints_b
            FROM ofta_prod.ofta_question_template qt
            JOIN ofta_prod.ofta_celebrity ca ON qt.celebrity_id_a = ca.id
            JOIN ofta_prod.ofta_celebrity cb ON qt.celebrity_id_b = cb.id
            WHERE qt.mode = 'WHO_OLDER' AND qt.is_active = TRUE
            ORDER BY RANDOM()
            LIMIT :limit
            """,
            params={"limit": num_questions}
        )
    else:
        # AGE_GUESS, REVERSE modes
        questions_df = db.select_df(
            """
            SELECT 
                qt.id,
                qt.mode,
                qt.celebrity_id,
                qt.difficulty,
                c.full_name as celebrity_name,
                c.hints_easy as hints,
                c.star_sign,
                c.date_of_birth,
                EXTRACT(YEAR FROM c.date_of_birth) as dob_year
            FROM ofta_prod.ofta_question_template qt
            JOIN ofta_prod.ofta_celebrity c ON qt.celebrity_id = c.id
            WHERE qt.mode = :mode AND qt.is_active = TRUE
            ORDER BY RANDOM()
            LIMIT :limit
            """,
            params={"mode": body.mode, "limit": num_questions}
        )
    
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
    
    for _, row in questions_df.iterrows():
        question = QuestionResponse(
            id=str(row['id']),
            mode=row['mode'],
            difficulty=row['difficulty'],
            hints=row.get('hints', []) or []
        )

        if body.mode == "WHO_OLDER":
            question.celebrity_id_a = str(row['celebrity_id_a'])
            question.celebrity_id_b = str(row['celebrity_id_b'])
            question.celebrity_name_a = row['celebrity_name_a']
            question.celebrity_name_b = row['celebrity_name_b']
        else:
            question.celebrity_id = str(row['celebrity_id'])
            question.celebrity_name = row['celebrity_name']
            
            # Populate options for REVERSE modes
            if body.mode == "REVERSE_SIGN":
                # For signs, we can show them ALL (12) or 9. Let's show all 12 for choice.
                # Or if we want exactly 9 as per wireframe, we pick correct + 8 randoms.
                correct_sign = row['star_sign']
                decoys = [s for s in ZODIAC_SIGNS if s != correct_sign]
                options = random.sample(decoys, 8) + [correct_sign]
                random.shuffle(options)
                question.options = options
                
            elif body.mode == "REVERSE_DOB":
                correct_year = int(row['dob_year'])
                # Generate years around correct year
                offsets = [-2, -1, 1, 2, 3, 4] # Example offsets for 6 options
                if random.choice([True, False]):
                    offsets = [-3, -2, -1, 1, 2, 3, 4, 5] # 9 options
                
                options = [correct_year + o for o in random.sample(offsets, 8)] + [correct_year]
                random.shuffle(options)
                question.options = options

            elif body.mode == "AGE_GUESS":
                # Calculate age
                dob = row['date_of_birth']
                # Handle types - pandas Timestamp or date or str
                if hasattr(dob, 'to_pydatetime'): 
                    dob = dob.to_pydatetime().date()
                elif isinstance(dob, datetime):
                    dob = dob.date()
                elif isinstance(dob, str):
                    dob = datetime.strptime(dob, '%Y-%m-%d').date()

                today = date.today()
                correct_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                
                # Distractor spread scales with difficulty:
                # difficulty 1 → ±1yr, 2 → ±2yr, 3 → ±3yr, 4-5 → ±4yr
                spread = min(row['difficulty'], 4)
                pool = [correct_age + d for d in range(-spread, spread + 1)
                        if d != 0 and 16 <= correct_age + d <= 100]
                distractors = random.sample(pool, min(3, len(pool)))

                options = distractors + [correct_age]
                random.shuffle(options)
                question.options = options
        
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

    # Get question and celebrity data
    question_df = db.select_df(
        """
        SELECT 
            qt.*,
            c.date_of_birth,
            c.star_sign,
            ca.date_of_birth as dob_a,
            cb.date_of_birth as dob_b
        FROM ofta_prod.ofta_question_template qt
        LEFT JOIN ofta_prod.ofta_celebrity c ON qt.celebrity_id = c.id
        LEFT JOIN ofta_prod.ofta_celebrity ca ON qt.celebrity_id_a = ca.id
        LEFT JOIN ofta_prod.ofta_celebrity cb ON qt.celebrity_id_b = cb.id
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
    
    # Fetch updated stats and rank
    user_stats_df = db.select_df(
        """
        SELECT lifetime_score
        FROM ofta_prod.ofta_user_stats
        WHERE user_id = :user_id
        """,
        params={"user_id": session_df.iloc[0]['user_id']} # Need user_id from session_df?
    )
    
    # If user_stats_df is empty (trigger failed or race condition?), default to session score
    lifetime_score = total_score
    if not user_stats_df.empty:
        lifetime_score = int(user_stats_df.iloc[0]['lifetime_score'])

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
