"""
Automated Test Suite
Smart Air Quality Monitoring and Health Risk Prediction System
Dept of CSE, HSIT Nidasoshi (2025-26)
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.ml.predictor import predictor_instance
from backend.database import init_db, save_telemetry, get_latest_telemetry, get_alerts, export_csv_data


class TestAirQualitySystem(unittest.TestCase):

    def setUp(self):
        init_db()

    def test_co2_prediction_physics(self):
        """Verify CO -> CO2 inference follows atmospheric & combustion physics."""
        # Baseline clean air (CO near 0.2 ppm) -> CO2 should be ~415 - 450 ppm
        pred_clean, low_clean, high_clean = predictor_instance.predict_co2(0.2, 22.0, 50.0)
        self.assertGreaterEqual(pred_clean, 400.0)
        self.assertLessEqual(pred_clean, 500.0)
        self.assertLessEqual(low_clean, pred_clean)
        self.assertGreaterEqual(high_clean, pred_clean)

        # Combustion pollution (CO = 15 ppm) -> CO2 should elevate significantly (> 1000 ppm)
        pred_polluted, _, _ = predictor_instance.predict_co2(15.0, 30.0, 60.0)
        self.assertGreater(pred_polluted, 900.0)

        # Monotonicity test: Higher CO should yield strictly higher CO2
        self.assertGreater(pred_polluted, pred_clean)

    def test_aqi_calculation(self):
        """Verify AQI sub-index calculations adhere to CPCB thresholds."""
        # Low CO (0.3 ppm ≈ 0.34 mg/m3) -> Good (0-50)
        aqi_good, cat_good, _ = predictor_instance.calculate_aqi(0.3)
        self.assertEqual(cat_good, "Good")
        self.assertLessEqual(aqi_good, 50)

        # Moderate CO (5.0 ppm ≈ 5.7 mg/m3) -> Moderate (101-200)
        aqi_mod, cat_mod, _ = predictor_instance.calculate_aqi(5.0)
        self.assertEqual(cat_mod, "Moderate")
        self.assertGreaterEqual(aqi_mod, 101)
        self.assertLessEqual(aqi_mod, 200)

        # Hazardous CO (35.0 ppm ≈ 40 mg/m3) -> Severe (>400)
        aqi_sev, cat_sev, _ = predictor_instance.calculate_aqi(35.0)
        self.assertEqual(cat_sev, "Severe")
        self.assertGreaterEqual(aqi_sev, 400)

    def test_health_risk_evaluation(self):
        """Verify clinical health risk categorization and medical precautions."""
        # Clean conditions
        res_clean = predictor_instance.process_telemetry(22.0, 50.0, 0.5)
        self.assertEqual(res_clean["health_risk_level"], "Low")
        self.assertIn("None required", res_clean["mask_recommendation"])

        # Hazardous conditions
        res_hazard = predictor_instance.process_telemetry(36.0, 80.0, 35.0)
        self.assertIn(res_hazard["health_risk_level"], ["High", "Severe"])
        self.assertIn("respirator", res_hazard["mask_recommendation"].lower())

    def test_database_persistence_and_alerts(self):
        """Verify SQLite insertion, alert generation, and CSV export."""
        # Save a high CO reading to trigger alert
        hazard_data = predictor_instance.process_telemetry(32.0, 65.0, 28.5, device_id="TEST_HAZARD")
        rec_id = save_telemetry(hazard_data)
        self.assertIsNotNone(rec_id)

        # Verify reading is in latest telemetry
        latest = get_latest_telemetry()
        self.assertEqual(latest["device_id"], "TEST_HAZARD")
        self.assertAlmostEqual(latest["co_ppm"], 28.5, places=1)

        # Verify critical alert was generated
        alerts = get_alerts(5)
        self.assertTrue(any(a["severity"] == "CRITICAL" and a["parameter"] == "CO" for a in alerts))

        # Verify CSV export contains headers and data
        csv_text = export_csv_data()
        self.assertIn("temperature,humidity,co_ppm,predicted_co2_ppm", csv_text)
        self.assertIn("TEST_HAZARD", csv_text)


if __name__ == "__main__":
    unittest.main()
