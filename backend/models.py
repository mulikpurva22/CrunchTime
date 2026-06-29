import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now)

    tasks = relationship("Task", back_populates="owner", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="user", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="user", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    estimated_duration_mins = Column(Integer, nullable=False, default=60)
    priority_score = Column(Integer, nullable=False, default=5)  # 1-10
    deadline = Column(DateTime, nullable=False)
    status = Column(String, nullable=False, default="Pending")  # Pending, In_Progress, Done
    energy_required = Column(String, nullable=False, default="Medium")  # High, Medium, Low
    tags = Column(String, nullable=True)  # Store as comma-separated values (e.g. "work,coding")
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)

    owner = relationship("User", back_populates="tasks")
    schedules = relationship("Schedule", back_populates="task", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="task", cascade="all, delete-orphan")

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    
    title = Column(String, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    type = Column(String, nullable=False)  # "task", "break", "buffer", "meeting"
    micro_steps = Column(Text, nullable=True)  # JSON serialized list of steps
    created_at = Column(DateTime, default=datetime.datetime.now)

    user = relationship("User", back_populates="schedules")
    task = relationship("Task", back_populates="schedules")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    
    nudge_text = Column(Text, nullable=False)
    risk_level = Column(String, nullable=False, default="Medium")  # High, Medium, Low
    triggered_at = Column(DateTime, default=datetime.datetime.now)
    is_read = Column(Boolean, default=False)

    user = relationship("User", back_populates="alerts")
    task = relationship("Task", back_populates="alerts")
