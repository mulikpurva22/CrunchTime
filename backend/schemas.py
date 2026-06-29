from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional, List

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Task Schemas
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    estimated_duration_mins: int = Field(default=60, ge=5, le=43200)
    priority_score: int = Field(default=5, ge=1, le=10)
    deadline: datetime
    status: str = Field(default="Pending")  # Pending, In_Progress, Done
    energy_required: str = Field(default="Medium")  # High, Medium, Low
    tags: Optional[str] = None  # Comma-separated string

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    estimated_duration_mins: Optional[int] = None
    priority_score: Optional[int] = None
    deadline: Optional[datetime] = None
    status: Optional[str] = None
    energy_required: Optional[str] = None
    tags: Optional[str] = None

class TaskResponse(TaskBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Schedule Schemas
class ScheduleBlockBase(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    type: str  # "task", "break", "buffer", "meeting"
    micro_steps: Optional[List[str]] = None

class ScheduleBlockCreate(ScheduleBlockBase):
    task_id: Optional[int] = None

class ScheduleBlockResponse(ScheduleBlockBase):
    id: int
    user_id: int
    task_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class DailyScheduleGenerateResponse(BaseModel):
    schedule: List[ScheduleBlockResponse]

# Alert Schemas
class AlertBase(BaseModel):
    task_id: int
    nudge_text: str
    risk_level: str  # High, Medium, Low
    triggered_at: datetime
    is_read: bool

class AlertResponse(AlertBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
