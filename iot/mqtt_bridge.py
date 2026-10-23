"""
ColdChainRx - Edge Gateway Forwarder (MQTT to Cloudflare HTTPS Bridge)

Use this script if Omkar's ESP32 is already publishing MQTT to a local broker,
and you want to forward those packets directly to Swagata's Cloudflare tunnel
without modifying the ESP32 firmware!

Requirements:
    pip install paho-mqtt requests
Run:
    python mqtt_bridge.py
"""

import json
import requests
import paho.mqtt.client as mqtt

# ================= CONFIGURATION =================
# Swagata's Active Cloudflare Tunnel URL:
CLOUDFLARE_URL = "https://youth-gregory-disc-might.trycloudflare.com/api/iot/temperature"

# Omkar's Local MQTT Broker:
LOCAL_MQTT_BROKER = "localhost"
LOCAL_MQTT_PORT = 1883

# Default Batch ID on the Hyperledger Fabric ledger:
DEFAULT_BATCH_ID = "BATCH_1792760493"
DEFAULT_REPORTER = "Sensor_Omkar_01"

# Topics to listen for from the ESP32:
TOPICS = [
    "coldchain/telemetry",
    "coldchain/sensors/temperature",
    "sensor/temperature"
]
# =================================================

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[Gateway] Connected successfully to local MQTT broker.")
        for topic in TOPICS:
            client.subscribe(topic)
            print(f"[Gateway] Subscribed to topic: {topic}")
    else:
        print(f"[Gateway] Failed to connect to MQTT broker, return code {rc}")

def on_message(client, userdata, msg):
    try:
        raw_text = msg.payload.decode("utf-8")
        print(f"\n[MQTT Inbound] Topic: {msg.topic}")
        print(f"               Payload: {raw_text}")

        # Parse JSON payload
        data = json.loads(raw_text)

        # Normalize field names to match ColdChainRx backend schema
        payload = {
            "batchId": data.get("batchId") or data.get("batch_id") or DEFAULT_BATCH_ID,
            "temperature": float(data.get("temperature") or data.get("temp") or 0.0),
            "humidity": float(data.get("humidity") or data.get("hum") or 50.0),
            "reporter": data.get("reporter") or DEFAULT_REPORTER
        }

        print(f"[Forwarding -> Cloudflare Tunnel] Sending to Swagata's Fabric ledger...")
        response = requests.post(CLOUDFLARE_URL, json=payload, timeout=8)
        
        if response.status_code == 200:
            print(f"✅ [Ledger Success] HTTP 200: {response.json().get('message')}")
        else:
            print(f"⚠️ [Ledger Warning] HTTP {response.status_code}: {response.text}")

    except json.JSONDecodeError:
        print(f"❌ [Error] Inbound MQTT message was not valid JSON: {msg.payload}")
    except Exception as e:
        print(f"❌ [Error] Failed forwarding to Cloudflare: {e}")

if __name__ == "__main__":
    print("==================================================")
    print(" ColdChainRx - Edge MQTT -> Cloudflare REST Bridge")
    print(f" Target URL: {CLOUDFLARE_URL}")
    print("==================================================")
    
    client = mqtt.Client(client_id="ColdChainRx_Omkar_Bridge")
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(LOCAL_MQTT_BROKER, LOCAL_MQTT_PORT, 60)
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n[Gateway] Shutting down bridge.")
    except Exception as e:
        print(f"[Gateway Error] Could not connect to local broker at {LOCAL_MQTT_BROKER}:{LOCAL_MQTT_PORT}: {e}")
