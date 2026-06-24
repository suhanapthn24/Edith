from datetime import datetime
from langchain_core.tools import tool
from sqlalchemy import select, or_
from database import AsyncSessionLocal
from models import Task


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")


@tool
async def create_task(
    title: str,
    description: str = "",
    due_date: str = "",
    priority: str = "medium",
) -> str:
    """
    Create a new task.
    priority: "low", "medium", or "high"
    due_date: ISO date string "YYYY-MM-DD", or empty string if none
    """
    async with AsyncSessionLocal() as db:
        task = Task(
            title=title,
            description=description or None,
            due_date=due_date or None,
            priority=priority,
            status="todo",
            created_at=_now(),
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)
        due = f", due {task.due_date}" if task.due_date else ""
        return f"Task created (ID {task.id}): '{task.title}'{due} [{task.priority} priority]"


@tool
async def list_tasks(status: str = "active", priority: str = "") -> str:
    """
    List tasks.
    status: "active" (todo + in_progress), "done", or "all"
    priority: "low", "medium", "high", or empty for all
    """
    async with AsyncSessionLocal() as db:
        q = select(Task)
        if status == "active":
            q = q.where(Task.status.in_(["todo", "in_progress"]))
        elif status == "done":
            q = q.where(Task.status == "done")
        if priority:
            q = q.where(Task.priority == priority)
        q = q.order_by(
            Task.due_date.nulls_last(),
            Task.priority.desc(),
        )
        result = await db.execute(q)
        tasks = result.scalars().all()

        if not tasks:
            return "No tasks found."

        PRIO_ICON = {"high": "🔴", "medium": "🟡", "low": "🟢"}
        lines = []
        for t in tasks:
            icon = PRIO_ICON.get(t.priority, "⚪")
            due = f" — due {t.due_date}" if t.due_date else ""
            st = f" [{t.status}]" if t.status != "todo" else ""
            lines.append(f"• [{t.id}] {icon} {t.title}{due}{st}")
        return "\n".join(lines)


@tool
async def complete_task(task_id: int) -> str:
    """Mark a task as done by its ID. Get the ID from list_tasks first."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return f"No task found with ID {task_id}."
        task.status = "done"
        await db.commit()
        return f"Done: '{task.title}' marked as completed."


@tool
async def update_task(
    task_id: int,
    title: str = "",
    description: str = "",
    due_date: str = "",
    priority: str = "",
    status: str = "",
) -> str:
    """
    Update a task's fields. Only pass the fields you want to change.
    status: "todo", "in_progress", or "done"
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return f"No task found with ID {task_id}."
        if title:
            task.title = title
        if description:
            task.description = description
        if due_date:
            task.due_date = due_date
        if priority:
            task.priority = priority
        if status:
            task.status = status
        await db.commit()
        return f"Updated task [{task_id}]: '{task.title}'"


@tool
async def delete_task(task_id: int) -> str:
    """Permanently delete a task by its ID."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return f"No task found with ID {task_id}."
        await db.delete(task)
        await db.commit()
        return f"Deleted task: '{task.title}'"
