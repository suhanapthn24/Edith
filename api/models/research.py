from sqlalchemy import String, Text, Integer, Boolean, Date, DateTime, ForeignKey, func, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid
from database import Base


class Paper(Base):
    __tablename__ = "papers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    title: Mapped[str] = mapped_column(String, nullable=False)
    authors: Mapped[str | None] = mapped_column(String)           # comma-separated
    year: Mapped[int | None] = mapped_column(Integer)
    venue: Mapped[str | None] = mapped_column(String)             # journal / conference
    abstract: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String)               # DOI / arXiv link
    pdf_path: Mapped[str | None] = mapped_column(String)          # Supabase storage path
    tags: Mapped[str | None] = mapped_column(String)              # comma-separated
    status: Mapped[str] = mapped_column(String, default="to_read") # to_read | reading | read | archived
    rating: Mapped[int | None] = mapped_column(Integer)           # 1-5
    ai_summary: Mapped[str | None] = mapped_column(Text)
    ai_summary_generated_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    date_added: Mapped[Date | None] = mapped_column(Date)
    date_read: Mapped[Date | None] = mapped_column(Date)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    notes: Mapped[list["PaperNote"]] = relationship("PaperNote", back_populates="paper", cascade="all, delete-orphan")


class PaperNote(Base):
    __tablename__ = "paper_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    page_ref: Mapped[str | None] = mapped_column(String)          # e.g. "p.12" or "§3.2"
    note_type: Mapped[str] = mapped_column(String, default="general")  # general | key_finding | question | critique
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    paper: Mapped["Paper"] = relationship("Paper", back_populates="notes")
