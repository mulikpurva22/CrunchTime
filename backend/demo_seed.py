import datetime
from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine, Base
from backend import models
from backend.scheduler import generate_daily_schedule
from backend.scheduler_worker import evaluate_deadlines

def seed_demo_data():
    print("--- CRUNCHTIME BACKEND DEMO & SEED RUN ---")
    
    # 1. Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # 2. Get or create demo user
        user = db.query(models.User).filter(models.User.email == "demo@crunchtime.ai").first()
        if not user:
            user = models.User(
                email="demo@crunchtime.ai",
                name="Demo User",
                hashed_password="hashed_demo_password"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created user: {user.name}")
        else:
            print(f"Found existing user: {user.name}")
            
        # Clean previous tasks, schedules, and alerts for fresh demo run
        db.query(models.Schedule).filter(models.Schedule.user_id == user.id).delete()
        db.query(models.Alert).filter(models.Alert.user_id == user.id).delete()
        db.query(models.Task).filter(models.Task.user_id == user.id).delete()
        db.commit()
        print("Cleared existing tasks, schedules, and alerts for user.")
        
        # 3. Seed new tasks
        now = datetime.datetime.now()
        
        # Task A: Tight deadline (e.g. 2 hours from now) to trigger proactive alert
        task_a_deadline = now + datetime.timedelta(hours=2)
        task_a = models.Task(
            title="Write Project Report Draft",
            description="Draft sections 1 and 2. Needs deep concentration.",
            estimated_duration_mins=120,  # 2 hours
            priority_score=9,
            deadline=task_a_deadline,
            status="Pending",
            energy_required="High",
            tags="work,report",
            user_id=user.id
        )
        
        # Task B: Tomorrow deadline
        task_b_deadline = now + datetime.timedelta(days=1, hours=4)
        task_b = models.Task(
            title="Prepare for Python Tech Interview",
            description="Review coding questions, data structures, and algorithms.",
            estimated_duration_mins=180,  # 3 hours
            priority_score=8,
            deadline=task_b_deadline,
            status="Pending",
            energy_required="High",
            tags="career,interview",
            user_id=user.id
        )
        
        # Task C: Low energy task
        task_c_deadline = now + datetime.timedelta(days=2)
        task_c = models.Task(
            title="Submit Weekly Timesheet",
            description="Fill out hourly logs in company portal.",
            estimated_duration_mins=15,
            priority_score=4,
            deadline=task_c_deadline,
            status="Pending",
            energy_required="Low",
            tags="admin",
            user_id=user.id
        )
        
        db.add_all([task_a, task_b, task_c])
        db.commit()
        db.refresh(task_a)
        db.refresh(task_b)
        db.refresh(task_c)
        print("Successfully seeded 3 demo tasks:")
        print(f"  - '{task_a.title}' (Due in 2 hours, estimated duration: 2h)")
        print(f"  - '{task_b.title}' (Due tomorrow, estimated duration: 3h)")
        print(f"  - '{task_c.title}' (Due in 2 days, estimated duration: 15m)")
        
        # 4. Evaluate deadlines for proactive alerts (run before scheduling so durations aren't deducted)
        print("\nEvaluating deadlines for proactive alerts...")
        evaluate_deadlines()
        
        # Fetch and print triggered alerts
        alerts = db.query(models.Alert).filter(models.Alert.user_id == user.id).all()
        print(f"Found {len(alerts)} proactive alerts triggered in database:")
        for idx, alert in enumerate(alerts):
            print(f"  [{idx+1}] [{alert.risk_level.upper()} RISK] Nudge: {alert.nudge_text}")

        # 5. Generate schedule
        print("\nRunning scheduling engine (generate_daily_schedule)...")
        schedule_blocks = generate_daily_schedule(user.id, db)
        print(f"Generated {len(schedule_blocks)} schedule blocks for today:")
        for idx, block in enumerate(schedule_blocks):
            print(f"  [{idx+1}] {block.start_time.strftime('%I:%M %p')} - {block.end_time.strftime('%I:%M %p')}: {block.title} ({block.type.upper()})")
            if block.micro_steps:
                import json
                steps = json.loads(block.micro_steps)
                for step in steps:
                    print(f"      * {step}")
            
    except Exception as e:
        print(f"Error seeding demo: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_demo_data()
