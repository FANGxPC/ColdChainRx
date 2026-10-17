import os
import json
import joblib
import numpy as np
from collections import deque
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Resolve paths
script_dir = os.path.dirname(os.path.abspath(__file__))
models_dir = os.path.join(script_dir, "models")
model_file    = os.path.join(models_dir, "isolation_forest_model.joblib")
scaler_file   = os.path.join(models_dir, "scaler.joblib")
metadata_file = os.path.join(models_dir, "model_metadata.json")

# Load model artifacts
model    = None
scaler   = None
metadata = None

try:
    if os.path.exists(model_file) and os.path.exists(scaler_file) and os.path.exists(metadata_file):
        model  = joblib.load(model_file)
        scaler = joblib.load(scaler_file)
        with open(metadata_file, "r") as f:
            metadata = json.load(f)
        print("--> Model artifacts loaded successfully.")
    else:
        print("--> WARNING: Model artifacts not found. Please run train_anomaly_model.py first.")
except Exception as e:
    print(f"--> ERROR loading model artifacts: {e}")

# Rolling window size must match training (default 12 = 60-second context at 5 s intervals)
WINDOW = int((metadata or {}).get("rolling_window_size", 12))

# In-memory per-sensor rolling buffers  { sensor_id -> deque([temp, humidity], ...) }
_sensor_buffers: dict = {}


def _get_buffer(sensor_id: str) -> deque:
    if sensor_id not in _sensor_buffers:
        _sensor_buffers[sensor_id] = deque(maxlen=WINDOW)
    return _sensor_buffers[sensor_id]


def _compute_features(temperature: float, humidity: float, sensor_id: str) -> np.ndarray:
    """
    Append the new reading to the sensor's rolling buffer and compute the
    11 engineered features expected by the trained model.

    Feature order must match FEATURE_COLS in train_anomaly_model.py:
      temperature, humidity,
      temp_rolling_mean, temp_rolling_std,
      humidity_rolling_mean, humidity_rolling_std,
      temp_rate_of_change, humidity_rate_of_change,
      temp_deviation, humidity_deviation,
      hour_of_day
    """
    buf = _get_buffer(sensor_id)

    # Rate of change = delta from last reading (before we push the new one)
    if buf:
        prev_temp, prev_hum = buf[-1]
        temp_roc = temperature - prev_temp
        hum_roc  = humidity   - prev_hum
    else:
        temp_roc = 0.0
        hum_roc  = 0.0

    buf.append((temperature, humidity))

    temps  = [r[0] for r in buf]
    hums   = [r[1] for r in buf]

    temp_mean = float(np.mean(temps))
    temp_std  = float(np.std(temps))   if len(temps) > 1 else 0.0
    hum_mean  = float(np.mean(hums))
    hum_std   = float(np.std(hums))    if len(hums)  > 1 else 0.0

    from datetime import datetime
    hour_of_day = datetime.now().hour

    features = np.array([
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
        float(hour_of_day),
    ], dtype=float)

    return features


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "model_loaded": model is not None})


@app.route("/model-info", methods=["GET"])
def model_info():
    if not metadata:
        return jsonify({"error": "Model metadata not available"}), 404
    return jsonify(metadata)


@app.route("/predict", methods=["POST"])
def predict():
    """
    Accepts a single sensor reading and returns an anomaly prediction.

    Request JSON:
        {
            "temperature": 22.5,      # °C  (required)
            "humidity": 67.3,         # %   (required)
            "sensor_id": "SENSOR01"   # string tag for the rolling buffer (optional, default "default")
        }

    Response JSON:
        {
            "is_anomaly": false,
            "anomaly_score": 0.123,
            "prediction": 1,          # 1 = normal, -1 = anomaly
            "sensor_id": "SENSOR01",
            "features_computed": { ... }
        }
    """
    if not model or not scaler or not metadata:
        return jsonify({"error": "Model not loaded"}), 503

    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400

        # Validate required inputs
        if "temperature" not in data:
            return jsonify({"error": "Missing required field: temperature"}), 400
        if "humidity" not in data:
            return jsonify({"error": "Missing required field: humidity"}), 400

        temperature = float(data["temperature"])
        humidity    = float(data["humidity"])
        sensor_id   = str(data.get("sensor_id", "default"))

        # Compute the 11 engineered features using the rolling buffer
        feature_vector = _compute_features(temperature, humidity, sensor_id)

        X        = feature_vector.reshape(1, -1)
        X_scaled = scaler.transform(X)

        prediction    = model.predict(X_scaled)[0]
        anomaly_score = model.decision_function(X_scaled)[0]
        is_anomaly    = bool(prediction == -1)

        feature_names = metadata.get("feature_names", [])
        features_computed = dict(zip(feature_names, feature_vector.tolist()))

        response = {
            "is_anomaly":        is_anomaly,
            "anomaly_score":     float(anomaly_score),
            "prediction":        int(prediction),
            "sensor_id":         sensor_id,
            "features_computed": features_computed,
        }
        return jsonify(response)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/reset-buffer", methods=["POST"])
def reset_buffer():
    """Clear the rolling window buffer for a specific sensor (or all sensors)."""
    data      = request.json or {}
    sensor_id = data.get("sensor_id")
    if sensor_id:
        _sensor_buffers.pop(sensor_id, None)
        return jsonify({"cleared": sensor_id})
    else:
        _sensor_buffers.clear()
        return jsonify({"cleared": "all"})


if __name__ == "__main__":
    # Run on port 5001
    app.run(host="0.0.0.0", port=5001)
