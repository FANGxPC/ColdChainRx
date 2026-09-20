#!/usr/bin/env python3
"""
ColdChainRx — Offline Isolation Forest Anomaly Model Training
Member: Sadique (ML / Frontend Lead)
Roadmap Focus: Week 5 Deliverable

This script trains an unsupervised Isolation Forest model on historical vaccine cold-chain
telemetry log data (cleaned_vaccine_temperature_log.csv) to detect thermal excursions,
sensor malfunctions, and supply chain breaches.
"""

import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

def train_model():
    print("=" * 70)
    print("ColdChainRx: Offline Isolation Forest Model Training (Week 5)")
    print("=" * 70)

    # Resolve dataset path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, "..", "cleaned_vaccine_temperature_log.csv")
    models_dir = os.path.join(script_dir, "models")
    os.makedirs(models_dir, exist_ok=True)

    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at expected location: {dataset_path}")

    print(f"--> Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)
    print(f"--> Dataset loaded successfully. Total rows: {len(df):,}, Columns: {list(df.columns)}")

    # Feature Engineering
    # We select key numeric telemetry and operational features
    feature_cols = [
        "thermal_shipper_temp_reading",
        "room_temp_reading",
        "room_humidity_reading",
        "item_expiry_hours",
        "ultra_low_temperature_freezer_hours",
        "out_of_bound_temperature_hours",
        "refrigeration_temperature_hours"
    ]

    # Verify column existence
    for col in feature_cols:
        if col not in df.columns:
            raise KeyError(f"Required feature column '{col}' missing from dataset.")

    # Calculate derived feature: delta temperature between shipper internal temp and ambient room temp
    df["temp_delta"] = np.abs(df["thermal_shipper_temp_reading"] - df["room_temp_reading"])
    extended_feature_cols = feature_cols + ["temp_delta"]

    print(f"--> Features selected for model training ({len(extended_feature_cols)} features):")
    for f in extended_feature_cols:
        print(f"    - {f}")

    # Extract feature matrix X
    X = df[extended_feature_cols].copy()
    X = X.fillna(X.mean())

    # Fit StandardScaler
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Define hyper-parameters for Isolation Forest
    contamination_rate = 0.05  # Estimated 5% anomaly rate in cold chain logistics
    n_estimators = 150
    random_state = 42

    print(f"--> Training IsolationForest (n_estimators={n_estimators}, contamination={contamination_rate})...")
    iso_forest = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination_rate,
        random_state=random_state,
        n_jobs=-1
    )
    iso_forest.fit(X_scaled)

    # Predict anomaly labels (-1 for anomaly, 1 for normal)
    predictions = iso_forest.predict(X_scaled)
    anomaly_scores = iso_forest.decision_function(X_scaled)

    anomaly_count = np.sum(predictions == -1)
    normal_count = np.sum(predictions == 1)
    print(f"\n--> Training Output Summary:")
    print(f"    - Total Data Points Processed : {len(df):,}")
    print(f"    - Normal Telemetry Logs      : {normal_count:,} ({normal_count/len(df)*100:.2f}%)")
    print(f"    - Flagged Anomaly Logs       : {anomaly_count:,} ({anomaly_count/len(df)*100:.2f}%)")
    print(f"    - Anomaly Score Range        : Min={anomaly_scores.min():.4f}, Max={anomaly_scores.max():.4f}, Mean={anomaly_scores.mean():.4f}")

    # Save trained model and scaler
    model_file = os.path.join(models_dir, "isolation_forest_model.joblib")
    scaler_file = os.path.join(models_dir, "scaler.joblib")
    metadata_file = os.path.join(models_dir, "model_metadata.json")

    joblib.dump(iso_forest, model_file)
    joblib.dump(scaler, scaler_file)

    metadata = {
        "model_name": "ColdChainRx Isolation Forest Baseline Anomaly Detector",
        "version": "1.0.0",
        "author": "Sadique (ML/Frontend Lead)",
        "week": "Week 5 Deliverable",
        "feature_names": extended_feature_cols,
        "n_estimators": n_estimators,
        "contamination": contamination_rate,
        "total_training_samples": int(len(df)),
        "anomaly_samples_flagged": int(anomaly_count),
        "normal_samples_flagged": int(normal_count),
        "score_threshold_0": float(np.percentile(anomaly_scores, contamination_rate * 100)),
        "feature_stats": {
            col: {
                "mean": float(X[col].mean()),
                "std": float(X[col].std()),
                "min": float(X[col].min()),
                "max": float(X[col].max())
            } for col in extended_feature_cols
        }
    }

    with open(metadata_file, "w") as f:
        json.dump(metadata, f, indent=2)

    print("\n--> Serialized Model Artifacts Exported Successfully:")
    print(f"    [1] Model File   : {model_file}")
    print(f"    [2] Scaler File  : {scaler_file}")
    print(f"    [3] Metadata File: {metadata_file}")
    print("=" * 70)

if __name__ == "__main__":
    train_model()
