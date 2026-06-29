import os
import datetime
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
import httpx
import json

from backend.database import SessionLocal
from backend.models import Task, Alert, User

scheduler = BackgroundScheduler()

def generate_ai_nudge(task_title: str, deadline: datetime.datetime, estimated_duration: int, mins_to_deadline: int) -> str:
    """
    Generates a personalized, proactive AI nudge text.
    Falls back to a dynamic template if no LLM key is configured.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    
    deadline_str = deadline.strftime("%I:%M %p")
    time_left_str = f"{int(mins_to_deadline // 60)}h {int(mins_to_deadline % 60)}m" if mins_to_deadline >= 60 else f"{int(mins_to_deadline)} mins"
    
    system_prompt = (
        "You are the proactive voice of CrunchTime, an elite productivity companion. "
        "Create a short, punchy, encouraging, and urgent nudge (max 2 sentences) to prevent the user from missing their deadline. "
        "Offer a specific starting action (e.g., co-drafting, doing a 5-minute brainstorm, starting a Pomodoro block)."
    )
    
    user_prompt = (
        f"Task: {task_title}\n"
        f"Estimated time needed: {estimated_duration} minutes\n"
        f"Deadline: {deadline_str}\n"
        f"Time remaining until deadline: {time_left_str}\n"
        "Generate a brief push notification nudge."
    )
    
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}],
                "generationConfig": {"maxOutputTokens": 100}
            }
            response = httpx.post(url, json=payload, headers=headers, timeout=10.0)
            if response.status_code == 200:
                res_json = response.json()
                nudge = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
                # Clean up wrapping quotes if any
                if (nudge.startswith('"') and nudge.endswith('"')) or (nudge.startswith("'") and nudge.endswith("'")):
                    nudge = nudge[1:-1]
                return nudge
        except Exception as e:
            print(f"Failed to generate Gemini nudge: {e}")
            
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
                    {"role": "user", "content": user_prompt}
                ],
                "max_tokens": 100
            }
            response = httpx.post(url, json=payload, headers=headers, timeout=10.0)
            if response.status_code == 200:
                res_json = response.json()
                nudge = res_json['choices'][0]['message']['content'].strip()
                if (nudge.startswith('"') and nudge.endswith('"')) or (nudge.startswith("'") and nudge.endswith("'")):
                    nudge = nudge[1:-1]
                return nudge
        except Exception as e:
            print(f"Failed to generate OpenAI nudge: {e}")

    # Heuristic Template Fallback
    buffer_mins = int(mins_to_deadline - estimated_duration)
    if buffer_mins > 0:
        return f"Hey, '{task_title}' takes about {estimated_duration} mins and is due at {deadline_str}. If you don't start in the next {buffer_mins} mins, you will miss your deadline. Let's tackle the first step together!"
    else:
        return f"Crunch time! '{task_title}' requires {estimated_duration} mins, but you only have {time_left_str} left before your {deadline_str} deadline. Stop planning and start now—let's do a 5-minute sprint!"


def evaluate_deadlines():
    """
    Scans all pending tasks and triggers alerts if they are at risk of missing deadlines.
    """
    db = SessionLocal()
    try:
        now = datetime.datetime.now()
        # Fetch tasks that are pending or in progress
        tasks = db.query(Task).filter(Task.status != "Done").all()
        print(f"[Worker Debug] Found {len(tasks)} tasks to evaluate at {now.isoformat()}")
        
        for task in tasks:
            # Calculate minutes until deadline
            time_diff = task.deadline - now
            mins_to_deadline = time_diff.total_seconds() / 60
            print(f"[Worker Debug] Task '{task.title}': deadline={task.deadline.isoformat()}, mins_to_deadline={mins_to_deadline:.1f}, estimated={task.estimated_duration_mins}")
            
            # If the task is overdue, or deadline is coming up fast
            if mins_to_deadline <= 0:
                print(f"[Worker Debug] Task '{task.title}' is overdue or due now. Skipping.")
                continue  # already overdue, handle elsewhere or skip
                
            # If time left is less than 1.5x the estimated duration, it is at risk
            if mins_to_deadline <= task.estimated_duration_mins * 1.5:
                # Check if we already created an alert for this task in the last 30 minutes
                thirty_mins_ago = now - datetime.timedelta(minutes=30)
                recent_alert = db.query(Alert).filter(
                    Alert.task_id == task.id,
                    Alert.triggered_at >= thirty_mins_ago
                ).first()
                
                if not recent_alert:
                    # Generate nudge text
                    nudge = generate_ai_nudge(
                        task_title=task.title,
                        deadline=task.deadline,
                        estimated_duration=task.estimated_duration_mins,
                        mins_to_deadline=mins_to_deadline
                    )
                    
                    # Risk level depends on how tight the window is
                    if mins_to_deadline <= task.estimated_duration_mins:
                        risk_level = "High"
                    else:
                        risk_level = "Medium"
                        
                    alert = Alert(
                        user_id=task.user_id,
                        task_id=task.id,
                        nudge_text=nudge,
                        risk_level=risk_level,
                        triggered_at=now,
                        is_read=False
                    )
                    db.add(alert)
                    db.commit()
                    print(f"Triggered Proactive Alert for Task ID {task.id}: {nudge}")
                else:
                    print(f"[Worker Debug] Recent alert found for Task '{task.title}'. Skipping.")
            else:
                print(f"[Worker Debug] Task '{task.title}' is not at risk. (mins_to_deadline {mins_to_deadline:.1f} > estimated {task.estimated_duration_mins} * 1.5)")
                    
    except Exception as e:
        print(f"Error evaluating deadlines: {e}")
    finally:
        db.close()


def start_worker():
    """Starts the APScheduler background worker."""
    if not scheduler.running:
        # Run deadline evaluations every 30 seconds
        scheduler.add_job(evaluate_deadlines, 'interval', seconds=30, id='deadline_checker')
        scheduler.start()
        print("APScheduler Background Worker Started.")

def stop_worker():
    """Stops the APScheduler background worker."""
    if scheduler.running:
        scheduler.shutdown()
        print("APScheduler Background Worker Stopped.")
