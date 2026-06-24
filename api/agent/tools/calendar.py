from langchain_core.tools import tool
from sqlalchemy import select
from database import AsyncSessionLocal
from models import Event


@tool
async def create_event(
    title: str,
    start_time: str,
    end_time: str = "",
    description: str = "",
) -> str:
    """
    Create a calendar event.
    start_time: ISO datetime "YYYY-MM-DDTHH:MM:00"
    end_time: ISO datetime or empty string
    Example: start_time="2026-06-27T15:00:00", end_time="2026-06-27T16:00:00"
    """
    async with AsyncSessionLocal() as db:
        event = Event(
            title=title,
            start_time=start_time,
            end_time=end_time or None,
            description=description or None,
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        end = f" → {event.end_time}" if event.end_time else ""
        return f"Event created (ID {event.id}): '{event.title}' on {event.start_time}{end}"


@tool
async def list_events(date_filter: str = "") -> str:
    """
    List calendar events.
    date_filter: ISO date prefix to filter by date, e.g. "2026-06-27" for that day,
    "2026-06-" for the month, or empty for all upcoming events.
    """
    async with AsyncSessionLocal() as db:
        q = select(Event).order_by(Event.start_time)
        if date_filter:
            q = q.where(Event.start_time.like(f"{date_filter}%"))
        result = await db.execute(q)
        events = result.scalars().all()

        if not events:
            return "No events found."

        lines = []
        for e in events:
            end = f" → {e.end_time}" if e.end_time else ""
            desc = f" — {e.description}" if e.description else ""
            lines.append(f"• [{e.id}] {e.start_time}{end}: {e.title}{desc}")
        return "\n".join(lines)


@tool
async def delete_event(event_id: int) -> str:
    """Delete a calendar event by its ID."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Event).where(Event.id == event_id))
        event = result.scalar_one_or_none()
        if not event:
            return f"No event found with ID {event_id}."
        await db.delete(event)
        await db.commit()
        return f"Deleted event: '{event.title}'"


@tool
async def update_event(
    event_id: int,
    title: str = "",
    start_time: str = "",
    end_time: str = "",
    description: str = "",
) -> str:
    """Update a calendar event. Only pass fields you want to change."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Event).where(Event.id == event_id))
        event = result.scalar_one_or_none()
        if not event:
            return f"No event found with ID {event_id}."
        if title:
            event.title = title
        if start_time:
            event.start_time = start_time
        if end_time:
            event.end_time = end_time
        if description:
            event.description = description
        await db.commit()
        return f"Updated event [{event_id}]: '{event.title}' at {event.start_time}"
