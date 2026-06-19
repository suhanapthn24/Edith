from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import date, datetime


# ── Paper Notes ───────────────────────────────────────────────────────────────

class PaperNoteCreate(BaseModel):
    content: str
    page_ref: Optional[str] = None
    note_type: str = "general"   # general | key_finding | question | critique

class PaperNoteUpdate(BaseModel):
    content: Optional[str] = None
    page_ref: Optional[str] = None
    note_type: Optional[str] = None

class PaperNoteOut(BaseModel):
    id: UUID
    paper_id: UUID
    content: str
    page_ref: Optional[str]
    note_type: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Papers ────────────────────────────────────────────────────────────────────

class PaperCreate(BaseModel):
    title: str
    authors: Optional[str] = None
    year: Optional[int] = Field(None, ge=1900, le=2100)
    venue: Optional[str] = None
    abstract: Optional[str] = None
    url: Optional[str] = None
    tags: Optional[str] = None
    status: str = "to_read"
    rating: Optional[int] = Field(None, ge=1, le=5)
    date_added: Optional[date] = None
    date_read: Optional[date] = None

class PaperUpdate(BaseModel):
    title: Optional[str] = None
    authors: Optional[str] = None
    year: Optional[int] = None
    venue: Optional[str] = None
    abstract: Optional[str] = None
    url: Optional[str] = None
    tags: Optional[str] = None
    status: Optional[str] = None
    rating: Optional[int] = None
    date_read: Optional[date] = None

class PaperOut(BaseModel):
    id: UUID
    title: str
    authors: Optional[str]
    year: Optional[int]
    venue: Optional[str]
    abstract: Optional[str]
    url: Optional[str]
    pdf_path: Optional[str]
    tags: Optional[str]
    status: str
    rating: Optional[int]
    ai_summary: Optional[str]
    ai_summary_generated_at: Optional[datetime]
    date_added: Optional[date]
    date_read: Optional[date]
    created_at: datetime
    notes: list[PaperNoteOut] = []

    model_config = {"from_attributes": True}

class PaperListOut(BaseModel):
    id: UUID
    title: str
    authors: Optional[str]
    year: Optional[int]
    venue: Optional[str]
    tags: Optional[str]
    status: str
    rating: Optional[int]
    ai_summary: Optional[str]
    date_added: Optional[date]
    date_read: Optional[date]
    note_count: int = 0

    model_config = {"from_attributes": True}


# ── Stats ─────────────────────────────────────────────────────────────────────

class ResearchStatsOut(BaseModel):
    total: int
    to_read: int
    reading: int
    read: int
    archived: int
    this_week: int
    avg_rating: Optional[float]
