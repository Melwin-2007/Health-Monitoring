"""
FastAPI Server & REST API
"""

import os
from typing import Optional, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, Response, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.database import (
    init_db,
    save_telemetry,
    get_latest_telemetry,
    get_telemetry_history
)
from backend.ml.predictor import predictor_instance

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SERVER_STATE = {
    "last_hardware_ping": None,
}

class HardwareIngestPayload(BaseModel):
    temperature: float
    humidity: float
    co2: float
    co: float
    pm: float
    level: int

class AIQuestionPayload(BaseModel):
    question: str
    api_key: Optional[str] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    co: Optional[float] = None


@app.on_event("startup")
async def on_startup():
    init_db()

@app.post("/api/iot/ingest")
async def ingest_hardware_data(payload: HardwareIngestPayload):
    SERVER_STATE["last_hardware_ping"] = datetime.now().isoformat()
    
    data = payload.dict()
    # Process ML logic
    ml_output = predictor_instance.process_telemetry(data["temperature"], data["humidity"], data["co"])
    data["ml_data"] = ml_output
    
    rec_id = save_telemetry(data)
    data["record_id"] = rec_id
    data["timestamp"] = datetime.now().isoformat()
    
    return {"status": "success", "data": data}

@app.get("/api/telemetry/latest")
async def get_latest():
    data = get_latest_telemetry()
    if not data:
        data = {
            "temperature": 25.0,
            "humidity": 50.0,
            "co2": 400.0,
            "co": 0.0,
            "pm": 0.0,
            "level": 0
        }
    
    hw_online = False
    if SERVER_STATE["last_hardware_ping"]:
        try:
            last_dt = datetime.fromisoformat(SERVER_STATE["last_hardware_ping"])
            if (datetime.now() - last_dt).total_seconds() < 20:
                hw_online = True
        except:
            pass

    return {
        "status": "success",
        "telemetry": data,
        "system_status": {
            "hardware_connected": hw_online
        }
    }

@app.get("/api/telemetry/history")
async def get_history(limit: int = Query(default=30, ge=5, le=200)):
    history = get_telemetry_history(limit=limit)
    return {"status": "success", "count": len(history), "history": history}

@app.post("/api/ai/ask")
async def ask_ai(payload: AIQuestionPayload):
    from backend.ai_service import answer_user_question
    
    telemetry = {
        "temperature": payload.temperature,
        "humidity": payload.humidity,
        "co_ppm": payload.co,
        "predicted_co2_ppm": 400.0,
        "aqi": 50,
        "aqi_category": "Good",
        "health_risk_level": "Low"
    }
    
    return answer_user_question(payload.question, telemetry, payload.api_key)

# Frontend static files mounting
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    @app.get("/", response_class=HTMLResponse)
    async def serve_index():
        index_file = os.path.join(frontend_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return HTMLResponse("<h1>Frontend loading...</h1>")

    # Serve other files as requested by previous logic
    @app.get("/hardware", response_class=HTMLResponse)
    async def serve_hardware():
        return FileResponse(os.path.join(frontend_dir, "hardware.html"))
        
    @app.get("/simulator", response_class=HTMLResponse)
    async def serve_simulator():
        return FileResponse(os.path.join(frontend_dir, "simulator.html"))
