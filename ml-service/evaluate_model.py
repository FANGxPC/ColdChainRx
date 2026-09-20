#!/usr/bin/env python3
"""
ColdChainRx — Anomaly Model Evaluation & Rule-Based Comparison Script
Member: Sadique (ML / Frontend Lead)
Roadmap Focus: Week 5 Deliverable

Evaluates the trained Isolation Forest anomaly detection model on test samples
and compares prediction outputs against a simple threshold-based rule engine.
"""

import os
import json
import joblib
import pandas as pd
import numpy as np

def run_evaluation():
    print("=" * 70)
    print("ColdChainRx: Anomaly Model Evaluation & Baseline Comparison")
    print("=" * 70)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(script_dir, "models")
    model_file = os.path.join(models_dir, "isolation_forest_model.joblib")
    scaler_file = os.path.join(models_dir, "scaler.joblib")
    metadata_file = os.path.join(models_dir, "model_metadata.json")

    if not os.path.exists(model_file) or not os.path.exists(scaler_file):
        raise FileNotFoundError("Trained model or scaler not found. Run train_anomaly_model.py first!")

    iso_forest = joblib.load(model_file)
    scaler = joblib.load(scaler_file)

    with open(metadata_file, "r") as f:
        metadata = json.load(f)

    feature_cols = metadata["feature_names"]
    print(f"--> Loaded model trained on features: {feature_cols}")

    # Real & synthetic test cases reflecting dataset distributions
    test_cases = [
        {
            "scenario": "Ultra-Low Cryo Vault (-70°C Normal Log)",
            "data": {
                "thermal_shipper_temp_reading": -70.0,
                "room_temp_reading": -70.0,
                "room_humidity_reading": 95.0,
                "item_expiry_hours": 840.0,
                "ultra_low_temperature_freezer_hours": 240.0,
                "out_of_bound_temperature_hours": 0.0,
                "refrigeration_temperature_hours": 0.0,
                "temp_delta": abs(-70.0 - (-70.0))
            }
        },
        {
            "scenario": "Standard Refrigerated Transit (4.5°C Normal)",
            "data": {
                "thermal_shipper_temp_reading": 4.5,
                "room_temp_reading": 20.0,
                "room_humidity_reading": 90.0,
                "item_expiry_hours": 600.0,
                "ultra_low_temperature_freezer_hours": 0.0,
                "out_of_bound_temperature_hours": 0.0,
                "refrigeration_temperature_hours": 12.0,
                "temp_delta": abs(4.5 - 20.0)
            }
        },
        {
            "scenario": "Severe Thermal Excursion Spike (14.5°C Breach)",
            "data": {
                "thermal_shipper_temp_reading": 14.5,
                "room_temp_reading": 25.0,
                "room_humidity_reading": 92.0,
                "item_expiry_hours": 400.0,
                "ultra_low_temperature_freezer_hours": 0.0,
                "out_of_bound_temperature_hours": 6.0,
                "refrigeration_temperature_hours": 5.0,
                "temp_delta": abs(14.5 - 25.0)
            }
        },
        {
            "scenario": "Sensor Malfunction / Extreme Out-of-Bound (55°C Spike)",
            "data": {
                "thermal_shipper_temp_reading": 55.0,
                "room_temp_reading": 22.0,
                "room_humidity_reading": 65.0,
                "item_expiry_hours": 100.0,
                "ultra_low_temperature_freezer_hours": 0.0,
                "out_of_bound_temperature_hours": 7.0,
                "refrigeration_temperature_hours": 0.0,
                "temp_delta": abs(55.0 - 22.0)
            }
        }
    ]

    print("\n" + "-" * 74)
    print(f"{'Scenario Description':<44} | {'Rule Flag':<9} | {'ML Pred':<8} | {'Score':<8}")
    print("-" * 74)

    for case in test_cases:
        df_single = pd.DataFrame([case["data"]])[feature_cols]
        scaled_single = scaler.transform(df_single)

        pred = iso_forest.predict(scaled_single)[0]
        score = iso_forest.decision_function(scaled_single)[0]

        # Rule-based threshold check
        temp = case["data"]["thermal_shipper_temp_reading"]
        out_of_bound = case["data"]["out_of_bound_temperature_hours"]
        is_rule_anomaly = (temp > 8.0) or (out_of_bound > 0.0)

        rule_label = "ANOMALY" if is_rule_anomaly else "NORMAL"
        ml_label = "NORMAL" if pred == 1 else "ANOMALY"

        print(f"{case['scenario']:<44} | {rule_label:<9} | {ml_label:<8} | {score:<.4f}")

    print("-" * 74)
    print("--> Evaluation completed cleanly! ML model ready for Week 6 microservice deployment.")
    print("=" * 70)

if __name__ == "__main__":
    run_evaluation()
