from sqlalchemy import Column, Integer, String, Text
from database import Base


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    due_date = Column(String)
    priority = Column(String, default="medium")
    status = Column(String, default="todo")
    created_at = Column(String)


class Reminder(Base):
    __tablename__ = "reminders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    message = Column(Text, nullable=False)
    reminder_time = Column(String)
    status = Column(String, default="pending")


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String)
    description = Column(Text)


class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    phone = Column(String)
    email = Column(String)
    notes = Column(Text)


class Preference(Base):
    __tablename__ = "preferences"
    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
