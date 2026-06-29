import os
import json
import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import httpx

from backend.models import Task, Schedule, User
from backend import schemas

# Mock function for retrieving calendar busy blocks (simulating Google/Microsoft Calendar integrations)
def get_mock_calendar_events(user_id: int, date: datetime.date) -> List[Dict[str, Any]]:
    """
    Returns pre-existing calendar commitments (e.g. meetings, lectures) for the day.
    The AI scheduling engine must plan tasks around these commitments.
    """
    # For testing, we mock two meetings for the user today
    base_date = datetime.datetime.combine(date, datetime.time.min)
    return [
        {
            "title": "Team Daily Standup",
            "start_time": (base_date + datetime.timedelta(hours=10)).isoformat(),  # 10:00 AM
            "end_time": (base_date + datetime.timedelta(hours=10, minutes=30)).isoformat(),  # 10:30 AM
            "type": "meeting"
        },
        {
            "title": "Project Review Meeting",
            "start_time": (base_date + datetime.timedelta(hours=14)).isoformat(),  # 2:00 PM
            "end_time": (base_date + datetime.timedelta(hours=15)).isoformat(),  # 3:00 PM
            "type": "meeting"
        }
    ]

# JSON schema definitions for LLM validation
class LLMScheduleBlock(BaseModel):
    task_id: Optional[int] = Field(default=None, description="The ID of the task being scheduled. Null if it is a break or meeting.")
    title: str = Field(description="Actionable title for the time block (e.g. 'Deep Work: Title' or 'Cognitive Break').")
    start_time: str = Field(description="Start ISO timestamp (YYYY-MM-DDTHH:MM:SS)")
    end_time: str = Field(description="End ISO timestamp (YYYY-MM-DDTHH:MM:SS)")
    type: str = Field(description="Must be one of: task, break, buffer, meeting")
    micro_steps: List[str] = Field(default=[], description="List of 3-4 small sub-steps to guide the user through the block.")

class LLMScheduleResponse(BaseModel):
    schedule: List[LLMScheduleBlock]

def run_fallback_heuristic_scheduler(
    tasks: List[Task], 
    calendar_events: List[Dict[str, Any]], 
    start_hour: int = 9, 
    end_hour: int = 18,
    custom_start_dt: Optional[datetime.datetime] = None
) -> Dict[str, Any]:
    """
    Generates a schedule based on a smart heuristic algorithm when no LLM API keys are configured.
    Ensures that the application is fully functional and testable immediately out-of-the-box.
    """
    today = datetime.date.today()
    schedule_blocks = []
    
    # Sort calendar events by start time
    meetings = []
    for evt in calendar_events:
        s_time = datetime.datetime.fromisoformat(evt["start_time"])
        e_time = datetime.datetime.fromisoformat(evt["end_time"])
        meetings.append({
            "title": evt["title"],
            "start_time": s_time,
            "end_time": e_time,
            "type": "meeting",
            "micro_steps": ["Attend meeting", "Take notes", "Follow up on action items"],
            "task_id": None
        })
        schedule_blocks.append(meetings[-1])
        
    # Sort tasks by priority score (descending) and deadline (ascending)
    sorted_tasks = sorted(tasks, key=lambda t: (-t.priority_score, t.deadline))
    
    limit_time = datetime.datetime.combine(today, datetime.time(end_hour, 0))
    if custom_start_dt:
      current_time = custom_start_dt
      if custom_start_dt >= limit_time:
        limit_time = custom_start_dt + datetime.timedelta(hours=4)
    else:
      current_time = datetime.datetime.combine(today, datetime.time(start_hour, 0))
    
    task_idx = 0
    while current_time < limit_time and task_idx < len(sorted_tasks):
        # Check if current_time falls inside any meeting
        overlapping_meeting = None
        for m in meetings:
            if m["start_time"] <= current_time < m["end_time"]:
                overlapping_meeting = m
                break
        
        if overlapping_meeting:
            current_time = overlapping_meeting["end_time"]
            continue
            
        # Check how much time we have until the next meeting or end of day
        next_event_time = limit_time
        for m in meetings:
            if m["start_time"] > current_time and m["start_time"] < next_event_time:
                next_event_time = m["start_time"]
                
        available_mins = int((next_event_time - current_time).total_seconds() / 60)
        
        if available_mins < 15:
            # Insert short buffer
            block_end = current_time + datetime.timedelta(minutes=available_mins)
            schedule_blocks.append({
                "task_id": None,
                "title": "Short Buffer",
                "start_time": current_time,
                "end_time": block_end,
                "type": "buffer",
                "micro_steps": ["Stretch", "Hydrate"],
            })
            current_time = block_end
            continue
            
        task = sorted_tasks[task_idx]
        task_duration = task.estimated_duration_mins
        
        # Determine actual time block duration (cap it to available time or 90 minutes deep work block)
        allocated_mins = min(task_duration, available_mins, 90)
        
        block_end = current_time + datetime.timedelta(minutes=allocated_mins)
        
        # Breakdown into micro-steps
        micro_steps = [
            f"Set up materials for {task.title}",
            f"Work on core phase of {task.title}",
            f"Review progress and note next actions"
        ]
        
        schedule_blocks.append({
            "task_id": task.id,
            "title": f"Deep Work: {task.title}",
            "start_time": current_time,
            "end_time": block_end,
            "type": "task",
            "micro_steps": micro_steps
        })
        
        # Deduct or complete task
        if allocated_mins >= task_duration:
            task_idx += 1
        else:
            # Task is partially completed, update remaining duration for next block
            task.estimated_duration_mins -= allocated_mins
            
        current_time = block_end
        
        # If we have time left, insert a 15-minute break after a cognitive work block
        if current_time < next_event_time:
            break_mins = min(15, int((next_event_time - current_time).total_seconds() / 60))
            if break_mins > 0:
                break_end = current_time + datetime.timedelta(minutes=break_mins)
                schedule_blocks.append({
                    "task_id": None,
                    "title": "Cognitive Break",
                    "start_time": current_time,
                    "end_time": break_end,
                    "type": "break",
                    "micro_steps": ["Walk away from screen", "Rest eyes", "Grab water"],
                })
                current_time = break_end

    # Format output dates as ISO strings
    formatted_schedule = []
    for item in schedule_blocks:
        formatted_schedule.append({
            "task_id": item["task_id"],
            "title": item["title"],
            "start_time": item["start_time"].isoformat(),
            "end_time": item["end_time"].isoformat(),
            "type": item["type"],
            "micro_steps": item["micro_steps"]
        })
        
    return {"schedule": formatted_schedule}

def generate_daily_schedule(user_id: int, db: Session, start_hour: int = 9, end_hour: int = 18) -> List[Schedule]:
    """
    Main service function that coordinates tasks, calendar events, and sends
    them to the LLM (or fallback heuristic) to generate an optimized daily schedule.
    """
    today = datetime.date.today()
    
    # 1. Fetch pending tasks for the user
    tasks = db.query(Task).filter(Task.user_id == user_id, Task.status != "Done").all()
    
    # 2. Fetch mock calendar events
    calendar_events = get_mock_calendar_events(user_id, today)
    
    # Check for LLM configuration
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    schedule_data = None
    
    if not tasks:
        # Return empty list if no tasks
        # Clean existing schedule for today just in case
        start_of_today = datetime.datetime.combine(today, datetime.time.min)
        end_of_today = datetime.datetime.combine(today, datetime.time.max)
        db.query(Schedule).filter(
            Schedule.user_id == user_id,
            Schedule.start_time >= start_of_today,
            Schedule.start_time <= end_of_today
        ).delete()
        db.commit()
        return []

    # Calculate starting datetime dynamically to prevent scheduling in the past
    now = datetime.datetime.now()
    
    # Round now to the next 5 minutes
    minutes_to_add = 5 - (now.minute % 5)
    now_rounded = now + datetime.timedelta(minutes=minutes_to_add)
    now_rounded = now_rounded.replace(second=0, microsecond=0)
    
    start_dt = datetime.datetime.combine(today, datetime.time(start_hour, 0))
    end_dt = datetime.datetime.combine(today, datetime.time(end_hour, 0))
    
    if now.date() == today:
        if now_rounded >= end_dt:
            # If current time is past the scheduled end_hour (e.g. 6 PM),
            # dynamically shift the schedule window to start NOW and go for the next 4 hours
            start_dt = now_rounded
            end_dt = now_rounded + datetime.timedelta(hours=4)
        else:
            # If current time is within or before the workday, start from now if we are past start_hour
            if now_rounded > start_dt:
                start_dt = now_rounded
        
    # Prepare task details string for prompt
    task_details = []
    for t in tasks:
        task_details.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "duration_mins": t.estimated_duration_mins,
            "priority": t.priority_score,
            "deadline": t.deadline.isoformat(),
            "energy_required": t.energy_required,
            "tags": t.tags
        })
        
    system_prompt = (
        "You are the brain of CrunchTime, an elite AI productivity companion. "
        "Given the user's list of tasks, current calendar commitments, and deadlines, generate an optimized, realistic hour-by-hour daily schedule. "
        "Break large tasks down into manageable micro-steps. Account for 15-minute breaks between heavy cognitive tasks. "
        "Your output MUST be a valid JSON object adhering strictly to the JSON schema provided."
    )
    
    start_time_str = start_dt.strftime("%I:%M %p")
    end_time_str = end_dt.strftime("%I:%M %p")
    
    user_prompt = (
        f"Tasks to schedule: {json.dumps(task_details, indent=2)}\n\n"
        f"Pre-existing calendar commitments: {json.dumps(calendar_events, indent=2)}\n\n"
        f"Schedule Date: {today.isoformat()}\n\n"
        f"Generate a schedule starting at {start_time_str} ({start_dt.isoformat()}) and ending around {end_time_str} ({end_dt.isoformat()}). "
        f"Make sure not to schedule work over the commitments, and do not schedule tasks in the past relative to the start time."
    )

    if gemini_key:
        try:
            # Attempt to call Gemini API
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "responseSchema": {
                        "type": "OBJECT",
                        "properties": {
                            "schedule": {
                                "type": "ARRAY",
                                "items": {
                                    "type": "OBJECT",
                                    "properties": {
                                        "task_id": {"type": "INTEGER"},
                                        "title": {"type": "STRING"},
                                        "start_time": {"type": "STRING"},
                                        "end_time": {"type": "STRING"},
                                        "type": {"type": "STRING"},
                                        "micro_steps": {
                                            "type": "ARRAY",
                                            "items": {"type": "STRING"}
                                        }
                                    },
                                    "required": ["title", "start_time", "end_time", "type", "micro_steps"]
                                }
                            }
                        },
                        "required": ["schedule"]
                    }
                }
            }
            response = httpx.post(url, json=payload, headers=headers, timeout=30.0)
            if response.status_code == 200:
                res_json = response.json()
                text = res_json['candidates'][0]['content']['parts'][0]['text']
                schedule_data = json.loads(text)
        except Exception as e:
            print(f"Gemini API generation failed: {e}. Falling back to heuristic scheduler.")
            
    elif openai_key and not schedule_data:
        try:
            # Attempt to call OpenAI API
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {openai_key}"
            }
            payload = {
                "model": "gpt-4o",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "response_format": {"type": "json_object"}
            }
            response = httpx.post(url, json=payload, headers=headers, timeout=30.0)
            if response.status_code == 200:
                res_json = response.json()
                text = res_json['choices'][0]['message']['content']
                schedule_data = json.loads(text)
        except Exception as e:
            print(f"OpenAI API generation failed: {e}. Falling back to heuristic scheduler.")

    if not schedule_data:
        # Fallback to local heuristic scheduler
        schedule_data = run_fallback_heuristic_scheduler(
            tasks, calendar_events, start_hour=start_hour, end_hour=end_hour, custom_start_dt=start_dt
        )

    # 3. Save schedule blocks to database
    # Clean previous schedule for today
    start_of_today = datetime.datetime.combine(today, datetime.time.min)
    end_of_today = datetime.datetime.combine(today, datetime.time.max)
    db.query(Schedule).filter(
        Schedule.user_id == user_id,
        Schedule.start_time >= start_of_today,
        Schedule.start_time <= end_of_today
    ).delete()
    
    new_blocks = []
    for block in schedule_data.get("schedule", []):
        task_id = block.get("task_id")
        
        # Ensure task_id belongs to a real task (could be a string "null" or invalid ID from LLM)
        if task_id:
            try:
                task_id = int(task_id)
                # Verify task exists and is not Done
                task_exists = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
                if not task_exists:
                    task_id = None
            except ValueError:
                task_id = None
        else:
            task_id = None

        db_block = Schedule(
            user_id=user_id,
            task_id=task_id,
            title=block.get("title"),
            start_time=datetime.datetime.fromisoformat(block.get("start_time")),
            end_time=datetime.datetime.fromisoformat(block.get("end_time")),
            type=block.get("type"),
            micro_steps=json.dumps(block.get("micro_steps", []))
        )
        db.add(db_block)
        new_blocks.append(db_block)
        
    db.commit()
    for block in new_blocks:
        db.refresh(block)
        
    return new_blocks


def parse_bulk_tasks(raw_text: str) -> List[Dict[str, Any]]:
    """
    Parses a single raw text description block containing multiple task descriptions
    into a list of dictionaries with keys: title, description, estimated_duration_mins,
    priority_score, energy_required, deadline.
    
    Supports LLM extraction with regular fallback parsing.
    """
    import re
    
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    
    parsed_tasks = None
    
    system_prompt = (
        "You are an elite task extraction AI for CrunchTime.\n"
        "Your task is to parse a user's freeform bulleted text list containing several tasks "
        "and return them as a structured JSON list of task objects.\n"
        "For each task, extract or estimate the following fields:\n"
        "- title (string, required, clear and concise)\n"
        "- description (string, optional details or context)\n"
        "- estimated_duration_mins (integer, estimate in minutes, default to 60 if not specified)\n"
        "- priority_score (integer, 1 to 10 scale, default to 5 if not specified)\n"
        "- energy_required (string, must be one of: High, Medium, Low)\n"
        "- deadline (string, ISO datetime format. If not specified, set it to 11:59 PM (23:59:00) of today in UTC)\n"
        "\n"
        "Your output must be a valid JSON object matching the schema below:\n"
        "{\n"
        "  \"tasks\": [\n"
        "    {\n"
        "      \"title\": \"Example Task\",\n"
        "      \"description\": \"Details here\",\n"
        "      \"estimated_duration_mins\": 60,\n"
        "      \"priority_score\": 7,\n"
        "      \"energy_required\": \"High\",\n"
        "      \"deadline\": \"2026-06-25T23:59:00\"\n"
        "    }\n"
        "  ]\n"
        "}"
    )

    today_str = datetime.date.today().isoformat()
    user_prompt = f"Today's date: {today_str}\n\nRaw text to parse:\n{raw_text}"
    
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "responseSchema": {
                        "type": "OBJECT",
                        "properties": {
                            "tasks": {
                                "type": "ARRAY",
                                "items": {
                                    "type": "OBJECT",
                                    "properties": {
                                        "title": {"type": "STRING"},
                                        "description": {"type": "STRING"},
                                        "estimated_duration_mins": {"type": "INTEGER"},
                                        "priority_score": {"type": "INTEGER"},
                                        "energy_required": {"type": "STRING"},
                                        "deadline": {"type": "STRING"}
                                    },
                                    "required": ["title", "estimated_duration_mins", "priority_score", "energy_required", "deadline"]
                                }
                            }
                        },
                        "required": ["tasks"]
                    }
                }
            }
            response = httpx.post(url, json=payload, headers=headers, timeout=20.0)
            if response.status_code == 200:
                res_json = response.json()
                text = res_json['candidates'][0]['content']['parts'][0]['text']
                parsed_tasks = json.loads(text).get("tasks", [])
        except Exception as e:
            print(f"Gemini bulk task parse failed: {e}. Falling back to regex parser.")

    elif openai_key and not parsed_tasks:
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
                "response_format": {"type": "json_object"}
            }
            response = httpx.post(url, json=payload, headers=headers, timeout=20.0)
            if response.status_code == 200:
                res_json = response.json()
                text = res_json['choices'][0]['message']['content']
                parsed_tasks = json.loads(text).get("tasks", [])
        except Exception as e:
            print(f"OpenAI bulk task parse failed: {e}. Falling back to regex parser.")

    if not parsed_tasks:
        # Smart Local Fallback Parser using regex & line splitting
        parsed_tasks = []
        lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        
        # Default deadline: end of today (23:59:00)
        default_deadline = datetime.datetime.combine(datetime.date.today(), datetime.time(23, 59, 0)).isoformat()
        
        for line in lines:
            # Check if line is a bullet/numbered item
            clean_line = re.sub(r'^[\-\*\+\d\.\s]+', '', line).strip()
            if not clean_line:
                continue
                
            # Default values
            title = clean_line
            description = f"Extracted from raw line: {line}"
            priority = 5
            duration = 60
            energy = "Medium"
            deadline_val = default_deadline
            
            # Extract priority score: e.g. Priority 9, P9, P:9, priority: 9
            p_match = re.search(r'(?:priority|p)(?:\s*score)?(?:\s*is)?[\s\:\=]*(\d+)', clean_line, re.IGNORECASE)
            if p_match:
                try:
                    val = int(p_match.group(1))
                    if 1 <= val <= 10:
                        priority = val
                    clean_line = clean_line.replace(p_match.group(0), '').strip()
                except ValueError:
                    pass
                    
            # Extract duration: e.g. 60m, 120 mins, 2 hours, takes 45 mins
            d_match = re.search(r'(?:takes|duration|time)?\s*(\d+)\s*(?:minutes|minute|mins|min|m)', clean_line, re.IGNORECASE)
            if d_match:
                try:
                    duration = int(d_match.group(1))
                    clean_line = clean_line.replace(d_match.group(0), '').strip()
                except ValueError:
                    pass
            else:
                # Check for hours: e.g. 2h, 2 hours, 1.5 hours
                h_match = re.search(r'(?:takes|duration|time)?\s*(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|h)', clean_line, re.IGNORECASE)
                if h_match:
                    try:
                        duration = int(float(h_match.group(1)) * 60)
                        clean_line = clean_line.replace(h_match.group(0), '').strip()
                    except ValueError:
                        pass

            # Extract deadline: e.g. due tomorrow, due in 2h, due at 5 o clock
            if re.search(r'due tomorrow', clean_line, re.IGNORECASE):
                tomorrow = datetime.date.today() + datetime.timedelta(days=1)
                deadline_val = datetime.datetime.combine(tomorrow, datetime.time(23, 59, 0)).isoformat()
                clean_line = re.sub(r'due tomorrow', '', clean_line, flags=re.IGNORECASE).strip()
            else:
                in_hours_match = re.search(r'due in\s*(\d+(?:\.\d+)?)\s*(?:h|hr|hour|hours)', clean_line, re.IGNORECASE)
                if in_hours_match:
                    try:
                        hrs = float(in_hours_match.group(1))
                        deadline_dt = datetime.datetime.now() + datetime.timedelta(hours=hrs)
                        deadline_val = deadline_dt.isoformat()
                        clean_line = clean_line.replace(in_hours_match.group(0), '').strip()
                    except ValueError:
                        pass
                else:
                    # Match suffix-based times: e.g. "5pm", "5 o'clock"
                    at_time_match = re.search(r'(?:due\s*(?:today|tonight)?\s*)?(?:at|by)?\s*(\d+)(?::(\d+))?\s*(am|pm|o\'clock|o clock|oclock)', clean_line, re.IGNORECASE)
                    if not at_time_match:
                        # Match prefix-based times: e.g. "due at 5", "by 17"
                        at_time_match = re.search(r'(?:due\s*(?:today|tonight)?\s*|at|by)\s*(\d+)(?::(\d+))?', clean_line, re.IGNORECASE)
                        
                    if at_time_match:
                        try:
                            hour = int(at_time_match.group(1))
                            minute = int(at_time_match.group(2)) if at_time_match.group(2) else 0
                            ampm = at_time_match.group(3) if len(at_time_match.groups()) >= 3 else None
                            
                            if ampm:
                                ampm = ampm.lower()
                                if 'pm' in ampm and hour < 12:
                                    hour += 12
                                elif 'am' in ampm and hour == 12:
                                    hour = 0
                            elif hour <= 12:
                                # Default PM conversion heuristic if current time is afternoon
                                current_hour = datetime.datetime.now().hour
                                if current_hour >= 12 and hour < 12:
                                    hour += 12
                                    
                            deadline_dt = datetime.datetime.combine(datetime.date.today(), datetime.time(hour, minute, 0))
                            deadline_val = deadline_dt.isoformat()
                            clean_line = clean_line.replace(at_time_match.group(0), '').strip()
                        except ValueError:
                            pass
                        
            # Clean up empty parentheses, brackets, or commas left behind by regex replacements
            clean_line = re.sub(r'\(\s*[\,\;]?\s*\)', '', clean_line).strip()
            clean_line = re.sub(r'\[\s*[\,\;]?\s*\]', '', clean_line).strip()
            # Clean up residual trailing commas/parentheses/punctuation
            clean_line = re.sub(r'[\(\[\,\.\;\:\-\]\)]+$', '', clean_line).strip()
            clean_line = re.sub(r'^[\(\[\,\.\;\:\-\]\)]+', '', clean_line).strip()
            
            # If line got too short, use original clean_line as title
            if len(clean_line) > 3:
                title = clean_line
            else:
                title = clean_line or "Unnamed Task"
                
            # Heuristic energy level based on duration & priority
            if duration >= 90 or priority >= 8:
                energy = "High"
            elif duration <= 20:
                energy = "Low"
                
            parsed_tasks.append({
                "title": title,
                "description": description,
                "estimated_duration_mins": duration,
                "priority_score": priority,
                "energy_required": energy,
                "deadline": deadline_val
            })
            
    return parsed_tasks
