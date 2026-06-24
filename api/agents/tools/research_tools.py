from langchain_core.tools import tool
from sqlalchemy import select, func
import uuid

from database import AsyncSessionLocal
from models.research import Paper

DEV_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@tool
async def get_research_queue() -> str:
    """Get papers currently in the reading queue (to_read and reading statuses)."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Paper)
            .where(Paper.user_id == DEV_USER_ID, Paper.status.in_(["to_read", "reading"]))
            .order_by(Paper.date_added.desc())
            .limit(10)
        )
        papers = result.scalars().all()
        if not papers:
            return "Research queue is empty."

        reading = [p for p in papers if p.status == "reading"]
        to_read = [p for p in papers if p.status == "to_read"]

        lines = []
        if reading:
            lines.append("Currently reading:")
            lines += [f"  - {p.title} ({p.year or 'n/a'})" for p in reading]
        if to_read:
            lines.append(f"Up next ({len(to_read)} papers):")
            lines += [f"  - {p.title} ({p.year or 'n/a'})" for p in to_read[:5]]

        return "\n".join(lines)


@tool
async def get_research_stats() -> str:
    """Get overall research stats: total papers, read vs unread, papers with AI summaries."""
    async with AsyncSessionLocal() as db:
        total = await db.scalar(select(func.count(Paper.id)).where(Paper.user_id == DEV_USER_ID))
        read = await db.scalar(
            select(func.count(Paper.id)).where(Paper.user_id == DEV_USER_ID, Paper.status == "read")
        )
        summarized = await db.scalar(
            select(func.count(Paper.id)).where(
                Paper.user_id == DEV_USER_ID, Paper.ai_summary != None
            )
        )
        if not total:
            return "No papers in the research vault yet."
        return f"Research vault: {total} papers, {read} read, {summarized} AI-summarized"
