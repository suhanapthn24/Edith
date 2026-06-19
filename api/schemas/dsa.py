from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime, date


class DSACategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    order_index: Optional[int]
    total_problems: Optional[int]


class DSAProblemCreate(BaseModel):
    leetcode_id: Optional[int] = None
    leetcode_slug: Optional[str] = None
    neetcode_category_id: Optional[UUID] = None
    title: str
    url: Optional[str] = None
    difficulty: Optional[str] = None
    is_neetcode_150: bool = False
    neetcode_order: Optional[int] = None
    solution_code: Optional[str] = None
    solution_lang: str = "python"
    notes: Optional[str] = None


class DSAProblemUpdate(BaseModel):
    status: Optional[str] = None
    solution_code: Optional[str] = None
    solution_lang: Optional[str] = None
    time_complexity: Optional[str] = None
    space_complexity: Optional[str] = None
    time_taken_mins: Optional[int] = None
    notes: Optional[str] = None


class DSAProblemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    leetcode_id: Optional[int]
    leetcode_slug: Optional[str]
    neetcode_category_id: Optional[UUID]
    title: str
    url: Optional[str]
    difficulty: Optional[str]
    is_neetcode_150: bool
    neetcode_order: Optional[int]
    status: str
    solution_lang: str
    time_complexity: Optional[str]
    space_complexity: Optional[str]
    time_taken_mins: Optional[int]
    notes: Optional[str]
    next_revision: Optional[date]
    ease_factor: float
    repetitions: int
    interval_days: int
    solve_count: int
    last_solved_at: Optional[datetime]
    created_at: datetime


class SM2ReviewRequest(BaseModel):
    grade: int   # 0–5 (SM-2 quality: 0=blackout, 5=perfect)


class DSAStatsOut(BaseModel):
    total_problems: int
    solved: int
    neetcode_150_solved: int
    needs_revision: int
    by_category: list[dict]
