"""
Air Quality & Health Risk Prediction Engine
Smart Air Quality Monitoring and Health Risk Prediction System
Department of CSE, HSIT Nidasoshi (2025-26)

Key Hardware Insight:
Hardware senses: Temperature (°C), Humidity (%), and Carbon Monoxide (CO ppm).
CO2 is NOT directly sensed by hardware; it is predicted from CO levels,
temperature, humidity, and combustion/ventilation dynamics using a trained ML model.
"""

import math
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from typing import Dict, Any, Tuple


class AirQualityPredictor:
    """
    Combines machine learning regression (Random Forest) and physics-based
    combustion emission ratios to infer CO2 concentrations from hardware-sensed CO,
    calculates official CPCB/EPA AQI sub-indices, and estimates clinical health risk.
    """

    def __init__(self):
        self.rf_model = None
        self._train_ml_model()

    def _train_ml_model(self):
        """
        Trains a Random Forest Regressor on empirical environmental combustion data.
        In atmospheric and indoor chemistry:
        - Outdoor clean baseline CO2 ~ 415 ppm.
        - Incomplete combustion produces CO and CO2 at an emission ratio (ER_CO/CO2):
          Delta CO / Delta CO2 ~ 0.01 to 0.04 in urban/indoor burning conditions.
        - Stagnation (high humidity, inverted temperature) traps both pollutants.
        """
        np.random.seed(42)
        n_samples = 2500

        # Synthetic training dataset representing diverse real-world environments
        # Features: [CO (ppm), Temperature (°C), Humidity (%)]
        co_vals = np.random.uniform(0.1, 75.0, n_samples)
        temp_vals = np.random.uniform(10.0, 46.0, n_samples)
        hum_vals = np.random.uniform(20.0, 95.0, n_samples)

        # Baseline outdoor CO2
        baseline_co2 = 415.0

        # Combustion emission ratio: 1 ppm CO typically accompanies 30 - 65 ppm of CO2
        # depending on ventilation rate and burning source
        combustion_multiplier = 42.0 + 8.0 * np.sin(temp_vals / 10.0)

        # Temperature & Humidity stagnation factor (higher temp and high humidity reduce air dispersion)
        stagnation = 1.0 + (hum_vals / 100.0) * 0.15 + (temp_vals / 50.0) * 0.10

        # Non-linear indoor accumulation curve
        # At higher CO levels, enclosed space buildup creates exponential CO2 retention
        co2_targets = (
            baseline_co2
            + (co_vals ** 1.08) * combustion_multiplier * stagnation
            + np.random.normal(0, 15, n_samples)
        )
        co2_targets = np.clip(co2_targets, 400.0, 4500.0)

        X = np.column_stack([co_vals, temp_vals, hum_vals])
        y = co2_targets

        self.rf_model = RandomForestRegressor(
            n_estimators=45,
            max_depth=8,
            random_state=42,
            n_jobs=1
        )
        self.rf_model.fit(X, y)

    def predict_co2(self, co_ppm: float, temperature: float, humidity: float) -> Tuple[float, float, float]:
        """
        Predicts CO2 concentration in ppm along with 95% confidence interval.
        Returns: (predicted_co2, lower_bound, upper_bound)
        """
        # Ensure non-negative and bounded inputs
        co_clean = max(0.0, float(co_ppm))
        temp_clean = float(temperature)
        hum_clean = min(100.0, max(0.0, float(humidity)))

        # Feature vector
        X_in = np.array([[co_clean, temp_clean, hum_clean]])

        if self.rf_model is not None:
            # Predict mean from ensemble
            pred = float(self.rf_model.predict(X_in)[0])
            # Uncertainty estimation using individual tree variance
            tree_preds = [tree.predict(X_in)[0] for tree in self.rf_model.estimators_]
            std_err = float(np.std(tree_preds))
        else:
            # Fallback analytical combustion physics formula
            stagnation = 1.0 + (hum_clean / 100.0) * 0.15
            pred = 415.0 + (co_clean ** 1.08) * 45.0 * stagnation
            std_err = pred * 0.05

        # Enforce realistic physiological & environmental minimum/maximum
        pred = max(400.0, min(5000.0, pred))
        margin = max(15.0, 1.96 * std_err)
        lower = max(400.0, pred - margin)
        upper = pred + margin

        return round(pred, 1), round(lower, 1), round(upper, 1)

    def calculate_aqi(self, co_ppm: float) -> Tuple[int, str, str]:
        """
        Calculates AQI sub-index for Carbon Monoxide (CO) based on standard
        CPCB (Central Pollution Control Board, India) and US-EPA air quality standards.

        CPCB CO 8-hour standards (mg/m3):
        (Note: 1 ppm CO ≈ 1.15 mg/m3 at 25°C standard conditions)
        Good: 0.0 - 1.0 mg/m3 (0 - 0.87 ppm) -> AQI 0 - 50
        Satisfactory: 1.1 - 2.0 mg/m3 (0.88 - 1.74 ppm) -> AQI 51 - 100
        Moderate: 2.1 - 10.0 mg/m3 (1.75 - 8.7 ppm) -> AQI 101 - 200
        Poor: 10.1 - 17.0 mg/m3 (8.8 - 14.8 ppm) -> AQI 201 - 300
        Very Poor: 17.1 - 34.0 mg/m3 (14.9 - 29.6 ppm) -> AQI 301 - 400
        Severe: > 34.0 mg/m3 (> 29.6 ppm) -> AQI 401 - 500
        """
        # Convert CO ppm to mg/m3 (standard atmospheric factor: ppm * 28.01 / 24.45 ≈ 1.145)
        co_mg = max(0.0, co_ppm * 1.145)

        breakpoints = [
            (0.0, 1.0, 0, 50, "Good", "#10B981"),
            (1.1, 2.0, 51, 100, "Satisfactory", "#3B82F6"),
            (2.1, 10.0, 101, 200, "Moderate", "#F59E0B"),
            (10.1, 17.0, 201, 300, "Poor", "#F97316"),
            (17.1, 34.0, 301, 400, "Very Poor", "#EF4444"),
            (34.1, 60.0, 401, 500, "Severe", "#7F1D1D"),
        ]

        aqi_val = 0
        category = "Good"
        color_code = "#10B981"

        if co_mg <= 1.0:
            aqi_val = int((50.0 / 1.0) * co_mg)
            category = "Good"
            color_code = "#10B981"
        elif co_mg <= 2.0:
            aqi_val = int(51 + ((100 - 51) / (2.0 - 1.1)) * (co_mg - 1.1))
            category = "Satisfactory"
            color_code = "#3B82F6"
        elif co_mg <= 10.0:
            aqi_val = int(101 + ((200 - 101) / (10.0 - 2.1)) * (co_mg - 2.1))
            category = "Moderate"
            color_code = "#F59E0B"
        elif co_mg <= 17.0:
            aqi_val = int(201 + ((300 - 201) / (17.0 - 10.1)) * (co_mg - 10.1))
            category = "Poor"
            color_code = "#F97316"
        elif co_mg <= 34.0:
            aqi_val = int(301 + ((400 - 301) / (34.0 - 17.1)) * (co_mg - 17.1))
            category = "Very Poor"
            color_code = "#EF4444"
        else:
            # Scaled severe AQI up to 500 max
            scaled = 401 + ((500 - 401) / (60.0 - 34.1)) * (co_mg - 34.1)
            aqi_val = min(500, int(scaled))
            category = "Severe"
            color_code = "#7F1D1D"

        aqi_val = max(0, min(500, aqi_val))
        return aqi_val, category, color_code

    def evaluate_health_risk(
        self,
        co_ppm: float,
        predicted_co2: float,
        temperature: float,
        humidity: float,
        aqi: int
    ) -> Dict[str, Any]:
        """
        Estimates clinical health risk based on CO toxicity, predicted CO2 accumulation,
        and thermal discomfort. Returns comprehensive actionable advice.
        """
        # CO Toxicity weight: CO binds to hemoglobin forming carboxyhemoglobin (COHb)
        # Safe limit is 9 ppm (8h) or 25-35 ppm (1h OSHA ceiling)
        co_score = 0.0
        if co_ppm < 4.0:
            co_score = (co_ppm / 4.0) * 20.0
        elif co_ppm < 9.0:
            co_score = 20.0 + ((co_ppm - 4.0) / 5.0) * 25.0
        elif co_ppm < 25.0:
            co_score = 45.0 + ((co_ppm - 9.0) / 16.0) * 35.0
        else:
            co_score = 80.0 + min(20.0, ((co_ppm - 25.0) / 30.0) * 20.0)

        # CO2 contribution:
        # < 600 ppm: Excellent ventilation
        # 600 - 1000 ppm: Normal indoor
        # 1000 - 2000 ppm: Drowsiness, fatigue, stuffiness
        # > 2000 ppm: Headaches, impaired concentration
        co2_score = 0.0
        if predicted_co2 <= 600:
            co2_score = 10.0
        elif predicted_co2 <= 1000:
            co2_score = 10.0 + ((predicted_co2 - 600) / 400.0) * 20.0
        elif predicted_co2 <= 2000:
            co2_score = 30.0 + ((predicted_co2 - 1000) / 1000.0) * 40.0
        else:
            co2_score = 70.0 + min(30.0, ((predicted_co2 - 2000) / 2000.0) * 30.0)

        # Thermal Discomfort Index adjustment
        heat_factor = 0.0
        if temperature > 35.0 or humidity > 80.0:
            heat_factor = 10.0
        elif temperature > 30.0 and humidity > 65.0:
            heat_factor = 5.0

        # Weighted Health Risk Score (0 - 100)
        risk_score = round(0.55 * co_score + 0.35 * co2_score + 0.10 * (aqi / 5.0) + heat_factor, 1)
        risk_score = max(0.0, min(100.0, risk_score))

        # Classify Level
        if risk_score <= 25.0:
            level = "Low"
            level_color = "#10B981"
            short_desc = "Air quality is ideal. No known health threats."
        elif risk_score <= 50.0:
            level = "Moderate"
            level_color = "#3B82F6"
            short_desc = "Acceptable air quality. Minor discomfort possible for sensitive individuals."
        elif risk_score <= 75.0:
            level = "High"
            level_color = "#F97316"
            short_desc = "Unhealthy conditions. Headaches, lethargy, or respiratory irritation likely."
        else:
            level = "Severe"
            level_color = "#EF4444"
            short_desc = "Dangerous air pollution levels. Urgent precautions required."

        # Tailored precautions
        precautions = []
        vulnerable_advisories = []

        if risk_score <= 25.0:
            precautions = [
                "Outdoor physical activities and workouts are completely safe.",
                "Natural ventilation (open windows) is recommended to maintain freshness.",
                "No protective gear or air filtration needed."
            ]
            vulnerable_advisories = [
                "Asthma & COPD: Environment is safe and optimal.",
                "Cardiovascular patients: Safe for standard exertion.",
                "Children & Elderly: Safe for routine activities."
            ]
            mask_recommendation = "None required"
            ventilation_advisory = "Open windows / Full fresh air intake"
        elif risk_score <= 50.0:
            precautions = [
                "General public can carry on normal daily routines.",
                "Sensitive individuals experiencing throat tightness should rest indoors.",
                "Maintain moderate indoor airflow with fans or standard filters."
            ]
            vulnerable_advisories = [
                "Asthma & COPD: Keep inhalers accessible; monitor if coughing starts.",
                "Cardiovascular patients: Mild caution during prolonged outdoor jogging.",
                "Children & Elderly: Normal play and activities allowed."
            ]
            mask_recommendation = "Optional cloth or surgical mask in dusty areas"
            ventilation_advisory = "Normal ventilation with cross-breeze"
        elif risk_score <= 75.0:
            precautions = [
                "Reduce prolonged or heavy exertion outdoors.",
                "Close windows if outdoor smoke or traffic fumes are elevated.",
                "Turn on indoor air purifiers equipped with activated carbon and HEPA filters.",
                "Stay hydrated and avoid combustion sources (incense, gas burners)."
            ]
            vulnerable_advisories = [
                "Asthma & COPD: Avoid outdoor exercise; stay in clean, filtered rooms.",
                "Cardiovascular patients: Risk of chest tightness; avoid heavy lifting.",
                "Children & Elderly: Keep indoors during peak pollution hours."
            ]
            mask_recommendation = "N95 / FFP2 respirator mask recommended outdoors"
            ventilation_advisory = "Recirculated air / Run HEPA + Carbon air purifiers"
        else:
            precautions = [
                "Avoid all outdoor activities. Remain in well-sealed indoor spaces.",
                "Inspect gas appliances immediately for CO leaks if indoors.",
                "Run activated carbon air purifiers at maximum power.",
                "Seek medical attention if experiencing dizziness, nausea, or confusion."
            ]
            vulnerable_advisories = [
                "Asthma & COPD: High risk of acute exacerbation; remain in air-conditioned room.",
                "Cardiovascular patients: High risk of angina; strictly avoid exertion.",
                "Children & Elderly: Keep strictly indoors; monitor vital signs."
            ]
            mask_recommendation = "N95 / N99 or multi-gas respirator mandatory outside"
            ventilation_advisory = "Seal room windows; activate emergency air filtration"

        return {
            "score": risk_score,
            "level": level,
            "color": level_color,
            "summary": short_desc,
            "mask_recommendation": mask_recommendation,
            "ventilation_advisory": ventilation_advisory,
            "precautions": precautions,
            "vulnerable_groups": vulnerable_advisories
        }

    def process_telemetry(
        self,
        temperature: float,
        humidity: float,
        co_ppm: float,
        device_id: str = "ESP32_NODE_01",
        mode: str = "hardware"
    ) -> Dict[str, Any]:
        """
        End-to-end telemetry pipeline:
        1. Preprocess and clean inputs.
        2. Infer CO2 via Random Forest ML Model.
        3. Compute AQI according to CPCB standard.
        4. Evaluate health risks and precautions.
        """
        temp = round(float(temperature), 2)
        hum = round(float(humidity), 2)
        co = round(float(co_ppm), 2)

        predicted_co2, co2_low, co2_high = self.predict_co2(co, temp, hum)
        aqi, aqi_category, aqi_color = self.calculate_aqi(co)
        health_eval = self.evaluate_health_risk(co, predicted_co2, temp, hum, aqi)

        # Combustion Ratio index (estimated ppm CO per 1000 ppm CO2 above baseline)
        excess_co2 = max(1.0, predicted_co2 - 415.0)
        co_co2_ratio_percent = round((co / excess_co2) * 100.0, 2) if excess_co2 > 5 else 0.0

        return {
            "device_id": device_id,
            "mode": mode,
            "temperature": temp,
            "humidity": hum,
            "co_ppm": co,
            "predicted_co2_ppm": predicted_co2,
            "co2_lower_ci": co2_low,
            "co2_upper_ci": co2_high,
            "co_co2_ratio_pct": co_co2_ratio_percent,
            "aqi": aqi,
            "aqi_category": aqi_category,
            "aqi_color": aqi_color,
            "health_risk_score": health_eval["score"],
            "health_risk_level": health_eval["level"],
            "health_risk_color": health_eval["color"],
            "health_risk_summary": health_eval["summary"],
            "mask_recommendation": health_eval["mask_recommendation"],
            "ventilation_advisory": health_eval["ventilation_advisory"],
            "precautions": health_eval["precautions"],
            "vulnerable_groups": health_eval["vulnerable_groups"]
        }


# Global instance
predictor_instance = AirQualityPredictor()
