"""
ColdChainRx - Edge MQTT Forwarder Bridge (iot/mqtt_bridge.py)
============================================================
Forwards raw local MQTT sensor readings directly to Swagata's
Fabric backend over the remote Cloudflare Tunnel.

Flow:
  [ESP32] --(MQTT)--> [Laptop Broker :1883] --(mqtt_bridge.py)--> [Cloudflare Tunnel] --> [Fabric Ledger]

Reads FABRIC_BACKEND_URL from the shared root .env file.
"""

import json
import os
import sys
import paho.mqtt.client as mqtt
import requests

# ------------------------------------------------------------------ #
# Load shared .env from project root                                 #
# ------------------------------------------------------------------ #
try:
    from dotenv import load_dotenv
    root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    load_dotenv(root_env, override=True)
except ImportError:
    pass

FABRIC_BASE = os.getenv(
    "FABRIC_BACKEND_URL",
    "http://10.194.253.204:5000"
).rstrip("/")

BACKEND_URL     = f"{FABRIC_BASE}/api/iot/temperature"
ACTIVE_BATCH_ID = "BATCH_1792760493"
DEFAULT_REPORTER = "Sensor_Omkar_01"

MQTT_BROKER = os.getenv("MQTT_BROKER", "127.0.0.1")
MQTT_PORT   = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC  = "medical/sensor/data"

print("=" * 60)
print("ColdChainRx - IoT MQTT -> Cloudflare Fabric Bridge")
print(f"Broker:     {MQTT_BROKER}:{MQTT_PORT}")
print(f"Topic:      {MQTT_TOPIC}")
print(f"Target:     {BACKEND_URL}")
print(f"Batch ID:   {ACTIVE_BATCH_ID}")
print("=" * 60)


def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print(f"\n[BRIDGE] Connected to MQTT broker ({MQTT_BROKER}:{MQTT_PORT})")
        client.subscribe(MQTT_TOPIC)
        print(f"[BRIDGE] Subscribed to topic: '{MQTT_TOPIC}'")
        print("[BRIDGE] Waiting for ESP32 sensor telemetry...\n")
    else:
        print(f"[BRIDGE] Connection failed with code {rc}")


def on_message(client, userdata, msg):
    try:
        raw_payload = msg.payload.decode("utf-8")
        data = json.loads(raw_payload)
        temp = data.get("temperature", "?")
        hum  = data.get("humidity", "?")
        print(f"[BRIDGE] Received MQTT reading: {temp}°C | {hum}% RH")

        # Ensure active batchId is present
        if not data.get("batchId"):
            data["batchId"] = ACTIVE_BATCH_ID
        if not data.get("reporter"):
            data["reporter"] = data.get("sensor_id", DEFAULT_REPORTER)

        # Forward to Fabric backend via Cloudflare tunnel
        resp = requests.post(BACKEND_URL, json=data, timeout=10)
        if resp.status_code in (200, 201):
            print(f"         --> Forwarded to Fabric [HTTP {resp.status_code} OK]")
        else:
            print(f"         --> Forwarding warning [HTTP {resp.status_code}]: {resp.text[:120]}")

    except json.JSONDecodeError:
        print(f"[BRIDGE] Invalid JSON in MQTT message: {msg.payload[:100]}")
    except requests.exceptions.RequestException as exc:
        print(f"[BRIDGE] Failed to reach Fabric backend: {exc}")
    except Exception as exc:
        print(f"[BRIDGE] Unexpected error: {exc}")


def main():
    client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n[BRIDGE] Stopped by user.")
    except Exception as exc:
        print(f"\n[BRIDGE] Fatal error: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
