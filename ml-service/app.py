import os
import json
import joblib
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Resolve paths
script_dir = os.path.dirname(os.path.abspath(__file__))
models_dir = os.path.join(script_dir, "models")
model_file = os.path.join(models_dir, "isolation_forest_model.joblib")
scaler_file = os.path.join(models_dir, "scaler.joblib")
metadata_file = os.path.join(models_dir, "model_metadata.json")

# Load model artifacts
model = None
scaler = None
metadata = None

try:
    if os.path.exists(model_file) and os.path.exists(scaler_file) and os.path.exists(metadata_file):
        model = joblib.load(model_file)
        scaler = joblib.load(scaler_file)
        with open(metadata_file, "r") as f:
            metadata = json.load(f)
        print("--> Model artifacts loaded successfully.")
    else:
        print("--> WARNING: Model artifacts not found. Please run train_anomaly_model.py first.")
except Exception as e:
    print(f"--> ERROR loading model artifacts: {e}")

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
    if not model or not scaler or not metadata:
        return jsonify({"error": "Model not loaded"}), 503

    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400


        feature_names = metadata.get("feature_names", [])
        features = []
        for feature in feature_names:
            if feature not in data:
                return jsonify({"error": f"Missing required feature: {feature}"}), 400
            features.append(data[feature])


        X = np.array(features).reshape(1, -1)
        X_scaled = scaler.transform(X)


        prediction = model.predict(X_scaled)[0]
        anomaly_score = model.decision_function(X_scaled)[0]

        is_anomaly = bool(prediction == -1)

        response = {
            "is_anomaly": is_anomaly,
            "anomaly_score": float(anomaly_score),
            "prediction": int(prediction),
            "features_used": data
        }

        return jsonify(response)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Run on port 5000
    app.run(host="0.0.0.0", port=5000)
