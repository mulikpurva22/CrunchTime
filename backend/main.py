import os
import json
import datetime
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from pydantic import BaseModel
import httpx

# Load local environment variables from .env if present
load_dotenv()

from backend import models, schemas
from backend.database import engine, get_db
from backend.scheduler import generate_daily_schedule, get_mock_calendar_events, parse_bulk_tasks
from backend.scheduler_worker import start_worker, stop_worker, evaluate_deadlines

# Initialize database tables
models.Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start the background schedule worker
    start_worker()
    
    # Create default user if not exists for easy testing/demoing
    db = next(get_db())
    default_user = db.query(models.User).filter(models.User.email == "demo@crunchtime.ai").first()
    if not default_user:
        # Simple default password hashing simulation
        default_user = models.User(
            email="demo@crunchtime.ai",
            name="Demo User",
            hashed_password="hashed_demo_password"
        )
        db.add(default_user)
        db.commit()
        db.refresh(default_user)
        print(f"Created default demo user: {default_user.email} (ID: {default_user.id})")
    
    yield
    # Shutdown: Stop the background worker
    stop_worker()

app = FastAPI(
    title="CrunchTime API",
    description="Backend and AI orchestrator for the CrunchTime proactive productivity companion.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HELPER: Get current demo user.
# In a real app, this would use OAuth2/JWT tokens, but for rapid prototyping and local testing,
# we default to the first user or create/use the demo user.
def get_current_user_id(db: Session = Depends(get_db)) -> int:
    user = db.query(models.User).filter(models.User.email == "demo@crunchtime.ai").first()
    if not user:
        # Fallback if DB was reset
        user = models.User(
            email="demo@crunchtime.ai",
            name="Demo User",
            hashed_password="hashed_demo_password"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user.id


@app.get("/")
def read_root():
    return {"message": "Welcome to the CrunchTime API. Visit /docs for documentation."}


# ==========================================
# TASK ENDPOINTS (CRUD)
# ==========================================

@app.post("/tasks", response_model=schemas.TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    db_task = models.Task(**task.model_dump(), user_id=user_id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


class BulkTaskInput(BaseModel):
    text: str


@app.post("/tasks/bulk", response_model=List[schemas.TaskResponse], status_code=status.HTTP_201_CREATED)
def create_tasks_bulk(payload: BulkTaskInput, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    """
    Parses a raw text description containing multiple tasks,
    creates them in the database, and returns the lists.
    """
    try:
        tasks_data = parse_bulk_tasks(payload.text)
        created_tasks = []
        for task_dict in tasks_data:
            deadline_str = task_dict.get("deadline")
            deadline_dt = datetime.datetime.fromisoformat(deadline_str) if deadline_str else datetime.datetime.combine(datetime.date.today(), datetime.time(23, 59, 0))
            db_task = models.Task(
                title=task_dict.get("title", "Unnamed Task"),
                description=task_dict.get("description"),
                estimated_duration_mins=task_dict.get("estimated_duration_mins", 60),
                priority_score=task_dict.get("priority_score", 5),
                deadline=deadline_dt,
                status="Pending",
                energy_required=task_dict.get("energy_required", "Medium"),
                user_id=user_id
            )
            db.add(db_task)
            created_tasks.append(db_task)
        db.commit()
        for t in created_tasks:
            db.refresh(t)
        return created_tasks
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to parse bulk tasks: {str(e)}")


@app.get("/tasks", response_model=List[schemas.TaskResponse])
def get_tasks(status: Optional[str] = None, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    query = db.query(models.Task).filter(models.Task.user_id == user_id)
    if status:
        query = query.filter(models.Task.status == status)
    return query.order_by(models.Task.deadline.asc()).all()


@app.get("/tasks/{task_id}", response_model=schemas.TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.put("/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_task(task_id: int, task_update: schemas.TaskUpdate, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == user_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    update_data = task_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)
        
    db_task.updated_at = datetime.datetime.now()
    db.commit()
    db.refresh(db_task)
    return db_task


@app.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == user_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    db.delete(db_task)
    db.commit()
    return None


# ==========================================
# SCHEDULE ENDPOINTS
# ==========================================

@app.post("/schedule/generate", response_model=List[schemas.ScheduleBlockResponse])
def generate_schedule(start_hour: Optional[int] = None, end_hour: Optional[int] = None, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    """
    Triggers the AI scheduling engine, wipes today's previous plan,
    creates a new optimized daily agenda, and returns the result.
    """
    try:
        sh = start_hour if start_hour is not None else 9
        eh = end_hour if end_hour is not None else 18
        schedule_blocks = generate_daily_schedule(user_id=user_id, db=db, start_hour=sh, end_hour=eh)
        # Parse micro_steps string to list for matching response schema
        response_blocks = []
        for block in schedule_blocks:
            steps = []
            if block.micro_steps:
                try:
                    steps = json.loads(block.micro_steps)
                except ValueError:
                    steps = []
            response_blocks.append(
                schemas.ScheduleBlockResponse(
                    id=block.id,
                    user_id=block.user_id,
                    task_id=block.task_id,
                    title=block.title,
                    start_time=block.start_time,
                    end_time=block.end_time,
                    type=block.type,
                    micro_steps=steps,
                    created_at=block.created_at
                )
            )
        return response_blocks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate daily schedule: {str(e)}")


@app.get("/schedule", response_model=List[schemas.ScheduleBlockResponse])
def get_current_schedule(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    """
    Retrieves the user's scheduled blocks for today.
    """
    today = datetime.date.today()
    start_of_today = datetime.datetime.combine(today, datetime.time.min)
    end_of_today = datetime.datetime.combine(today, datetime.time.max)
    
    blocks = db.query(models.Schedule).filter(
        models.Schedule.user_id == user_id,
        models.Schedule.start_time >= start_of_today,
        models.Schedule.start_time <= end_of_today
    ).order_by(models.Schedule.start_time.asc()).all()
    
    response_blocks = []
    for block in blocks:
        steps = []
        if block.micro_steps:
            try:
                steps = json.loads(block.micro_steps)
            except ValueError:
                steps = []
        response_blocks.append(
            schemas.ScheduleBlockResponse(
                id=block.id,
                user_id=block.user_id,
                task_id=block.task_id,
                title=block.title,
                start_time=block.start_time,
                end_time=block.end_time,
                type=block.type,
                micro_steps=steps,
                created_at=block.created_at
            )
        )
    return response_blocks


@app.delete("/schedule", status_code=status.HTTP_204_NO_CONTENT)
def clear_schedule(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    """
    Clears all schedule blocks for the user today.
    """
    today = datetime.date.today()
    start_of_today = datetime.datetime.combine(today, datetime.time.min)
    end_of_today = datetime.datetime.combine(today, datetime.time.max)
    db.query(models.Schedule).filter(
        models.Schedule.user_id == user_id,
        models.Schedule.start_time >= start_of_today,
        models.Schedule.start_time <= end_of_today
    ).delete()
    db.commit()
    return None


# ==========================================
# PROACTIVE ALERTS & BACKGROUND WORKER ENDPOINTS
# ==========================================

@app.get("/alerts", response_model=List[schemas.AlertResponse])
def get_alerts(unread_only: bool = False, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    """
    Fetches proactive alerts triggered by the background deadline worker.
    """
    query = db.query(models.Alert).filter(models.Alert.user_id == user_id)
    if unread_only:
        query = query.filter(models.Alert.is_read == False)
    return query.order_by(models.Alert.triggered_at.desc()).all()


@app.post("/alerts/{alert_id}/read", response_model=schemas.AlertResponse)
def mark_alert_as_read(alert_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id, models.Alert.user_id == user_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return alert


@app.post("/alerts/trigger-check")
def trigger_deadline_check():
    """
    Manually triggers the background worker deadline scanning logic.
    Extremely useful for demos, testing, and debugging.
    """
    evaluate_deadlines()
    return {"message": "Deadline check evaluation executed successfully."}


# ==========================================
# INTERACTIVE BRAINSTORM / CHAT ENDPOINT
# ==========================================

class ChatMessage(BaseModel):
    message: str
    task_id: Optional[int] = None

@app.post("/chat")
def chat_with_assistant(chat_input: ChatMessage, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    """
    Brainstorming assistant. Users can chat about their tasks,
    and the AI responds with advice, sub-tasks, or draft assistance.
    """
    import re
    
    # 1. Parse scheduling request intents
    msg = chat_input.message.lower()
    is_scheduling = False
    
    # Check if they are asking to reschedule or generate schedule
    keywords = ["schedule", "reschedule", "plan", "timeline", "re-plan", "replan"]
    if any(kw in msg for kw in keywords) or re.search(r'\d+\s*(?:to|-)\s*\d+', msg):
        # Make sure they aren't just asking "what is my schedule"
        if not (any(q in msg for q in ["show", "what is", "get", "view", "list"]) and not any(a in msg for a in ["generate", "create", "make", "change", "new", "reschedule", "plan"])):
            is_scheduling = True

    if is_scheduling:
        # Extract hours (e.g. "9 to 1", "9am to 1pm", "form9 to 1")
        start_hour, end_hour = None, None
        
        # Try to find "X to Y" or "X - Y"
        pattern = r'(?:from\s+|form\s+)?(\d+)\s*(am|pm)?\s*(?:to|-)\s*(\d+)\s*(am|pm)?'
        match = re.search(pattern, msg)
        if match:
            try:
                h1 = int(match.group(1))
                ampm1 = match.group(2)
                h2 = int(match.group(3))
                ampm2 = match.group(4)
                
                # PM logic
                if ampm1 == 'pm' and h1 < 12:
                    h1 += 12
                elif ampm1 == 'am' and h1 == 12:
                    h1 = 0
                    
                if ampm2 == 'pm' and h2 < 12:
                    h2 += 12
                elif ampm2 == 'am' and h2 == 12:
                    h2 = 0
                    
                # If no am/pm specified, handle fallback comparison
                if not ampm2 and not ampm1:
                    if h2 < h1:
                        if h2 < 12:
                            h2 += 12
                    # E.g. 9 to 5 -> 9 to 17
                    if h1 >= 9 and h1 <= 12 and h2 >= 1 and h2 <= 8:
                        h2 += 12
                
                start_hour = h1
                if h2 > h1:
                    end_hour = h2
            except ValueError:
                pass
        
        # Keyword-based fallbacks
        if start_hour is None:
            if 'morning' in msg:
                start_hour, end_hour = 9, 13
            elif 'afternoon' in msg:
                start_hour, end_hour = 13, 18
            elif 'evening' in msg:
                start_hour, end_hour = 17, 21
            elif 'night' in msg:
                start_hour, end_hour = 19, 23
            else:
                # Default daily window
                start_hour, end_hour = 9, 18

        if end_hour is None:
            end_hour = start_hour + 4 if start_hour is not None else 18
            
        try:
            generate_daily_schedule(user_id=user_id, db=db, start_hour=start_hour, end_hour=end_hour)
            
            # Format readable hours for response
            t1 = datetime.time(start_hour, 0).strftime("%I:%M %p").lstrip('0')
            t2 = datetime.time(end_hour, 0).strftime("%I:%M %p").lstrip('0')
            
            return {
                "reply": f"I've generated a new schedule for you today from {t1} to {t2}! 📅",
                "should_refresh": True
            }
        except Exception as e:
            return {
                "reply": f"I tried to reschedule from {start_hour} to {end_hour}, but ran into an issue: {str(e)}",
                "should_refresh": False
            }

    task_context = ""
    task = None
    if chat_input.task_id:
        task = db.query(models.Task).filter(models.Task.id == chat_input.task_id, models.Task.user_id == user_id).first()
        if task:
            task_context = (
                f"\nThe user is currently focusing on this task:\n"
                f"- Title: {task.title}\n"
                f"- Description: {task.description or 'N/A'}\n"
                f"- Estimated duration: {task.estimated_duration_mins} mins\n"
                f"- Deadline: {task.deadline.isoformat()}\n"
            )
            
    system_prompt = (
        "You are CrunchTime's interactive brainstorming co-pilot. Your goal is to help the user start their work immediately. "
        "Be encouraging, concise, and structure your response with bullet points if offering breakdown steps. "
        "Focus on breaking down procrastination barriers. Keep responses under 150 words."
    )
    
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": f"{system_prompt}\n{task_context}\n\nUser Message: {chat_input.message}"}]}],
                "generationConfig": {"maxOutputTokens": 250}
            }
            response = httpx.post(url, json=payload, headers=headers, timeout=15.0)
            if response.status_code == 200:
                res_json = response.json()
                reply = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
                return {"reply": reply, "should_refresh": False}
        except Exception as e:
            print(f"Chat Gemini API error: {e}")
            
    elif openai_key:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {openai_key}"
            }
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"{task_context}\n\nUser Message: {chat_input.message}"}
                ],
                "max_tokens": 250
            }
            response = httpx.post(url, json=payload, headers=headers, timeout=15.0)
            if response.status_code == 200:
                res_json = response.json()
                reply = res_json['choices'][0]['message']['content'].strip()
                return {"reply": reply, "should_refresh": False}
        except Exception as e:
            print(f"Chat OpenAI API error: {e}")
 
    # Dynamic fallback helper if no API key is present
    if chat_input.task_id and task:
        return {
            "reply": (
                f"I'm here to co-pilot your work on '{task.title}'! To unlock personalized AI suggestions, "
                "please configure your `GEMINI_API_KEY` or `OPENAI_API_KEY` in your `.env` file.\n\n"
                "In the meantime, here are a few recommended starting steps:\n"
                "1. Spend just 2 minutes writing down the absolute simplest first sentence or line of code.\n"
                "2. Turn off all phone notifications and set a timer for 15 minutes of uninterrupted work."
            ),
            "should_refresh": False
        }
    else:
        return {
            "reply": (
                "Hello! I am your CrunchTime AI co-pilot. Once you configure your `GEMINI_API_KEY` or `OPENAI_API_KEY` "
                "in a `.env` file, we can brainstorm any task, draft code/emails, or plan study guides together. "
                "How can I help you organize your productivity today?"
            ),
            "should_refresh": False
        }
