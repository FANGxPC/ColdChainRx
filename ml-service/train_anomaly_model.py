#!/usr/bin/env python3
"""
ColdChainRx — Isolation Forest Anomaly Model Training (Real Sensor Data)
Member: Sadique (ML / Frontend Lead)

Rewritten to support real IoT sensor data from SENSOR01-09.CSV files.
Each file contains: Date; Time; Temperature (C); Humidity (%)
— one temperature sensor and one humidity sensor per device.
"""

import os
import glob
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

WINDOW        = 12    # 12 readings × 5 s interval = 60-second rolling context
CONTAMINATION = 0.05  # Expected ~5% anomaly rate in cold-chain logistics
N_ESTIMATORS  = 150
RANDOM_STATE  = 42

FEATURE_COLS = [
    "temperature",
    "humidity",
    "temp_rolling_mean",
    "temp_rolling_std",
    "humidity_rolling_mean",
    "humidity_rolling_std",
    "temp_rate_of_change",
    "humidity_rate_of_change",
    "temp_deviation",
    "humidity_deviation",
    "hour_of_day",
]


def load_sensor_data(data_dir: str) -> pd.DataFrame:
    """Load and combine all SENSOR*.CSV files from data_dir."""
    pattern = os.path.join(data_dir, "SENSOR*.CSV")
    files = sorted(glob.glob(pattern))
    if not files:
        raise FileNotFoundError(f"No SENSOR*.CSV files found in: {data_dir}")

    dfs = []
    for fpath in files:
        sensor_id = os.path.splitext(os.path.basename(fpath))[0]  # e.g. "SENSOR07"
        tmp = pd.read_csv(fpath, sep=";", decimal=".", low_memory=False)
        tmp.columns = [c.strip() for c in tmp.columns]
        tmp = tmp.rename(columns={
            "Temperature (C)": "temperature",
            "Humidity (%)":    "humidity",
        })
        # Coerce to numeric — non-numeric rows (repeated headers, bad rows) become NaN
        tmp["temperature"] = pd.to_numeric(tmp["temperature"], errors="coerce")
        tmp["humidity"]    = pd.to_numeric(tmp["humidity"],    errors="coerce")
        tmp["sensor_id"] = sensor_id
        tmp["datetime"] = pd.to_datetime(
            tmp["Date"].str.strip() + " " + tmp["Time"].str.strip(),
            format="%d.%m.%Y %H:%M:%S",
            errors="coerce",
        )
        tmp = tmp.dropna(subset=["datetime", "temperature", "humidity"])
        dfs.append(tmp)

    df = pd.concat(dfs, ignore_index=True)
    df = df.sort_values(["sensor_id", "datetime"]).reset_index(drop=True)
    print(f"--> Loaded {len(files)} sensor file(s) — {len(df):,} total rows")
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Engineer anomaly-detection features from raw temperature + humidity.
    All rolling operations are grouped per sensor so context does not bleed
    across different physical devices.
    """
    grp = df.groupby("sensor_id", sort=False)

    # Rolling statistics (60-second window per sensor)
    df["temp_rolling_mean"]     = grp["temperature"].transform(
        lambda s: s.rolling(WINDOW, min_periods=1).mean())
    df["temp_rolling_std"]      = grp["temperature"].transform(
        lambda s: s.rolling(WINDOW, min_periods=1).std().fillna(0))
    df["humidity_rolling_mean"] = grp["humidity"].transform(
        lambda s: s.rolling(WINDOW, min_periods=1).mean())
    df["humidity_rolling_std"]  = grp["humidity"].transform(
        lambda s: s.rolling(WINDOW, min_periods=1).std().fillna(0))

    # Rate of change (consecutive-reading delta, per sensor)
    df["temp_rate_of_change"]     = grp["temperature"].transform(
        lambda s: s.diff().fillna(0))
    df["humidity_rate_of_change"] = grp["humidity"].transform(
        lambda s: s.diff().fillna(0))

    # Deviation from rolling mean (captures sudden spikes)
    df["temp_deviation"]     = df["temperature"] - df["temp_rolling_mean"]
    df["humidity_deviation"] = df["humidity"]    - df["humidity_rolling_mean"]

    # Time-of-day context (captures diurnal temperature patterns)
    df["hour_of_day"] = df["datetime"].dt.hour

    return df


def train_model():
    print("=" * 70)
    print("ColdChainRx: Isolation Forest Training — Real Sensor Data")
    print("=" * 70)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir   = os.path.join(script_dir, "..", "new-data")
    models_dir = os.path.join(script_dir, "models")
    os.makedirs(models_dir, exist_ok=True)

    # ── Load & combine sensor files ───────────────────────────────────────
    df = load_sensor_data(data_dir)

    # ── Feature engineering ───────────────────────────────────────────────
    print("--> Engineering features ...")
    df = engineer_features(df)

    print(f"--> Features ({len(FEATURE_COLS)}): {FEATURE_COLS}")

    X = df[FEATURE_COLS].copy().fillna(0)

    # ── Scale ─────────────────────────────────────────────────────────────
    scaler   = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # ── Train ─────────────────────────────────────────────────────────────
    print(f"--> Training IsolationForest "
          f"(n_estimators={N_ESTIMATORS}, contamination={CONTAMINATION}) ...")
    iso_forest = IsolationForest(
        n_estimators=N_ESTIMATORS,
        contamination=CONTAMINATION,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    iso_forest.fit(X_scaled)

    predictions    = iso_forest.predict(X_scaled)
    anomaly_scores = iso_forest.decision_function(X_scaled)

    anomaly_count = int(np.sum(predictions == -1))
    normal_count  = int(np.sum(predictions == 1))

    print(f"\n--> Training Output Summary:")
    print(f"    Total Readings Processed : {len(df):,}")
    print(f"    Normal Readings          : {normal_count:,} ({normal_count/len(df)*100:.2f}%)")
    print(f"    Flagged Anomalies        : {anomaly_count:,} ({anomaly_count/len(df)*100:.2f}%)")
    print(f"    Anomaly Score Range      : "
          f"Min={anomaly_scores.min():.4f}, "
          f"Max={anomaly_scores.max():.4f}, "
          f"Mean={anomaly_scores.mean():.4f}")

    # ── Persist model artifacts ───────────────────────────────────────────
    model_file    = os.path.join(models_dir, "isolation_forest_model.joblib")
    scaler_file   = os.path.join(models_dir, "scaler.joblib")
    metadata_file = os.path.join(models_dir, "model_metadata.json")

    joblib.dump(iso_forest, model_file)
    joblib.dump(scaler, scaler_file)

    # Per-sensor statistics for metadata
    sensor_stats = {}
    for sid, grp_df in df.groupby("sensor_id"):
        sensor_stats[sid] = {
            "rows":      int(len(grp_df)),
            "temp_mean": float(grp_df["temperature"].mean()),
            "temp_std":  float(grp_df["temperature"].std()),
            "temp_min":  float(grp_df["temperature"].min()),
            "temp_max":  float(grp_df["temperature"].max()),
            "hum_mean":  float(grp_df["humidity"].mean()),
            "hum_std":   float(grp_df["humidity"].std()),
            "hum_min":   float(grp_df["humidity"].min()),
            "hum_max":   float(grp_df["humidity"].max()),
        }

    metadata = {
        "model_name":    "ColdChainRx Isolation Forest — Real Sensor Edition",
        "version":       "2.0.0",
        "author":        "Sadique (ML/Frontend Lead)",
        "sensor_inputs": {
            "temperature": "Temperature in °C (single sensor per device)",
            "humidity":    "Relative humidity in % (single sensor per device)",
        },
        "feature_names":           FEATURE_COLS,
        "rolling_window_size":     WINDOW,
        "n_estimators":            N_ESTIMATORS,
        "contamination":           CONTAMINATION,
        "total_training_samples":  int(len(df)),
        "anomaly_samples_flagged": anomaly_count,
        "normal_samples_flagged":  normal_count,
        "score_threshold_0":       float(np.percentile(anomaly_scores, CONTAMINATION * 100)),
        "feature_stats": {
            col: {
                "mean": float(X[col].mean()),
                "std":  float(X[col].std()),
                "min":  float(X[col].min()),
                "max":  float(X[col].max()),
            } for col in FEATURE_COLS
        },
        "per_sensor_stats": sensor_stats,
    }

    with open(metadata_file, "w") as f:
        json.dump(metadata, f, indent=2)

    print("\n--> Serialized Model Artifacts:")
    print(f"    [1] Model   : {model_file}")
    print(f"    [2] Scaler  : {scaler_file}")
    print(f"    [3] Metadata: {metadata_file}")
    print("=" * 70)


if __name__ == "__main__":
    train_model()
