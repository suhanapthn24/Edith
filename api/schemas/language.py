from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import date, datetime


# ── Language ──────────────────────────────────────────────────────────────────

class LanguageCreate(BaseModel):
    name: str
    code: str
    cefr_level: Optional[str] = None
    daily_goal_mins: int = 15

class LanguageUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    cefr_level: Optional[str] = None
    daily_goal_mins: Optional[int] = None
    is_active: Optional[bool] = None

class LanguageOut(BaseModel):
    id: UUID
    name: str
    code: str
    cefr_level: Optional[str]
    daily_goal_mins: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Vocabulary ────────────────────────────────────────────────────────────────

class VocabCreate(BaseModel):
    word: str
    translation: str
    pronunciation: Optional[str] = None
    example_sentence: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None
    gender: Optional[str] = None

class VocabUpdate(BaseModel):
    word: Optional[str] = None
    translation: Optional[str] = None
    pronunciation: Optional[str] = None
    example_sentence: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None
    gender: Optional[str] = None

class VocabOut(BaseModel):
    id: UUID
    language_id: UUID
    word: str
    translation: str
    pronunciation: Optional[str]
    example_sentence: Optional[str]
    notes: Optional[str]
    tags: Optional[str]
    gender: Optional[str]
    ease_factor: float
    repetitions: int
    interval_days: int
    next_review: Optional[date]
    review_count: int
    last_reviewed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}

class VocabReviewIn(BaseModel):
    grade: int = Field(..., ge=0, le=5, description="SM-2 recall quality: 0=blackout, 5=perfect")


# ── Sessions ──────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    session_type: str = "vocab_review"
    duration_mins: Optional[int] = None
    cards_reviewed: int = 0
    cards_correct: int = 0
    notes: Optional[str] = None

class SessionOut(BaseModel):
    id: UUID
    language_id: UUID
    session_type: str
    duration_mins: Optional[int]
    cards_reviewed: int
    cards_correct: int
    notes: Optional[str]
    started_at: datetime
    ended_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ── Stats ─────────────────────────────────────────────────────────────────────

class LanguageStatsOut(BaseModel):
    language_id: UUID
    language_name: str
    total_vocab: int
    due_today: int
    mastered: int           # repetitions >= 5
    new_cards: int          # repetitions == 0
    sessions_this_week: int
    mins_this_week: int
    current_streak_days: int
