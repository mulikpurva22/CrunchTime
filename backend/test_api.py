from fastapi.testclient import TestClient
import datetime
import json

from backend.main import app
from backend.database import Base, engine, SessionLocal
from backend import models

client = TestClient(app)

def run_api_tests():
    print("--- CRUNCHTIME BACKEND API ROUTE VERIFICATION ---")
    
    # 1. Reset tables for clean test run
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # Create the demo user (main.py creates it in lifespan, but since TestClient can bypass lifespan in some setups, we make sure it exists)
    db = SessionLocal()
    user = db.query(models.User).filter(models.User.email == "demo@crunchtime.ai").first()
    if not user:
        user = models.User(
            email="demo@crunchtime.ai",
            name="Demo User",
            hashed_password="hashed_demo_password"
        )
        db.add(user)
        db.commit()
    db.close()

    # 2. Test Root Endpoint
    print("\nTesting GET / ...")
    response = client.get("/")
    assert response.status_code == 200
    print(f"  Response: {response.json()}")

    # 3. Test Task Creation (POST /tasks)
    print("\nTesting POST /tasks ...")
    deadline = (datetime.datetime.utcnow() + datetime.timedelta(hours=2)).isoformat()
    task_data = {
        "title": "Build React Components",
        "description": "Create the glassmorphic dashboard components.",
        "estimated_duration_mins": 90,
        "priority_score": 8,
        "deadline": deadline,
        "status": "Pending",
        "energy_required": "High",
        "tags": "frontend,react"
    }
    response = client.post("/tasks", json=task_data)
    assert response.status_code == 201
    task_res = response.json()
    task_id = task_res["id"]
    print(f"  Successfully created task ID {task_id}: {task_res['title']}")
    
    # 3b. Test Bulk Task Creation (POST /tasks/bulk)
    print("\nTesting POST /tasks/bulk ...")
    bulk_data = {
        "text": "- Write report (Priority: 9, takes 45 mins)\n- Submit expenses (Priority: 4, 15m)\n- Fix bug (P8, 120 minutes)"
    }
    response = client.post("/tasks/bulk", json=bulk_data)
    if response.status_code != 201:
        print(f"  FAILED: Status {response.status_code}, Response: {response.text}")
    assert response.status_code == 201
    bulk_tasks = response.json()
    assert len(bulk_tasks) == 3
    print(f"  Successfully created {len(bulk_tasks)} bulk tasks:")
    for t in bulk_tasks:
        print(f"    - ID {t['id']}: {t['title']} (Priority {t['priority_score']}, Duration {t['estimated_duration_mins']} mins)")
    
    # 4. Test Task Retrieval (GET /tasks)
    print("\nTesting GET /tasks ...")
    response = client.get("/tasks")
    assert response.status_code == 200
    tasks = response.json()
    assert len(tasks) >= 1
    print(f"  Retrieved {len(tasks)} tasks. First task title: '{tasks[0]['title']}'")

    # 5. Test Task Update (PUT /tasks/{id})
    print(f"\nTesting PUT /tasks/{task_id} ...")
    update_data = {
        "status": "In_Progress",
        "estimated_duration_mins": 100
    }
    response = client.put(f"/tasks/{task_id}", json=update_data)
    assert response.status_code == 200
    updated_task = response.json()
    assert updated_task["status"] == "In_Progress"
    assert updated_task["estimated_duration_mins"] == 100
    print(f"  Successfully updated task ID {task_id}. Status: {updated_task['status']}, Duration: {updated_task['estimated_duration_mins']} mins")

    # 6. Test Deadline Checker Trigger (POST /alerts/trigger-check)
    print("\nTesting POST /alerts/trigger-check ...")
    response = client.post("/alerts/trigger-check")
    assert response.status_code == 200
    print(f"  Check triggered: {response.json()}")

    # 7. Test Alerts Retrieval (GET /alerts)
    print("\nTesting GET /alerts ...")
    response = client.get("/alerts")
    assert response.status_code == 200
    alerts = response.json()
    print(f"  Retrieved {len(alerts)} alerts.")
    if alerts:
        alert_id = alerts[0]["id"]
        print(f"    Alert 1 [ID {alert_id}]: {alerts[0]['nudge_text']} (Risk: {alerts[0]['risk_level']})")
        
        # Test marking alert as read (POST /alerts/{id}/read)
        print(f"  Testing POST /alerts/{alert_id}/read ...")
        response = client.post(f"/alerts/{alert_id}/read")
        assert response.status_code == 200
        assert response.json()["is_read"] is True
        print("    Alert marked as read successfully.")

    # 8. Test Schedule Generation (POST /schedule/generate)
    print("\nTesting POST /schedule/generate ...")
    response = client.post("/schedule/generate")
    assert response.status_code == 200
    schedule_blocks = response.json()
    print(f"  Generated {len(schedule_blocks)} schedule blocks.")
    if schedule_blocks:
        print(f"    First block: '{schedule_blocks[0]['title']}' ({schedule_blocks[0]['type']})")

    # 9. Test Schedule Retrieval (GET /schedule)
    print("\nTesting GET /schedule ...")
    response = client.get("/schedule")
    assert response.status_code == 200
    schedule = response.json()
    assert len(schedule) == len(schedule_blocks)
    print(f"  Successfully fetched {len(schedule)} active schedule blocks.")

    # 10. Test Brainstorm Chat Endpoint (POST /chat)
    print("\nTesting POST /chat ...")
    chat_payload = {
        "message": "I don't know where to start with building the React dashboard. Can you give me an initial checklist?",
        "task_id": task_id
    }
    response = client.post("/chat", json=chat_payload)
    assert response.status_code == 200
    chat_response = response.json()
    print(f"  AI Brainstorm Reply:\n---\n{chat_response['reply']}\n---")

    # 11. Test Task Deletion (DELETE /tasks/{id})
    print(f"\nTesting DELETE /tasks/{task_id} ...")
    response = client.delete(f"/tasks/{task_id}")
    assert response.status_code == 204
    
    # Confirm deletion
    response = client.get(f"/tasks/{task_id}")
    assert response.status_code == 404
    print("  Task deleted and verified gone.")

    print("\n--- ALL BACKEND API TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_api_tests()
