from langchain_core.tools import tool
from sqlalchemy import select, func
from datetime import date
import uuid

from database import AsyncSessionLocal
from models.language import Language, VocabularyItem, LanguageSession

DEV_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@tool
async def get_language_progress() -> str:
    """Get language learning progress across all active languages: vocab size, due cards, CEFR level."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Language).where(Language.user_id == DEV_USER_ID, Language.is_active == True)
        )
        languages = result.scalars().all()
        if not languages:
            return "No active languages set up yet."

        lines = []
        for lang in languages:
            total = await db.scalar(
                select(func.count(VocabularyItem.id)).where(VocabularyItem.language_id == lang.id)
            )
            due = await db.scalar(
                select(func.count(VocabularyItem.id)).where(
                    VocabularyItem.language_id == lang.id,
                    VocabularyItem.next_review <= date.today(),
                )
            )
            mastered = await db.scalar(
                select(func.count(VocabularyItem.id)).where(
                    VocabularyItem.language_id == lang.id,
                    VocabularyItem.repetitions >= 5,
                )
            )
            lines.append(
                f"- {lang.name} ({lang.cefr_level or 'A1'}): "
                f"{total} words total, {mastered} mastered, {due} due today"
            )

        return "Language progress:\n" + "\n".join(lines)


@tool
async def get_vocab_due(language_name: str) -> str:
    """Get vocabulary cards due for spaced-repetition review in a specific language. Pass the language name e.g. 'French'."""
    async with AsyncSessionLocal() as db:
        lang_result = await db.execute(
            select(Language).where(
                Language.user_id == DEV_USER_ID,
                Language.name.ilike(f"%{language_name}%"),
            )
        )
        lang = lang_result.scalar_one_or_none()
        if not lang:
            return f"No language matching '{language_name}' found."

        result = await db.execute(
            select(VocabularyItem)
            .where(
                VocabularyItem.language_id == lang.id,
                VocabularyItem.next_review <= date.today(),
            )
            .order_by(VocabularyItem.next_review)
            .limit(15)
        )
        items = result.scalars().all()
        if not items:
            return f"No {lang.name} vocab due today. You're on track."

        lines = [f"- {i.word} → {i.translation}" for i in items]
        return f"{len(items)} {lang.name} words due:\n" + "\n".join(lines)


@tool
async def get_language_sessions_this_week(language_name: str) -> str:
    """Get a summary of language study sessions this week for a given language."""
    from datetime import datetime, timedelta, timezone

    async with AsyncSessionLocal() as db:
        lang_result = await db.execute(
            select(Language).where(
                Language.user_id == DEV_USER_ID,
                Language.name.ilike(f"%{language_name}%"),
            )
        )
        lang = lang_result.scalar_one_or_none()
        if not lang:
            return f"No language matching '{language_name}' found."

        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        result = await db.execute(
            select(LanguageSession).where(
                LanguageSession.language_id == lang.id,
                LanguageSession.started_at >= week_ago,
            )
        )
        sessions = result.scalars().all()
        if not sessions:
            return f"No {lang.name} sessions logged this week."

        total_mins = sum(s.duration_mins or 0 for s in sessions)
        total_cards = sum(s.cards_reviewed for s in sessions)
        correct = sum(s.cards_correct for s in sessions)
        accuracy = round((correct / max(total_cards, 1)) * 100)
        return (
            f"{lang.name} this week: {len(sessions)} sessions, "
            f"{total_mins} mins studied, {total_cards} cards reviewed ({accuracy}% correct)"
        )
