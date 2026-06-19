from sqlalchemy import String, Text, Integer, Float, Boolean, Date, DateTime, ForeignKey, func, SmallInteger
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid
from database import Base


class DSACategory(Base):
    __tablename__ = "dsa_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    order_index: Mapped[int | None] = mapped_column(Integer)
    total_problems: Mapped[int | None] = mapped_column(Integer)

    problems: Mapped[list["DSAProblem"]] = relationship("DSAProblem", back_populates="category")


class DSAProblem(Base):
    __tablename__ = "dsa_problems"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    leetcode_id: Mapped[int | None] = mapped_column(Integer)
    leetcode_slug: Mapped[str | None] = mapped_column(String)
    neetcode_category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("dsa_categories.id"))
    title: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str | None] = mapped_column(String)
    difficulty: Mapped[str | None] = mapped_column(String)           # Easy | Medium | Hard
    is_neetcode_150: Mapped[bool] = mapped_column(Boolean, default=False)
    neetcode_order: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, default="unsolved")  # unsolved | attempted | solved | needs_revision
    solution_code: Mapped[str | None] = mapped_column(Text)
    solution_lang: Mapped[str] = mapped_column(String, default="python")
    time_complexity: Mapped[str | None] = mapped_column(String)
    space_complexity: Mapped[str | None] = mapped_column(String)
    time_taken_mins: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    next_revision: Mapped[Date | None] = mapped_column(Date)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    solve_count: Mapped[int] = mapped_column(Integer, default=0)
    last_solved_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    category: Mapped["DSACategory | None"] = relationship("DSACategory", back_populates="problems")
    sessions: Mapped[list["DSASession"]] = relationship("DSASession", back_populates="problem")


class DSASession(Base):
    __tablename__ = "dsa_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    problem_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("dsa_problems.id"))
    started_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    outcome: Mapped[str | None] = mapped_column(String)             # solved | partial | gave_up
    notes: Mapped[str | None] = mapped_column(Text)

    problem: Mapped["DSAProblem | None"] = relationship("DSAProblem", back_populates="sessions")
