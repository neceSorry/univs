import uuid
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from genetic import generate_schedule

app = FastAPI(title="Scheduler Service")

tasks_db: Dict[str, str] = {}
results_db: Dict[str, Any] = {}


class LessonInput(BaseModel):
    curriculum_item_id: str
    group_id: str
    teacher_lecture_id: Optional[str] = None
    teacher_practice_id: Optional[str] = None
    teacher_lab_id: Optional[str] = None
    preferred_classroom_lecture: Optional[str] = None
    preferred_classroom_practice: Optional[str] = None
    preferred_classroom_lab: Optional[str] = None
    # Single preferred_classroom used when item is already pre-split by type
    preferred_classroom: Optional[str] = None
    hours_lecture: int = 0
    hours_practice: int = 0
    hours_lab: int = 0
    discipline_name: Optional[str] = None


class GenerateRequest(BaseModel):
    curriculum_items: List[Dict[str, Any]] = Field(default_factory=list)
    teacher_preferences: List[Dict[str, Any]] = Field(default_factory=list)
    # classrooms is no longer used — classrooms are text strings in curriculum_items
    classrooms: List[Dict[str, Any]] = Field(default_factory=list)
    weights: Optional[Dict[str, Any]] = None


def run_genetic_algorithm(task_id: str, req: GenerateRequest):
    try:
        tasks_db[task_id] = "running"
        result = generate_schedule({
            "curriculum_items": req.curriculum_items,
            "teacher_preferences": req.teacher_preferences,
            "weights": req.weights or {},
        })
        results_db[task_id] = result
        tasks_db[task_id] = "done"
    except Exception as e:
        tasks_db[task_id] = f"error: {str(e)}"


@app.post("/generate")
def generate_endpoint(req: GenerateRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    tasks_db[task_id] = "pending"
    background_tasks.add_task(run_genetic_algorithm, task_id, req)
    return {"task_id": task_id}


@app.get("/status/{task_id}")
def get_status(task_id: str):
    return {"status": tasks_db.get(task_id, "not_found")}


@app.get("/result/{task_id}")
def get_result(task_id: str):
    if task_id in results_db:
        return {"data": results_db[task_id]}
    return {"data": None, "message": "Result not ready or not found"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
