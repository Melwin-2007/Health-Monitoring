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
    import httpx
    if not payload.api_key:
        return {
            "status": "success",
            "question": payload.question,
            "provider": "Local Fallback AI",
            "answer": f"You asked: {payload.question}\n\nSince no Groq API Key was provided, this is a fallback answer based on your telemetry: T={payload.temperature}C, H={payload.humidity}%, CO={payload.co}ppm."
        }

    headers = {
        "Authorization": f"Bearer {payload.api_key}",
        "Content-Type": "application/json"
    }
    prompt = f"The user asks: {payload.question}. Current telemetry: Temp {payload.temperature}C, Humidity {payload.humidity}%, CO {payload.co}ppm. Provide a short, plain-english answer."
    data = {
        "model": "llama3-8b-8192",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 150
    }
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=data, timeout=10.0)
            resp.raise_for_status()
            res_json = resp.json()
            answer = res_json['choices'][0]['message']['content']
            return {"status": "success", "question": payload.question, "provider": "Groq LLaMA", "answer": answer}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

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
