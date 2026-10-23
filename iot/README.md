# ColdChainRx - IoT Telemetry & ESP32 Integration Guide

This directory contains the ready-to-flash ESP32 firmware for the **ColdChainRx** pharmaceutical cold chain monitoring system.

---

## ⚡ Active Live Status (Swagata's Machine)

- **Backend Gateway**: Running on port `5000` (`http://localhost:5000`)
- **Cloudflare Public Tunnel**: **ACTIVE & LIVE**
  - **Public Base URL**: `https://youth-gregory-disc-might.trycloudflare.com`
  - **Health Check**: `https://youth-gregory-disc-might.trycloudflare.com/health`
  - **IoT Ingestion Endpoint**: `https://youth-gregory-disc-might.trycloudflare.com/api/iot/temperature`

> ✅ Any device on earth (ESP32 on 4G hotspot, teammate at another home, phone browser) can now send requests to Swagata's Hyperledger Fabric ledger!

---

## 🚀 Option Comparison

| Feature | Option 1: Cloudflare Tunnel (Active Now) | Option 2: HiveMQ Cloud MQTT | Option 3: Tailscale Mesh VPN |
|---|---|---|---|
| **Setup Effort** | **0 min (Already Running!)** | ~10 mins (Create HiveMQ account) | ~5 mins (Install Tailscale) |
| **New Accounts Needed** | **None** | 1 (HiveMQ Cloud free tier) | 1 (Tailscale account) |
| **ESP32 Code** | [`esp32_coldchainrx_http.ino`](./esp32_coldchainrx_http.ino) | [`esp32_coldchainrx_mqtt.ino`](./esp32_coldchainrx_mqtt.ino) | Same as local HTTP |
| **Firewall / NAT Bypass** | Yes, 100% bypass | Yes, standard outbound port 8883 | Yes, mesh overlay network |
| **Ideal For** | **Live demos, instant testing across locations** | Enterprise pub/sub IoT fleet | Local dev without public links |

---

## 🛠️ Option 1: Step-by-Step for Omkar (ESP32)

### 1. Hardware Pinout
- **VCC** (DHT11/DHT22) ➡️ **3V3** or **VIN** (ESP32)
- **GND** (DHT11/DHT22) ➡️ **GND** (ESP32)
- **DATA** (DHT11/DHT22) ➡️ **GPIO 4** (ESP32)
- **Status LED** ➡️ **GPIO 2** (Built-in blue LED on ESP32)

### Path A: Flash the HTTP Sketch (Recommended - 2 Mins)
1. Open [`esp32_coldchainrx_http.ino`](./esp32_coldchainrx_http.ino).
2. Install the **DHT sensor library** (by Adafruit) from *Tools ➡️ Manage Libraries*.
3. Change only your Wi-Fi credentials in lines 21–22:
   ```cpp
   const char* WIFI_SSID     = "Your_WiFi_Or_Hotspot_Name";
   const char* WIFI_PASSWORD = "Your_WiFi_Password";
   ```
4. Click **Upload** and open **Serial Monitor** at **115200 baud**. Done!

### Path B: Keep Existing MQTT on ESP32 & Run Edge Forwarder
If Omkar already has his ESP32 programmed with MQTT and cannot or does not want to re-flash:
1. Run Omkar's local MQTT broker (e.g. Mosquitto on port 1883).
2. Run the provided Python bridge script on his computer:
   ```bash
   pip install paho-mqtt requests
   python iot/mqtt_bridge.py
   ```
3. The bridge script automatically catches every MQTT packet from the ESP32 and forwards it over HTTPS to Swagata's Cloudflare tunnel!

---

## 🧪 Testing From Anywhere (cURL / Terminal)

To test the live tunnel from any computer or terminal without waiting for the ESP32:

### Test 1: Verify Gateway Health
```bash
curl -i https://youth-gregory-disc-might.trycloudflare.com/health
```

### Test 2: Simulate ESP32 Temperature Reading (Normal - 4.5°C)
```bash
curl -X POST https://youth-gregory-disc-might.trycloudflare.com/api/iot/temperature \
  -H "Content-Type: application/json" \
  -d '{"batchId":"BATCH_1792760493","temperature":4.5,"humidity":55.0,"reporter":"ESP32_Test_Unit"}'
```

### Test 3: Simulate Excursion Alarm (Spike - 12.0°C)
```bash
curl -X POST https://youth-gregory-disc-might.trycloudflare.com/api/iot/temperature \
  -H "Content-Type: application/json" \
  -d '{"batchId":"BATCH_1792760493","temperature":12.0,"humidity":62.5,"reporter":"ESP32_Test_Unit"}'
```

---

## 💻 Web App (Fang) Configuration

Fang can connect the frontend dashboard from anywhere by setting in their `.env`:
```env
NEXT_PUBLIC_API_URL=https://youth-gregory-disc-might.trycloudflare.com
```
