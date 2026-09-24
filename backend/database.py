"""
SQLite Database Layer
Stores real-time telemetry from IoT hardware.
"""

import sqlite3
import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "airqual.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                temperature REAL NOT NULL,
                humidity REAL NOT NULL,
                co2 REAL NOT NULL,
                co REAL NOT NULL,
                pm REAL NOT NULL,
                level INTEGER NOT NULL
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_telemetry_time ON telemetry(timestamp)")
        conn.commit()

def save_telemetry(data: Dict[str, Any]) -> int:
    now_str = datetime.now().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO telemetry (
                timestamp, temperature, humidity, co2, co, pm, level
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            now_str,
            data.get("temperature", 25.0),
            data.get("humidity", 50.0),
            data.get("co2", 400.0),
            data.get("co", 0.0),
            data.get("pm", 0.0),
            data.get("level", 0)
        ))
        conn.commit()
        return cursor.lastrowid

def get_latest_telemetry() -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM telemetry ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        return dict(row) if row else None

def get_telemetry_history(limit: int = 60) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM telemetry ORDER BY id DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        return [dict(r) for r in reversed(rows)]

init_db()
