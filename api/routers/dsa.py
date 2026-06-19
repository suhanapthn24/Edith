from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import date
from uuid import UUID

from database import get_db
from models.dsa import DSACategory, DSAProblem, DSASession
from schemas.dsa import (
    DSACategoryOut,
    DSAProblemCreate,
    DSAProblemUpdate,
    DSAProblemOut,
    SM2ReviewRequest,
    DSAStatsOut,
)
from services.sm2 import calculate_next_review

router = APIRouter(prefix="/api/v1/dsa", tags=["dsa"])

# ── Temporary: hardcoded user_id for dev (replace with Clerk JWT middleware) ──
DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[DSACategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DSACategory).order_by(DSACategory.order_index))
    return result.scalars().all()


# ── Problems ──────────────────────────────────────────────────────────────────

@router.get("/problems", response_model=list[DSAProblemOut])
async def list_problems(
    category_id: UUID | None = None,
    status: str | None = None,
    difficulty: str | None = None,
    neetcode_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    filters = [DSAProblem.user_id == DEV_USER_ID]
    if category_id:
        filters.append(DSAProblem.neetcode_category_id == category_id)
    if status:
        filters.append(DSAProblem.status == status)
    if difficulty:
        filters.append(DSAProblem.difficulty == difficulty)
    if neetcode_only:
        filters.append(DSAProblem.is_neetcode_150 == True)

    result = await db.execute(
        select(DSAProblem)
        .where(and_(*filters))
        .order_by(DSAProblem.neetcode_order.nulls_last(), DSAProblem.created_at)
    )
    return result.scalars().all()


@router.post("/problems", response_model=DSAProblemOut, status_code=status.HTTP_201_CREATED)
async def create_problem(body: DSAProblemCreate, db: AsyncSession = Depends(get_db)):
    problem = DSAProblem(user_id=DEV_USER_ID, **body.model_dump())
    db.add(problem)
    await db.flush()
    await db.refresh(problem)
    return problem


@router.get("/problems/{problem_id}", response_model=DSAProblemOut)
async def get_problem(problem_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DSAProblem).where(
            DSAProblem.id == problem_id,
            DSAProblem.user_id == DEV_USER_ID,
        )
    )
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem


@router.patch("/problems/{problem_id}", response_model=DSAProblemOut)
async def update_problem(
    problem_id: UUID,
    body: DSAProblemUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DSAProblem).where(
            DSAProblem.id == problem_id,
            DSAProblem.user_id == DEV_USER_ID,
        )
    )
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(problem, field, value)

    await db.flush()
    await db.refresh(problem)
    return problem


# ── Mark Solved + SM-2 ────────────────────────────────────────────────────────

@router.post("/problems/{problem_id}/solve", response_model=DSAProblemOut)
async def mark_solved(
    problem_id: UUID,
    body: SM2ReviewRequest,
    db: AsyncSession = Depends(get_db),
):
    """Mark a problem as solved and apply SM-2 spaced repetition scheduling."""
    result = await db.execute(
        select(DSAProblem).where(
            DSAProblem.id == problem_id,
            DSAProblem.user_id == DEV_USER_ID,
        )
    )
    problem = result.scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    next_date, new_reps, new_ef, new_interval = calculate_next_review(
        grade=body.grade,
        repetitions=problem.repetitions,
        ease_factor=problem.ease_factor,
        interval_days=problem.interval_days,
    )

    problem.status = "solved" if body.grade >= 3 else "needs_revision"
    problem.next_revision = next_date
    problem.repetitions = new_reps
    problem.ease_factor = new_ef
    problem.interval_days = new_interval
    problem.solve_count = (problem.solve_count or 0) + 1

    from datetime import datetime, timezone
    problem.last_solved_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(problem)
    return problem


# ── Due for revision ──────────────────────────────────────────────────────────

@router.get("/due", response_model=list[DSAProblemOut])
async def get_due_problems(db: AsyncSession = Depends(get_db)):
    """Problems where next_revision <= today (SM-2 due for review)."""
    today = date.today()
    result = await db.execute(
        select(DSAProblem).where(
            DSAProblem.user_id == DEV_USER_ID,
            DSAProblem.next_revision <= today,
            DSAProblem.status != "unsolved",
        ).order_by(DSAProblem.next_revision)
    )
    return result.scalars().all()


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=DSAStatsOut)
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_q = await db.execute(
        select(func.count(DSAProblem.id)).where(DSAProblem.user_id == DEV_USER_ID)
    )
    solved_q = await db.execute(
        select(func.count(DSAProblem.id)).where(
            DSAProblem.user_id == DEV_USER_ID,
            DSAProblem.status == "solved",
        )
    )
    nc150_solved_q = await db.execute(
        select(func.count(DSAProblem.id)).where(
            DSAProblem.user_id == DEV_USER_ID,
            DSAProblem.is_neetcode_150 == True,
            DSAProblem.status == "solved",
        )
    )
    revision_q = await db.execute(
        select(func.count(DSAProblem.id)).where(
            DSAProblem.user_id == DEV_USER_ID,
            DSAProblem.status == "needs_revision",
        )
    )

    # Per-category breakdown
    categories_result = await db.execute(
        select(DSACategory).order_by(DSACategory.order_index)
    )
    categories = categories_result.scalars().all()

    by_category = []
    for cat in categories:
        cat_solved_q = await db.execute(
            select(func.count(DSAProblem.id)).where(
                DSAProblem.user_id == DEV_USER_ID,
                DSAProblem.neetcode_category_id == cat.id,
                DSAProblem.status == "solved",
            )
        )
        by_category.append({
            "id": str(cat.id),
            "name": cat.name,
            "total": cat.total_problems or 0,
            "solved": cat_solved_q.scalar() or 0,
            "order": cat.order_index,
        })

    return DSAStatsOut(
        total_problems=total_q.scalar() or 0,
        solved=solved_q.scalar() or 0,
        neetcode_150_solved=nc150_solved_q.scalar() or 0,
        needs_revision=revision_q.scalar() or 0,
        by_category=by_category,
    )
