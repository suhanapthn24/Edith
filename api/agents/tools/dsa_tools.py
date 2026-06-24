from langchain_core.tools import tool
from sqlalchemy import select, func, and_
from datetime import date
import uuid

from database import AsyncSessionLocal
from models.dsa import DSACategory, DSAProblem

DEV_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@tool
async def get_dsa_progress() -> str:
    """Get current NeetCode 150 DSA progress: problems solved, difficulty breakdown, and how many are due for spaced-repetition revision today."""
    async with AsyncSessionLocal() as db:
        solved = await db.scalar(
            select(func.count(DSAProblem.id)).where(
                DSAProblem.user_id == DEV_USER_ID,
                DSAProblem.is_neetcode_150 == True,
                DSAProblem.status == "solved",
            )
        )
        total = await db.scalar(
            select(func.count(DSAProblem.id)).where(
                DSAProblem.user_id == DEV_USER_ID,
                DSAProblem.is_neetcode_150 == True,
            )
        )
        due = await db.scalar(
            select(func.count(DSAProblem.id)).where(
                DSAProblem.user_id == DEV_USER_ID,
                DSAProblem.status == "solved",
                DSAProblem.next_revision <= date.today(),
            )
        )
        if not total:
            return "NeetCode 150 not seeded yet. Run: python scripts/seed_neetcode.py"
        return (
            f"NeetCode 150: {solved}/{total} solved "
            f"({round((solved / total) * 100)}%). "
            f"{due} problems due for revision today."
        )


@tool
async def get_dsa_problems_due() -> str:
    """Get the DSA problems due for spaced-repetition review today, ordered by next revision date."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(DSAProblem)
            .where(
                DSAProblem.user_id == DEV_USER_ID,
                DSAProblem.status == "solved",
                DSAProblem.next_revision <= date.today(),
            )
            .order_by(DSAProblem.next_revision)
            .limit(10)
        )
        problems = result.scalars().all()
        if not problems:
            return "No DSA problems due for review today. You're caught up."
        lines = [
            f"- {p.title} ({p.difficulty or 'unknown'}) — last interval: {p.interval_days}d"
            for p in problems
        ]
        return f"{len(problems)} problems due:\n" + "\n".join(lines)


@tool
async def get_next_dsa_problem() -> str:
    """Get the next unsolved NeetCode 150 problem to tackle, in roadmap order."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(DSAProblem)
            .where(
                DSAProblem.user_id == DEV_USER_ID,
                DSAProblem.is_neetcode_150 == True,
                DSAProblem.status == "unsolved",
            )
            .order_by(DSAProblem.neetcode_order.nulls_last())
            .limit(1)
        )
        p = result.scalar_one_or_none()
        if not p:
            return "All NeetCode 150 problems solved or attempted. Impressive."
        url = f"https://leetcode.com/problems/{p.leetcode_slug}/" if p.leetcode_slug else "no link"
        return (
            f"Next problem: #{p.neetcode_order} {p.title} ({p.difficulty or '?'})\n"
            f"URL: {url}"
        )


@tool
async def get_dsa_weak_categories() -> str:
    """Identify DSA categories where the user has solved the fewest problems — the weak spots."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(DSACategory).order_by(DSACategory.order_index))
        categories = result.scalars().all()
        if not categories:
            return "No categories seeded yet."

        lines = []
        for cat in categories:
            solved_count = await db.scalar(
                select(func.count(DSAProblem.id)).where(
                    DSAProblem.user_id == DEV_USER_ID,
                    DSAProblem.neetcode_category_id == cat.id,
                    DSAProblem.status == "solved",
                )
            )
            total = cat.total_problems or 0
            lines.append((cat.name, solved_count or 0, total))

        lines.sort(key=lambda x: x[1] / max(x[2], 1))
        top5 = lines[:5]
        out = "\n".join(f"- {name}: {s}/{t} solved" for name, s, t in top5)
        return f"Weakest categories:\n{out}"
