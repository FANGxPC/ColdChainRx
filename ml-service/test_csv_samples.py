import os
import pandas as pd
import requests

csv_path = os.path.join(
    os.path.dirname(__file__),
    "..",
    "cleaned_vaccine_temperature_log.csv"
)

df = pd.read_csv(csv_path)

features = [
    "thermal_shipper_temp_reading",
    "room_temp_reading",
    "room_humidity_reading",
    "item_expiry_hours",
    "ultra_low_temperature_freezer_hours",
    "out_of_bound_temperature_hours",
    "refrigeration_temperature_hours",
]

df["temp_delta"] = (
    df["thermal_shipper_temp_reading"]
    - df["room_temp_reading"]
).abs()

features.append("temp_delta")
data = df[features].copy()
data = data.fillna(data.mean())

samples = data.sample(n=min(3, len(data)), random_state=42)

for number, (_, row) in enumerate(samples.iterrows(), start=1):
    payload = {name: float(row[name]) for name in features}

    print(f"\n--- Dataset Sample {number} ---")
    print("Input:", payload)

    try:
        response = requests.post(
            "http://127.0.0.1:5001/predict",
            json=payload,
            timeout=10
        )
        print("HTTP Status:", response.status_code)
        print("Prediction:", response.json())
    except Exception as error:
        print("Request failed:", error)
