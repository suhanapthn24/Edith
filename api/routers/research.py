from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, cast, Date
from datetime import date, timedelta
from uuid import UUID

from database import get_db
from models.research import Paper, PaperNote
from schemas.research import (
    PaperCreate, PaperUpdate, PaperOut, PaperListOut,
    PaperNoteCreate, PaperNoteUpdate, PaperNoteOut,
    ResearchStatsOut,
)

router = APIRouter(prefix="/api/v1/research", tags=["research"])

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


# ── Papers ────────────────────────────────────────────────────────────────────

@router.get("/papers", response_model=list[PaperListOut])
async def list_papers(
    status_filter: str | None = Query(None, alias="status"),
    tag: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    filters = [Paper.user_id == DEV_USER_ID]
    if status_filter:
        filters.append(Paper.status == status_filter)
    if tag:
        filters.append(Paper.tags.ilike(f"%{tag}%"))
    if q:
        filters.append(Paper.title.ilike(f"%{q}%"))

    result = await db.execute(
        select(Paper)
        .where(and_(*filters))
        .order_by(Paper.created_at.desc())
    )
    papers = result.scalars().all()

    out = []
    for p in papers:
        note_count_q = await db.execute(
            select(func.count(PaperNote.id)).where(PaperNote.paper_id == p.id)
        )
        out.append(PaperListOut(
            id=p.id, title=p.title, authors=p.authors, year=p.year,
            venue=p.venue, tags=p.tags, status=p.status, rating=p.rating,
            ai_summary=p.ai_summary, date_added=p.date_added, date_read=p.date_read,
            note_count=note_count_q.scalar() or 0,
        ))
    return out


@router.post("/papers", response_model=PaperOut, status_code=status.HTTP_201_CREATED)
async def create_paper(body: PaperCreate, db: AsyncSession = Depends(get_db)):
    paper = Paper(
        user_id=DEV_USER_ID,
        date_added=body.date_added or date.today(),
        **body.model_dump(exclude={"date_added"}),
    )
    db.add(paper)
    await db.flush()
    await db.refresh(paper, ["notes"])
    return paper


@router.get("/papers/{paper_id}", response_model=PaperOut)
async def get_paper(paper_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Paper).where(Paper.id == paper_id, Paper.user_id == DEV_USER_ID)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    await db.refresh(paper, ["notes"])
    return paper


@router.patch("/papers/{paper_id}", response_model=PaperOut)
async def update_paper(paper_id: UUID, body: PaperUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Paper).where(Paper.id == paper_id, Paper.user_id == DEV_USER_ID)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(paper, field, value)

    if body.status == "read" and not paper.date_read:
        paper.date_read = date.today()

    await db.flush()
    await db.refresh(paper, ["notes"])
    return paper


@router.delete("/papers/{paper_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_paper(paper_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Paper).where(Paper.id == paper_id, Paper.user_id == DEV_USER_ID)
    )
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    await db.delete(paper)


# ── Notes ─────────────────────────────────────────────────────────────────────

@router.get("/papers/{paper_id}/notes", response_model=list[PaperNoteOut])
async def list_notes(paper_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PaperNote)
        .where(PaperNote.paper_id == paper_id, PaperNote.user_id == DEV_USER_ID)
        .order_by(PaperNote.created_at)
    )
    return result.scalars().all()


@router.post("/papers/{paper_id}/notes", response_model=PaperNoteOut, status_code=status.HTTP_201_CREATED)
async def add_note(paper_id: UUID, body: PaperNoteCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Paper).where(Paper.id == paper_id, Paper.user_id == DEV_USER_ID)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Paper not found")

    note = PaperNote(paper_id=paper_id, user_id=DEV_USER_ID, **body.model_dump())
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return note


@router.patch("/notes/{note_id}", response_model=PaperNoteOut)
async def update_note(note_id: UUID, body: PaperNoteUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PaperNote).where(PaperNote.id == note_id, PaperNote.user_id == DEV_USER_ID)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(note, field, value)
    await db.flush()
    await db.refresh(note)
    return note


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PaperNote).where(PaperNote.id == note_id, PaperNote.user_id == DEV_USER_ID)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=ResearchStatsOut)
async def get_stats(db: AsyncSession = Depends(get_db)):
    week_ago = date.today() - timedelta(days=7)

    counts = {}
    for s in ["to_read", "reading", "read", "archived"]:
        q = await db.execute(
            select(func.count(Paper.id)).where(Paper.user_id == DEV_USER_ID, Paper.status == s)
        )
        counts[s] = q.scalar() or 0

    total_q = await db.execute(select(func.count(Paper.id)).where(Paper.user_id == DEV_USER_ID))
    week_q = await db.execute(
        select(func.count(Paper.id)).where(
            Paper.user_id == DEV_USER_ID,
            Paper.status == "read",
            Paper.date_read >= week_ago,
        )
    )
    avg_q = await db.execute(
        select(func.avg(Paper.rating)).where(
            Paper.user_id == DEV_USER_ID, Paper.rating.is_not(None)
        )
    )

    return ResearchStatsOut(
        total=total_q.scalar() or 0,
        to_read=counts["to_read"],
        reading=counts["reading"],
        read=counts["read"],
        archived=counts["archived"],
        this_week=week_q.scalar() or 0,
        avg_rating=round(float(avg_q.scalar()), 1) if avg_q.scalar() else None,
    )
