#!/usr/bin/env python3
"""
ColdChainRx — Anomaly Model Evaluation & Rule-Based Comparison Script
Member: Sadique (ML / Frontend Lead)

Evaluates the retrained Isolation Forest anomaly detection model on test samples
drawn from realistic single-sensor (temperature + humidity) readings and compares
ML predictions against a simple rule-based threshold engine.

Real sensor data profile (from training metadata):
  Temperature: mean ~9.6°C, range 4.8–42.2°C
  Humidity:    mean ~76.6%, range 26.1–99.9%
"""

import os
import json
import warnings
import joblib
import numpy as np
from collections import deque

# Suppress sklearn "feature names" warning when passing raw numpy arrays
warnings.filterwarnings("ignore", message="X does not have valid feature names")

WINDOW = 12  # Must match train_anomaly_model.py


def compute_features(readings: list, temperature: float, humidity: float) -> np.ndarray:
    """
    Given a history buffer (list of (temp, hum) tuples) and the current reading,
    compute the 11-feature vector that the model expects.
    """
    buf = deque(readings[-WINDOW:], maxlen=WINDOW)

    if buf:
        prev_temp, prev_hum = buf[-1]
        temp_roc = temperature - prev_temp
        hum_roc  = humidity   - prev_hum
    else:
        temp_roc = 0.0
        hum_roc  = 0.0

    buf.append((temperature, humidity))

    temps = [r[0] for r in buf]
    hums  = [r[1] for r in buf]

    temp_mean = float(np.mean(temps))
    temp_std  = float(np.std(temps))  if len(temps) > 1 else 0.0
    hum_mean  = float(np.mean(hums))
    hum_std   = float(np.std(hums))   if len(hums)  > 1 else 0.0

    return np.array([
        temperature,
        humidity,
        temp_mean,
        temp_std,
        hum_mean,
        hum_std,
        temp_roc,
        hum_roc,
        temperature - temp_mean,   # temp_deviation
        humidity    - hum_mean,    # humidity_deviation
        12.0,                      # hour_of_day (fixed for reproducibility)
    ], dtype=float)


def run_evaluation():
    print("=" * 74)
    print("ColdChainRx: Anomaly Model Evaluation — Real Sensor Schema")
    print("=" * 74)

    script_dir    = os.path.dirname(os.path.abspath(__file__))
    models_dir    = os.path.join(script_dir, "models")
    model_file    = os.path.join(models_dir, "isolation_forest_model.joblib")
    scaler_file   = os.path.join(models_dir, "scaler.joblib")
    metadata_file = os.path.join(models_dir, "model_metadata.json")

    if not os.path.exists(model_file) or not os.path.exists(scaler_file):
        raise FileNotFoundError("Trained model or scaler not found. Run train_anomaly_model.py first!")

    iso_forest = joblib.load(model_file)
    scaler     = joblib.load(scaler_file)

    with open(metadata_file, "r") as f:
        metadata = json.load(f)

    feature_cols = metadata["feature_names"]
    temp_mean = metadata["feature_stats"]["temperature"]["mean"]
    hum_mean  = metadata["feature_stats"]["humidity"]["mean"]
    print(f"--> Loaded model v{metadata['version']} | "
          f"Training samples: {metadata['total_training_samples']:,} | "
          f"Anomaly rate: {metadata['contamination']*100:.1f}%")
    print(f"--> Training data profile — Temp mean: {temp_mean:.1f}°C  |  Humidity mean: {hum_mean:.1f}%")
    print(f"--> Features: {feature_cols}")

    # Warm-up buffer: realistic stable cold-chain readings (~9-10°C, ~76% RH)
    normal_history = [(9.5 + i * 0.02, 76.0 + i * 0.05) for i in range(WINDOW)]

    test_cases = [
        {
            "scenario": "Stable cold-chain reading (9.5°C, 76% RH — Normal)",
            "temperature": 9.5,
            "humidity":    76.0,
            "history":     normal_history,
            "expect":      "NORMAL",
        },
        {
            "scenario": "Slight temp rise within range (12°C, 72% RH — Normal)",
            "temperature": 12.0,
            "humidity":    72.0,
            "history":     normal_history,
            "expect":      "NORMAL",
        },
        {
            "scenario": "Thermal excursion (35°C spike — Anomaly expected)",
            "temperature": 35.0,
            "humidity":    65.0,
            "history":     normal_history,
            "expect":      "ANOMALY",
        },
        {
            "scenario": "Humidity condensation surge (10°C, 99% RH — Anomaly expected)",
            "temperature": 10.2,
            "humidity":    99.5,
            "history":     normal_history,
            "expect":      "ANOMALY",
        },
        {
            "scenario": "Sensor freeze / dropout (0°C, 0% RH — Anomaly expected)",
            "temperature": 0.0,
            "humidity":    0.0,
            "history":     normal_history,
            "expect":      "ANOMALY",
        },
        {
            "scenario": "Sudden large temp jump +12°C in one step (Anomaly expected)",
            "temperature": 21.5,
            "humidity":    74.0,
            "history":     [(9.5, 76.0)] * WINDOW,
            "expect":      "ANOMALY",
        },
        {
            "scenario": "Gradual normal drift (8°C → 13°C over window — Normal)",
            "temperature": 13.0,
            "humidity":    74.0,
            "history":     [(8.0 + i * 0.45, 76.0 - i * 0.15) for i in range(WINDOW)],
            "expect":      "NORMAL",
        },
    ]

    print("\n" + "-" * 74)
    print(f"{'Scenario':<50} | {'Expect':<7} | {'ML':<7} | {'Score':<8}")
    print("-" * 74)

    correct = 0
    for case in test_cases:
        fv = compute_features(case["history"], case["temperature"], case["humidity"])
        X_scaled = scaler.transform(fv.reshape(1, -1))

        pred  = iso_forest.predict(X_scaled)[0]
        score = iso_forest.decision_function(X_scaled)[0]

        ml_label = "NORMAL" if pred == 1 else "ANOMALY"
        match    = "✓" if ml_label == case["expect"] else "✗"
        if ml_label == case["expect"]:
            correct += 1

        print(f"{case['scenario']:<50} | {case['expect']:<7} | {ml_label:<7} | {score:<.4f}  {match}")

    print("-" * 74)
    print(f"--> Correct: {correct}/{len(test_cases)} scenarios matched expected labels.")
    print("--> Evaluation complete.")
    print("=" * 74)


if __name__ == "__main__":
    run_evaluation()
