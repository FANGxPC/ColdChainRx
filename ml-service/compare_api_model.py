import os
import json
import joblib
import pandas as pd
import requests

base = os.path.dirname(os.path.abspath(__file__))
models = os.path.join(base, "models")

model = joblib.load(os.path.join(models, "isolation_forest_model.joblib"))
scaler = joblib.load(os.path.join(models, "scaler.joblib"))

with open(os.path.join(models, "model_metadata.json")) as f:
    metadata = json.load(f)

features = metadata["feature_names"]

scenarios = [
    ("Ultra-low cryo vault",
     [-70.0, -70.0, 95.0, 840.0, 240.0, 0.0, 0.0]),
    ("Refrigerated transit",
     [4.5, 20.0, 90.0, 600.0, 0.0, 0.0, 12.0]),
    ("Severe temperature excursion",
     [14.5, 25.0, 92.0, 400.0, 0.0, 6.0, 5.0]),
    ("Extreme sensor reading",
     [55.0, 22.0, 65.0, 100.0, 0.0, 7.0, 0.0]),
]

print("\nAPI vs saved-model comparison")
print("=" * 65)

for name, values in scenarios:
    payload = dict(zip(features[:7], values))
    payload["temp_delta"] = abs(values[0] - values[1])
    payload = {f: payload[f] for f in features}

    X = pd.DataFrame([payload])[features]
    X_scaled = scaler.transform(X)

    direct_prediction = int(model.predict(X_scaled)[0])
    direct_score = float(model.decision_function(X_scaled)[0])

    try:
        response = requests.post(
            "http://127.0.0.1:5001/predict",
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        api_result = response.json()

        api_prediction = int(api_result["prediction"])
        same = direct_prediction == api_prediction

        print(f"\nScenario: {name}")
        print(f"API HTTP status: {response.status_code}")
        print(f"Direct model prediction: {direct_prediction}")
        print(f"API prediction: {api_prediction}")
        print(f"Direct model score: {direct_score:.6f}")
        print(f"API score: {api_result['anomaly_score']:.6f}")
        print(f"Predictions match: {same}")

    except Exception as e:
        print(f"\nScenario: {name}")
        print(f"Request failed: {e}")

print("\nComparison finished.")
