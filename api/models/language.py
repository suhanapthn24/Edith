from sqlalchemy import String, Text, Integer, Float, Boolean, Date, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid
from database import Base


class Language(Base):
    __tablename__ = "languages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)           # e.g. "French"
    code: Mapped[str] = mapped_column(String, nullable=False)           # e.g. "fr"
    cefr_level: Mapped[str | None] = mapped_column(String)              # A1 A2 B1 B2 C1 C2
    daily_goal_mins: Mapped[int] = mapped_column(Integer, default=15)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    vocab_items: Mapped[list["VocabularyItem"]] = relationship("VocabularyItem", back_populates="language", cascade="all, delete-orphan")
    sessions: Mapped[list["LanguageSession"]] = relationship("LanguageSession", back_populates="language", cascade="all, delete-orphan")


class VocabularyItem(Base):
    __tablename__ = "vocabulary_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    language_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("languages.id", ondelete="CASCADE"), nullable=False)

    word: Mapped[str] = mapped_column(String, nullable=False)           # target language word
    translation: Mapped[str] = mapped_column(String, nullable=False)    # native language meaning
    pronunciation: Mapped[str | None] = mapped_column(String)           # IPA or phonetic hint
    example_sentence: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[str | None] = mapped_column(String)                    # comma-separated (verb, noun, A1…)
    gender: Mapped[str | None] = mapped_column(String)                  # m / f / n (for gendered languages)

    # SM-2 fields
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    next_review: Mapped[Date | None] = mapped_column(Date)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    last_reviewed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    language: Mapped["Language"] = relationship("Language", back_populates="vocab_items")


class LanguageSession(Base):
    __tablename__ = "language_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    language_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("languages.id", ondelete="CASCADE"), nullable=False)

    session_type: Mapped[str] = mapped_column(String, default="vocab_review")  # vocab_review | reading | listening | speaking | writing
    duration_mins: Mapped[int | None] = mapped_column(Integer)
    cards_reviewed: Mapped[int] = mapped_column(Integer, default=0)
    cards_correct: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    language: Mapped["Language"] = relationship("Language", back_populates="sessions")
