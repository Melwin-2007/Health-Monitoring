# Smart Air Quality Monitoring and Health Risk Prediction System
**Department of Computer Science & Engineering, HSIT Nidasoshi (2025-26)**

An end-to-end IoT and Machine Learning software system and real-time dashboard designed strictly in alignment with the **HSIT Nidasoshi Major Project Synopsis**.

---

## 🌟 Key Innovation: Machine Learning $\text{CO}_2$ Inference

### Why Hardware Doesn't Directly Sense $\text{CO}_2$:
Traditional optical NDIR (Non-Dispersive Infrared) $\text{CO}_2$ sensors are expensive, fragile, and power-hungry. In urban, vehicular, and indoor environments, combustion and human activity produce correlated concentrations of **Carbon Monoxide (CO)** and **Carbon Dioxide ($\text{CO}_2$)**.

```
          [ Fuel / Hydrocarbons Combustion ]
                     /              \
         (Incomplete)                (Complete)
              ↓                           ↓
   Carbon Monoxide (CO)         Carbon Dioxide (CO₂)
   [ Hardware Sensed ]           [ ML Predicted ]
```

### The ML Physics Formulation:
1. **Atmospheric Baseline**: Clean outdoor background $\text{CO}_2 \approx 415\text{ ppm}$.
2. **Emission Ratio ($ER_{CO/CO_2}$)**: In urban vehicle exhaust, cooking stoves, and biomass combustion, $\Delta CO / \Delta CO_2$ typically ranges between **$1\%$ to $4\%$**.
3. **Environmental Stagnation Factor**: High ambient humidity ($>65\%$) and elevated temperatures reduce natural air dispersion, trapping both gases in the lower canopy or room.
4. **Machine Learning Pipeline**:
   - **Trained Model**: Scikit-Learn `RandomForestRegressor` with 45 estimators and non-linear polynomial feature weighting.
   - **Input Features**: Monitored $\text{CO}$ ($\text{ppm}$), Temperature ($^\circ\text{C}$), Relative Humidity ($\%$).
   - **Output**: Predicted $\text{CO}_2$ ($\text{ppm}$) with dynamic $95\%$ Confidence Intervals.

---

## 🖥️ Dual-Mode Architecture

### 1. Actual Hardware Mode (Live IoT Stream)
- Microcontrollers (ESP32, ESP8266, NodeMCU, Arduino Wi-Fi) connect to your local Wi-Fi.
- Sensors:
  - **DHT11 / DHT22**: Pin `D4` for Temperature ($^\circ\text{C}$) and Humidity ($\%$)
  - **MQ-7 / MQ-9**: Analog Pin `A0` for Carbon Monoxide ($\text{ppm}$)
- Sends JSON telemetry payloads via HTTP POST to:
  ```http
  POST /api/iot/ingest
  Content-Type: application/json

  {
    "device_id": "ESP32_NODE_01",
    "temperature": 27.5,
    "humidity": 62.0,
    "co_ppm": 3.4
  }
  ```
- **Firmware included**: See [firmware/esp32_airqual.ino](firmware/esp32_airqual.ino) with calibrated $R_s / R_0$ power-law calculations.
- **Hardware Connection Indicator**: Real-time heartbeat radar pulse in the dashboard UI displaying connection status and live device pings.

### 2. Demo & Presentation Mode (Viva / Evaluation Sandbox)
- Built for seamless presentations, classroom viva, and offline demonstrations without requiring hardware to be connected.
- **Interactive Sliders**: Manually adjust Temperature ($10^\circ\text{C} - 45^\circ\text{C}$), Humidity ($15\% - 95\%$), and Sensed CO ($0.1 - 50\text{ ppm}$) and watch the ML engine recalculate $\text{CO}_2$, AQI, and health risk in real time.
- **Real-World Scenarios**:
  - 🏔️ **Clean Baseline**: Fresh mountain air ($\text{CO} \approx 0.4\text{ ppm}$, predicted $\text{CO}_2 \approx 415\text{ ppm}$, AQI: Good).
  - 🚗 **Urban Traffic**: Heavy traffic intersection ($\text{CO} \approx 8.5\text{ ppm}$, predicted $\text{CO}_2 \approx 850\text{ ppm}$, AQI: Moderate/Unhealthy for Sensitive).
  - 🍳 **Kitchen Smog**: Enclosed gas cooking ($\text{CO} \approx 18.2\text{ ppm}$, predicted $\text{CO}_2 \approx 1450\text{ ppm}$, AQI: Poor).
  - 🏭 **Industrial Hazard**: Severe stagnation & inversion ($\text{CO} \approx 38.0\text{ ppm}$, predicted $\text{CO}_2 \approx 2400\text{ ppm}$, AQI: Severe).
- **Dynamic Live Auto-Stream**: Toggle switch that continuously generates realistic sensor drift and noise every 2.5 seconds to animate charts and gauges live during your viva.

---

## 📊 Air Quality & Health Risk Engine

### 1. CPCB / US-EPA Standard AQI Breakpoints:
| CO Concentration ($\text{mg/m}^3$) | Approx. CO ($\text{ppm}$) | AQI Range | Category | Color Code |
|:---|:---|:---|:---|:---|
| $0.0 - 1.0$ | $0.0 - 0.87$ | $0 - 50$ | **Good** | Emerald (`#10B981`) |
| $1.1 - 2.0$ | $0.88 - 1.74$ | $51 - 100$ | **Satisfactory** | Blue (`#3B82F6`) |
| $2.1 - 10.0$ | $1.75 - 8.7$ | $101 - 200$ | **Moderate** | Amber (`#F59E0B`) |
| $10.1 - 17.0$ | $8.8 - 14.8$ | $201 - 300$ | **Poor** | Orange (`#F97316`) |
| $17.1 - 34.0$ | $14.9 - 29.6$ | $301 - 400$ | **Very Poor** | Red (`#EF4444`) |
| $> 34.0$ | $> 29.6$ | $401 - 500$ | **Severe** | Dark Red (`#7F1D1D`) |

### 2. Clinical Health Risk Formulation:
The system computes an aggregate **Health Risk Score ($0 - 100$)**:
$$\text{Health Risk} = 0.55 \cdot S_{CO} + 0.35 \cdot S_{CO_2} + 0.10 \cdot \left(\frac{\text{AQI}}{5}\right) + \text{Thermal Discomfort Adjustment}$$
- **$S_{CO}$**: Carboxyhemoglobin toxicity index based on the Coburn-Foster-Kane (CFK) physiological equation.
- **$S_{CO_2}$**: Hypercapnia and cognitive impairment index ($>1000\text{ ppm}$ causes drowsiness; $>2000\text{ ppm}$ causes headaches).
- **Actionable Precautions**:
  - Mask Guidance: None / Surgical / N95 / FFP2 / Multi-gas respirator.
  - Room Ventilation Advisory: Fresh cross ventilation vs seal windows and run HEPA + activated carbon air purifiers.
  - Vulnerable Demographics: Specific clinical advice for **Asthma/COPD**, **Cardiovascular patients**, and **Elderly & Children**.

---

## 🚀 Quickstart Guide

### 1. Launch the Dashboard
Double-click:
```cmd
run_dashboard.bat
```
Or run from terminal:
```bash
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
```
Open your browser at: **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

### 2. Test Hardware Ingestion (CLI Emulator)
To test how the system receives data from physical hardware without needing an ESP32 connected:
```bash
# Push a single reading
python scripts/test_hardware_push.py --temp 28.5 --hum 62.0 --co 4.5

# Send a continuous 10-packet live stream
python scripts/test_hardware_push.py --stream --count 20
```

### 3. Run Automated Tests
```bash
python tests/test_system.py
```

---

## 📁 Project Structure

```
AirQual/
├── backend/
│   ├── app.py                  # FastAPI REST API & static file mount
│   ├── database.py             # SQLite persistence, alerts, and CSV export
│   └── ml/
│       └── predictor.py        # Random Forest ML CO->CO2 predictor & AQI engine
├── frontend/
│   ├── index.html              # Executive modern responsive dashboard UI
│   ├── styles.css              # Custom styling, glow effects, slider aesthetics
│   └── app.js                  # Chart.js time series, AQI gauge, live polling
├── firmware/
│   └── esp32_airqual.ino       # Ready-to-flash Arduino C++ sketch for ESP32/ESP8266
├── scripts/
│   └── test_hardware_push.py   # CLI tool to emulate hardware packets
├── tests/
│   └── test_system.py          # Automated verification test suite
├── run_dashboard.bat           # Windows one-click launcher
├── Major project synopsis.pdf  # Project synopsis document (HSIT Nidasoshi)
└── README.md                   # System documentation and viva guide
```

---

## 🎓 Viva & Presentation Talking Points
1. **"Why not just put a $CO_2$ sensor?"**  
   *Answer*: Standard $CO_2$ NDIR sensors (like MH-Z19) cost 10x more than MQ gas sensors, draw significant current, and drift over time. By modeling incomplete vs complete combustion ($ER_{CO/CO_2}$) with a Random Forest Regressor trained on thermal and humidity stagnation factors, we achieve accurate $CO_2$ estimates at a fraction of the hardware cost.
2. **"How does the alert system work?"**  
   *Answer*: The backend evaluates sensor thresholds ($CO > 9\text{ ppm}$ CPCB standard, or $> 25\text{ ppm}$ critical ceiling). When triggered, it logs the event in SQLite, presents an alert drawer badge, and plays an audio warning chime.
3. **"Can we export the data?"**  
   *Answer*: Yes, click the **Export CSV** button in the dashboard header to download a complete historical audit trail with all timestamps, sensor readings, predicted values, and risk scores.
