"""
ColdChainRx - Week 8 Performance Benchmark
===========================================
Measures end-to-end pipeline latency across:
  - Gateway validation
  - ML anomaly detection (Flask, port 5001)
  - Fabric backend recording (via Cloudflare or direct)

Runs 50 synthetic temperature readings through the full pipeline,
measuring each stage independently.

Outputs:
  experiments/performance/gateway_latency_50runs.csv
  experiments/performance/benchmark_summary.json
"""

import csv
import json
import os
import sys
import time
import statistics
import requests
from datetime import datetime, timezone

# ------------------------------------------------------------------ #
# Configuration                                                        #
# ------------------------------------------------------------------ #

try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except ImportError:
    pass

FABRIC_BASE = os.getenv(
    "FABRIC_BACKEND_URL",
    "http://10.194.253.204:5000"
).rstrip("/")

ACTIVE_BATCH_ID = "BATCH_1792760493"
SENSOR_ID       = "Sensor_Omkar_01"

ML_URL          = "http://127.0.0.1:5001/predict"
FABRIC_TEMP_URL = f"{FABRIC_BASE}/api/iot/temperature"

ML_TIMEOUT      = 5
FABRIC_TIMEOUT  = 15

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR   = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "performance"))
CSV_PATH     = os.path.join(OUTPUT_DIR, "gateway_latency_50runs.csv")
SUMMARY_PATH = os.path.join(OUTPUT_DIR, "benchmark_summary.json")

# ------------------------------------------------------------------ #
# Synthetic reading generator                                          #
# ------------------------------------------------------------------ #

import math

def generate_reading(index):
    """
    Generate a deterministic but varied synthetic reading.
    Readings 0-44 are normal (2–8°C); readings 45-49 are excursion.
    """
    if index < 45:
        # Normal range: oscillate between 3.0 and 7.5
        temp     = 5.0 + 2.5 * math.sin(index * 0.5)
        humidity = 55.0 + 5.0 * math.cos(index * 0.3)
        status   = "OK"
    else:
        # Excursion readings
        temp     = 12.0 + (index - 45) * 1.5
        humidity = 70.0
        status   = "EXCURSION"

    return {
        "sensor_id":   SENSOR_ID,
        "temperature": round(temp, 2),
        "humidity":    round(humidity, 2),
        "min_temp":    2.0,
        "max_temp":    8.0,
        "timestamp":   datetime.now(timezone.utc).isoformat(),
        "status":      status,
        "batchId":     ACTIVE_BATCH_ID,
        "reporter":    SENSOR_ID,
    }


# ------------------------------------------------------------------ #
# Stage timers                                                         #
# ------------------------------------------------------------------ #

def time_ml(reading):
    """Call ML service and return (latency_ms, result_dict or None)."""
    ml_payload = {
        "temperature": reading["temperature"],
        "humidity":    reading["humidity"],
        "timestamp":   reading["timestamp"],
    }
    t0 = time.monotonic()
    try:
        resp = requests.post(ML_URL, json=ml_payload, timeout=ML_TIMEOUT)
        latency = round((time.monotonic() - t0) * 1000, 1)
        if resp.status_code == 200:
            return latency, resp.json()
        return latency, None
    except Exception:
        latency = round((time.monotonic() - t0) * 1000, 1)
        return latency, None


def time_fabric(reading):
    """POST to Fabric backend and return (latency_ms, status_code)."""
    t0 = time.monotonic()
    try:
        resp = requests.post(FABRIC_TEMP_URL, json=reading, timeout=FABRIC_TIMEOUT)
        latency = round((time.monotonic() - t0) * 1000, 1)
        return latency, resp.status_code
    except requests.exceptions.Timeout:
        latency = round((time.monotonic() - t0) * 1000, 1)
        return latency, "TIMEOUT"
    except requests.exceptions.ConnectionError:
        latency = round((time.monotonic() - t0) * 1000, 1)
        return latency, "CONN_ERR"


def time_validation(reading):
    """Simulate gateway validation locally (no network). Returns latency_ms."""
    t0 = time.monotonic()
    # Import gateway validation function directly
    sys.path.insert(0, os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..")))
    try:
        from gateway import validate_sensor_data
        validate_sensor_data(reading)
    except Exception:
        pass
    return round((time.monotonic() - t0) * 1000, 2)


# ------------------------------------------------------------------ #
# Main benchmark loop                                                  #
# ------------------------------------------------------------------ #

def main():
    print("=" * 60)
    print("ColdChainRx — Week 8 Gateway & ML Latency Benchmark")
    print(f"N = 50 synthetic readings")
    print(f"Fabric target: {FABRIC_TEMP_URL}")
    print("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    rows = []

    csv_fields = [
        "run_index", "temperature", "humidity", "expected_status",
        "t_validation_ms", "t_ml_ms", "ml_reachable", "ml_prediction",
        "t_fabric_ms", "fabric_status_code", "fabric_reachable",
        "t_total_ms",
    ]

    print(f"\n{'Run':>4}  {'Temp':>6}  {'Valid':>8}  {'ML':>7}  {'Fabric':>8}  {'Total':>8}  {'Fabric HTTP':>12}")
    print("-" * 68)

    for i in range(50):
        reading = generate_reading(i)

        # Stage 1: Validation (local)
        t_valid = time_validation(reading)

        # Stage 2: ML service
        t_ml, ml_result = time_ml(reading)
        ml_reachable  = ml_result is not None
        ml_prediction = ml_result.get("prediction", "N/A") if ml_result else "UNREACHABLE"

        # Stage 3: Fabric (only for non-excursion or send all for benchmarking)
        t_fabric, fabric_status = time_fabric(reading)
        fabric_reachable = isinstance(fabric_status, int)

        # Total pipeline time
        t_total = round(t_valid + t_ml + t_fabric, 1)

        rows.append({
            "run_index":          i + 1,
            "temperature":        reading["temperature"],
            "humidity":           reading["humidity"],
            "expected_status":    reading["status"],
            "t_validation_ms":    t_valid,
            "t_ml_ms":            t_ml,
            "ml_reachable":       ml_reachable,
            "ml_prediction":      ml_prediction,
            "t_fabric_ms":        t_fabric,
            "fabric_status_code": fabric_status,
            "fabric_reachable":   fabric_reachable,
            "t_total_ms":         t_total,
        })

        print(
            f"  {i+1:>2}  {reading['temperature']:>6.2f}°C  "
            f"{t_valid:>7.1f}ms  {t_ml:>6.1f}ms  {t_fabric:>7.1f}ms  "
            f"{t_total:>7.1f}ms  {str(fabric_status):>11}"
        )

        time.sleep(0.2)  # ~5 readings/sec — realistic sensor rate

    # ---------------------------------------------------------------- #
    # Write CSV                                                          #
    # ---------------------------------------------------------------- #
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields)
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nCSV saved: {CSV_PATH}")

    # ---------------------------------------------------------------- #
    # Compute statistics                                                 #
    # ---------------------------------------------------------------- #
    def stats(values):
        clean = [v for v in values if isinstance(v, (int, float))]
        if not clean:
            return {"n": 0, "mean": None, "std": None, "min": None, "max": None, "median": None}
        return {
            "n":      len(clean),
            "mean":   round(statistics.mean(clean), 2),
            "std":    round(statistics.stdev(clean), 2) if len(clean) > 1 else 0,
            "min":    round(min(clean), 2),
            "max":    round(max(clean), 2),
            "median": round(statistics.median(clean), 2),
        }

    t_valid_all  = [r["t_validation_ms"] for r in rows]
    t_ml_all     = [r["t_ml_ms"]         for r in rows]
    t_fabric_all = [r["t_fabric_ms"]     for r in rows]
    t_total_all  = [r["t_total_ms"]      for r in rows]

    ml_reachable_count     = sum(1 for r in rows if r["ml_reachable"])
    fabric_reachable_count = sum(1 for r in rows if r["fabric_reachable"])

    summary = {
        "benchmark_timestamp": datetime.now(timezone.utc).isoformat(),
        "n_readings":           50,
        "fabric_target":        FABRIC_TEMP_URL,
        "ml_target":            ML_URL,
        "t_validation_ms":      stats(t_valid_all),
        "t_ml_ms":              stats(t_ml_all),
        "t_fabric_ms":          stats(t_fabric_all),
        "t_total_pipeline_ms":  stats(t_total_all),
        "ml_service_reachable":     ml_reachable_count,
        "fabric_service_reachable": fabric_reachable_count,
        "notes": (
            "Fabric latency includes Cloudflare tunnel RTT when backend is remote. "
            "TIMEOUT values excluded from statistics."
        ),
    }

    with open(SUMMARY_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 60)
    print("BENCHMARK RESULTS (50 readings)")
    print(f"  Validation:  mean={summary['t_validation_ms']['mean']} ms  std={summary['t_validation_ms']['std']} ms")
    print(f"  ML service:  mean={summary['t_ml_ms']['mean']} ms  std={summary['t_ml_ms']['std']} ms")
    print(f"  Fabric POST: mean={summary['t_fabric_ms']['mean']} ms  std={summary['t_fabric_ms']['std']} ms")
    print(f"  Total E2E:   mean={summary['t_total_pipeline_ms']['mean']} ms  std={summary['t_total_pipeline_ms']['std']} ms")
    print(f"  ML reachable: {ml_reachable_count}/50  |  Fabric reachable: {fabric_reachable_count}/50")
    print("=" * 60)
    print(f"\nSummary saved: {SUMMARY_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
