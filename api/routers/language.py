from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from database import get_db
from models.language import Language, VocabularyItem, LanguageSession
from schemas.language import (
    LanguageCreate, LanguageUpdate, LanguageOut,
    VocabCreate, VocabUpdate, VocabOut, VocabReviewIn,
    SessionCreate, SessionOut,
    LanguageStatsOut,
)
from services.sm2 import calculate_next_review

router = APIRouter(prefix="/api/v1/language", tags=["language"])

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


# ── Languages ─────────────────────────────────────────────────────────────────

@router.get("/languages", response_model=list[LanguageOut])
async def list_languages(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Language)
        .where(Language.user_id == DEV_USER_ID)
        .order_by(Language.name)
    )
    return result.scalars().all()


@router.post("/languages", response_model=LanguageOut, status_code=status.HTTP_201_CREATED)
async def create_language(body: LanguageCreate, db: AsyncSession = Depends(get_db)):
    lang = Language(user_id=DEV_USER_ID, **body.model_dump())
    db.add(lang)
    await db.flush()
    await db.refresh(lang)
    return lang


@router.patch("/languages/{language_id}", response_model=LanguageOut)
async def update_language(language_id: UUID, body: LanguageUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Language).where(Language.id == language_id, Language.user_id == DEV_USER_ID)
    )
    lang = result.scalar_one_or_none()
    if not lang:
        raise HTTPException(status_code=404, detail="Language not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(lang, field, value)
    await db.flush()
    await db.refresh(lang)
    return lang


@router.delete("/languages/{language_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_language(language_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Language).where(Language.id == language_id, Language.user_id == DEV_USER_ID)
    )
    lang = result.scalar_one_or_none()
    if not lang:
        raise HTTPException(status_code=404, detail="Language not found")
    await db.delete(lang)


# ── Vocabulary ────────────────────────────────────────────────────────────────

@router.get("/languages/{language_id}/vocab", response_model=list[VocabOut])
async def list_vocab(
    language_id: UUID,
    tag: str | None = None,
    q: str | None = None,
    due_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    filters = [VocabularyItem.language_id == language_id, VocabularyItem.user_id == DEV_USER_ID]
    if tag:
        filters.append(VocabularyItem.tags.ilike(f"%{tag}%"))
    if q:
        filters.append(VocabularyItem.word.ilike(f"%{q}%"))
    if due_only:
        today = date.today()
        filters.append(
            (VocabularyItem.next_review == None) | (VocabularyItem.next_review <= today)
        )

    result = await db.execute(
        select(VocabularyItem).where(and_(*filters)).order_by(VocabularyItem.created_at.desc())
    )
    return result.scalars().all()


@router.post("/languages/{language_id}/vocab", response_model=VocabOut, status_code=status.HTTP_201_CREATED)
async def add_vocab(language_id: UUID, body: VocabCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Language).where(Language.id == language_id, Language.user_id == DEV_USER_ID)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Language not found")

    item = VocabularyItem(
        user_id=DEV_USER_ID,
        language_id=language_id,
        next_review=date.today(),
        **body.model_dump(),
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.get("/vocab/{vocab_id}", response_model=VocabOut)
async def get_vocab(vocab_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VocabularyItem).where(VocabularyItem.id == vocab_id, VocabularyItem.user_id == DEV_USER_ID)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Vocab item not found")
    return item


@router.patch("/vocab/{vocab_id}", response_model=VocabOut)
async def update_vocab(vocab_id: UUID, body: VocabUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VocabularyItem).where(VocabularyItem.id == vocab_id, VocabularyItem.user_id == DEV_USER_ID)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Vocab item not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    await db.flush()
    await db.refresh(item)
    return item


@router.delete("/vocab/{vocab_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vocab(vocab_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VocabularyItem).where(VocabularyItem.id == vocab_id, VocabularyItem.user_id == DEV_USER_ID)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Vocab item not found")
    await db.delete(item)


@router.post("/vocab/{vocab_id}/review", response_model=VocabOut)
async def review_vocab(vocab_id: UUID, body: VocabReviewIn, db: AsyncSession = Depends(get_db)):
    """Submit an SM-2 review grade (0-5) for a vocab card."""
    result = await db.execute(
        select(VocabularyItem).where(VocabularyItem.id == vocab_id, VocabularyItem.user_id == DEV_USER_ID)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Vocab item not found")

    next_date, new_reps, new_ef, new_interval = calculate_next_review(
        grade=body.grade,
        repetitions=item.repetitions,
        ease_factor=item.ease_factor,
        interval_days=item.interval_days,
    )

    item.next_review = next_date
    item.repetitions = new_reps
    item.ease_factor = new_ef
    item.interval_days = new_interval
    item.review_count += 1
    item.last_reviewed_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(item)
    return item


# ── Due cards shortcut ────────────────────────────────────────────────────────

@router.get("/languages/{language_id}/due", response_model=list[VocabOut])
async def get_due_cards(language_id: UUID, limit: int = Query(20, le=100), db: AsyncSession = Depends(get_db)):
    """Cards due for review today, ordered by next_review ascending (most overdue first)."""
    today = date.today()
    result = await db.execute(
        select(VocabularyItem)
        .where(
            VocabularyItem.language_id == language_id,
            VocabularyItem.user_id == DEV_USER_ID,
            (VocabularyItem.next_review == None) | (VocabularyItem.next_review <= today),
        )
        .order_by(VocabularyItem.next_review.asc().nulls_first())
        .limit(limit)
    )
    return result.scalars().all()


# ── Sessions ──────────────────────────────────────────────────────────────────

@router.get("/languages/{language_id}/sessions", response_model=list[SessionOut])
async def list_sessions(language_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LanguageSession)
        .where(LanguageSession.language_id == language_id, LanguageSession.user_id == DEV_USER_ID)
        .order_by(LanguageSession.started_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.post("/languages/{language_id}/sessions", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def log_session(language_id: UUID, body: SessionCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Language).where(Language.id == language_id, Language.user_id == DEV_USER_ID)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Language not found")

    session = LanguageSession(user_id=DEV_USER_ID, language_id=language_id, **body.model_dump())
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/languages/{language_id}/stats", response_model=LanguageStatsOut)
async def get_stats(language_id: UUID, db: AsyncSession = Depends(get_db)):
    lang_result = await db.execute(
        select(Language).where(Language.id == language_id, Language.user_id == DEV_USER_ID)
    )
    lang = lang_result.scalar_one_or_none()
    if not lang:
        raise HTTPException(status_code=404, detail="Language not found")

    today = date.today()
    week_ago = today - timedelta(days=7)

    total_q = await db.execute(
        select(func.count(VocabularyItem.id))
        .where(VocabularyItem.language_id == language_id, VocabularyItem.user_id == DEV_USER_ID)
    )
    due_q = await db.execute(
        select(func.count(VocabularyItem.id)).where(
            VocabularyItem.language_id == language_id,
            VocabularyItem.user_id == DEV_USER_ID,
            (VocabularyItem.next_review == None) | (VocabularyItem.next_review <= today),
        )
    )
    mastered_q = await db.execute(
        select(func.count(VocabularyItem.id)).where(
            VocabularyItem.language_id == language_id,
            VocabularyItem.user_id == DEV_USER_ID,
            VocabularyItem.repetitions >= 5,
        )
    )
    new_q = await db.execute(
        select(func.count(VocabularyItem.id)).where(
            VocabularyItem.language_id == language_id,
            VocabularyItem.user_id == DEV_USER_ID,
            VocabularyItem.repetitions == 0,
        )
    )
    sessions_q = await db.execute(
        select(func.count(LanguageSession.id)).where(
            LanguageSession.language_id == language_id,
            LanguageSession.user_id == DEV_USER_ID,
            LanguageSession.started_at >= datetime(week_ago.year, week_ago.month, week_ago.day, tzinfo=timezone.utc),
        )
    )
    mins_q = await db.execute(
        select(func.coalesce(func.sum(LanguageSession.duration_mins), 0)).where(
            LanguageSession.language_id == language_id,
            LanguageSession.user_id == DEV_USER_ID,
            LanguageSession.started_at >= datetime(week_ago.year, week_ago.month, week_ago.day, tzinfo=timezone.utc),
        )
    )

    # Simple streak: count consecutive days with at least one session ending from today backwards
    streak = 0
    check_date = today
    while True:
        day_start = datetime(check_date.year, check_date.month, check_date.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        day_q = await db.execute(
            select(func.count(LanguageSession.id)).where(
                LanguageSession.language_id == language_id,
                LanguageSession.user_id == DEV_USER_ID,
                LanguageSession.started_at >= day_start,
                LanguageSession.started_at < day_end,
            )
        )
        if (day_q.scalar() or 0) == 0:
            break
        streak += 1
        check_date -= timedelta(days=1)
        if streak > 365:
            break

    return LanguageStatsOut(
        language_id=language_id,
        language_name=lang.name,
        total_vocab=total_q.scalar() or 0,
        due_today=due_q.scalar() or 0,
        mastered=mastered_q.scalar() or 0,
        new_cards=new_q.scalar() or 0,
        sessions_this_week=sessions_q.scalar() or 0,
        mins_this_week=int(mins_q.scalar() or 0),
        current_streak_days=streak,
    )
