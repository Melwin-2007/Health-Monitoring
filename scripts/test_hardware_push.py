"""
Hardware Telemetry Emulation Tool
Simulates physical microcontroller (ESP32/ESP8266) sending sensor readings
to the FastAPI IoT ingestion endpoint: POST /api/iot/ingest
"""

import sys
import time
import random
import argparse
import urllib.request
import json


def push_reading(server_url: str, temp: float, hum: float, co: float, device_id: str = "ESP32_PHYSICAL_01"):
    payload = {
        "device_id": device_id,
        "temperature": round(temp, 2),
        "humidity": round(hum, 2),
        "co_ppm": round(co, 2)
    }
    data_bytes = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        server_url,
        data=data_bytes,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            res_body = response.read().decode('utf-8')
            res_json = json.loads(res_body)
            t = res_json.get("data", {})
            print(f"[{time.strftime('%X')}] Packet Sent: Temp={temp:.1f}°C Hum={hum:.0f}% CO={co:.2f}ppm "
                  f"==> Inferred CO2={t.get('predicted_co2_ppm', 'N/A')}ppm | AQI={t.get('aqi', 'N/A')} ({t.get('aqi_category')}) | Risk={t.get('health_risk_level')}")
            return True
    except Exception as e:
        print(f"[{time.strftime('%X')}] Transmission error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Emulate ESP32 hardware sending telemetry to Air Quality backend")
    parser.add_argument("--url", default="http://127.0.0.1:8000/api/iot/ingest", help="Ingest URL")
    parser.add_argument("--temp", type=float, default=26.5, help="Temperature in °C")
    parser.add_argument("--hum", type=float, default=58.0, help="Humidity in %")
    parser.add_argument("--co", type=float, default=3.2, help="CO in ppm")
    parser.add_argument("--stream", action="store_true", help="Send continuous stream every 2 seconds")
    parser.add_argument("--count", type=int, default=10, help="Number of packets in stream mode")
    args = parser.parse_args()

    print("==================================================")
    print("  ESP32 Hardware Telemetry Emulator")
    print(f"  Target Endpoint: {args.url}")
    print("==================================================")

    if not args.stream:
        push_reading(args.url, args.temp, args.hum, args.co)
    else:
        print(f"Starting stream mode ({args.count} packets, 2.0s interval)... Press Ctrl+C to stop.")
        curr_temp = args.temp
        curr_hum = args.hum
        curr_co = args.co
        try:
            for i in range(args.count):
                # Apply small realistic fluctuations
                curr_temp += random.uniform(-0.3, 0.3)
                curr_hum = max(10, min(95, curr_hum + random.uniform(-1.0, 1.0)))
                curr_co = max(0.1, curr_co + random.uniform(-0.25, 0.25))
                push_reading(args.url, curr_temp, curr_hum, curr_co)
                time.sleep(2.0)
        except KeyboardInterrupt:
            print("\nStopped hardware stream.")


if __name__ == "__main__":
    main()
