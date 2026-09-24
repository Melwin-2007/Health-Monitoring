"""
Groq AI & Synopsis Clinical Analysis Service
Smart Air Quality Monitoring and Health Risk Prediction System
Department of CSE, HSIT Nidasoshi (2025-26)

Integrates Groq API (LLaMA-3.3-70B-Versatile) for conversational user Q&A,
clinical diagnostics, and predictive air quality forecasting.
Includes an intelligent friendly conversational fallback engine when no key is provided.
"""

import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"


def query_groq_api(prompt: str, system_prompt: str, api_key: Optional[str] = None) -> Optional[str]:
    """Calls Groq Cloud API with given prompt."""
    key = api_key or os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        return None

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "User-Agent": "AirQual-HSIT-System/2.0"
    }

    body = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.4,
        "max_tokens": 800
    }

    try:
        req = urllib.request.Request(
            GROQ_ENDPOINT,
            data=json.dumps(body).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=12) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return res_data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[GROQ API ERROR] {e}")
        return None


def generate_conversational_fallback(question: str, telemetry: Dict[str, Any]) -> str:
    """Friendly, conversational plain-English answer tailored to the user's specific question and current air readings."""
    q = question.lower()
    co = telemetry.get("co_ppm", 3.0)
    co2 = telemetry.get("predicted_co2_ppm", 580.0)
    temp = telemetry.get("temperature", 28.0)
    hum = telemetry.get("humidity", 60.0)
    aqi = telemetry.get("aqi", 115)
    aqi_cat = telemetry.get("aqi_category", "Moderate")
    risk_level = telemetry.get("health_risk_level", "Low")

    # Question about exercise / jogging / outdoor activity
    if any(w in q for w in ["exercise", "jog", "run", "workout", "play", "outside", "outdoor"]):
        if aqi <= 100:
            return f"Yes, it is completely safe to exercise and play outdoors right now! The Air Quality Index is {aqi} ({aqi_cat}), and harmful gases are well within safe limits. Enjoy your time outside."
        elif aqi <= 200:
            return f"You can still go outdoors, but keep high-intensity workouts moderate. The Air Quality Index is currently {aqi} ({aqi_cat}) with Carbon Monoxide at {co} ppm. If you start feeling throat irritation or shortness of breath, take a break indoors."
        else:
            return f"No, outdoor workouts are NOT recommended right now. The Air Quality Index is elevated at {aqi} ({aqi_cat}) with high smoke/CO levels of {co} ppm. Please exercise indoors in a room with clean, filtered air."

    # Question about children, elderly, or asthma
    if any(w in q for w in ["asthma", "child", "kid", "elderly", "senior", "grandparent", "heart"]):
        if risk_level == "Low":
            return f"Current air quality is safe for children, seniors, and asthma patients. The air is clean, and predicted CO2 is {round(co2)} ppm (well ventilated). Keep routine inhalers handy as normal best practice."
        elif risk_level == "Moderate":
            return f"Sensitive groups (including children, elderly, and people with asthma or heart conditions) should observe mild caution. With AQI at {aqi}, prolonged outdoor exertion may cause mild coughing. Keep rescue inhalers accessible."
        else:
            return f"Alert: Sensitive individuals (asthma, COPD, heart disease, elderly, and children) should stay indoors in a well-ventilated room with an air purifier running. The Air Quality Index is {aqi} ({aqi_cat}). Avoid outdoor exposure."

    # Question about masks
    if any(w in q for w in ["mask", "n95", "protect"]):
        if aqi <= 100:
            return f"No protective mask is required right now! The air is clean and safe to breathe naturally."
        elif aqi <= 200:
            return f"A standard surgical mask or cloth mask is helpful if you are walking through busy traffic or dusty areas. For high-pollution pockets, an N95 mask offers the best protection."
        else:
            return f"Yes, wearing an N95 or multi-layer particulate mask is strongly advised whenever going outside. The air quality is currently {aqi_cat} (AQI: {aqi})."

    # Question about windows & ventilation
    if any(w in q for w in ["window", "ventilate", "ventilation", "door", "purifier", "ac"]):
        if aqi <= 100:
            return f"Keep your windows open! Outdoor air is fresh, and opening windows creates a natural cross-breeze that keeps indoor CO2 low (currently predicted at a healthy {round(co2)} ppm)."
        elif aqi <= 200:
            return f"Keep windows cracked open for mild airflow, or use an indoor air purifier. If you smell outdoor smoke or vehicle exhaust, close the windows facing the road."
        else:
            return f"Close all windows and doors right now to prevent polluted outdoor air from entering. Turn on an indoor air purifier (HEPA + activated carbon filter) to scrub the air."

    # Question about how CO2 is predicted from CO (The Core Synopsis Question!)
    if any(w in q for w in ["predict", "why", "how", "co2", "hardware", "calculate", "infer", "sensor"]):
        return (
            f"Here is how our system works: Hardware sensors directly measure Carbon Monoxide (CO) from smoke and fuel combustion, plus temperature ({temp}°C) and humidity ({hum}%). "
            f"Whenever fuel, gas, or biomass burns, it produces both CO and CO2 at a natural combustion ratio. "
            f"Instead of requiring an expensive dedicated CO2 sensor, our trained Machine Learning model (Random Forest) accurately predicts that current indoor CO2 is approximately {round(co2)} ppm based on the sensed CO ({co} ppm) and room ventilation!"
        )

    # General / What is the air quality now?
    return (
        f"Right now, the air quality is {aqi_cat} with an overall Air Quality Index of {aqi}/500. "
        f"Hardware sensors detect {co} ppm of Carbon Monoxide, and our AI predicts {round(co2)} ppm of Carbon Dioxide. "
        f"Temperature is {temp}°C with {hum}% humidity. Overall health risk is {risk_level}."
    )


def answer_user_question(question: str, telemetry: Dict[str, Any], api_key: Optional[str] = None) -> Dict[str, Any]:
    """Answers any user question using Groq LLaMA-3.3-70B or the conversational clinical engine."""
    q = question.strip()
    if not q:
        q = "What is the current air quality condition?"

    sys_prompt = (
        "You are AirQual AI, a friendly, caring, and expert air quality and environmental health assistant "
        "designed for the Department of CSE, HSIT Nidasoshi (2025-26). "
        "The user is asking a direct question about their air, health, symptoms, safety, or how the system works. "
        "Explain things simply, clearly, and warmly so that any normal person or student can understand without confusing jargon. "
        "Keep your answer punchy, helpful, and directly tailored to the current sensor readings."
    )

    user_prompt = f"""
Current Live Environmental Readings:
- Carbon Monoxide (CO): {telemetry.get('co_ppm')} ppm (sensed from hardware)
- Predicted Carbon Dioxide (CO2): {telemetry.get('predicted_co2_ppm')} ppm (predicted by our AI model)
- Air Quality Index (AQI): {telemetry.get('aqi')} ({telemetry.get('aqi_category')})
- Temperature: {telemetry.get('temperature')} °C | Relative Humidity: {telemetry.get('humidity')} %
- Health Risk Level: {telemetry.get('health_risk_level')}

User's Question: "{q}"

Please provide a clear, friendly, and practical answer in 2 to 4 simple paragraphs.
"""

    ai_text = query_groq_api(user_prompt, sys_prompt, api_key)
    is_groq = False

    if ai_text:
        is_groq = True
        ans = ai_text
    else:
        ans = generate_conversational_fallback(q, telemetry)

    return {
        "status": "success",
        "provider": "Groq LLaMA-3.3-70B" if is_groq else "AirQual Intelligent Assistant",
        "is_live_groq": is_groq,
        "question": q,
        "answer": ans
    }


def analyze_with_ai(telemetry: Dict[str, Any], task_type: str = "diagnostic", api_key: Optional[str] = None) -> Dict[str, Any]:
    """Automated diagnostic evaluation."""
    if task_type == "chat":
        return answer_user_question("Explain current air quality and health precautions", telemetry, api_key)
    
    # Standard diagnosis
    return answer_user_question("What is the detailed health diagnostic for current air readings?", telemetry, api_key)
