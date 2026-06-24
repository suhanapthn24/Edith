from langchain_core.tools import tool
from sqlalchemy import select
from database import AsyncSessionLocal
from models import Reminder


@tool
async def create_reminder(message: str, reminder_time: str) -> str:
    """
    Create a reminder.
    message: what to remind the user about
    reminder_time: ISO datetime "YYYY-MM-DDTHH:MM:00"
    Example: reminder_time="2026-06-26T18:00:00"
    """
    async with AsyncSessionLocal() as db:
        reminder = Reminder(
            message=message,
            reminder_time=reminder_time,
            status="pending",
        )
        db.add(reminder)
        await db.commit()
        await db.refresh(reminder)
        return f"Reminder set (ID {reminder.id}): '{reminder.message}' at {reminder.reminder_time}"


@tool
async def list_reminders(status: str = "pending") -> str:
    """
    List reminders.
    status: "pending", "done", or "all"
    """
    async with AsyncSessionLocal() as db:
        q = select(Reminder)
        if status != "all":
            q = q.where(Reminder.status == status)
        q = q.order_by(Reminder.reminder_time)
        result = await db.execute(q)
        reminders = result.scalars().all()

        if not reminders:
            return "No reminders found."

        lines = [
            f"• [{r.id}] {r.message} — {r.reminder_time} [{r.status}]"
            for r in reminders
        ]
        return "\n".join(lines)


@tool
async def complete_reminder(reminder_id: int) -> str:
    """Mark a reminder as done by its ID."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Reminder).where(Reminder.id == reminder_id))
        reminder = result.scalar_one_or_none()
        if not reminder:
            return f"No reminder found with ID {reminder_id}."
        reminder.status = "done"
        await db.commit()
        return f"Reminder [{reminder_id}] marked done: '{reminder.message}'"
