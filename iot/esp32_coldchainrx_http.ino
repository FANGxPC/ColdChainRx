/*
 * ColdChainRx - Direct HTTP POST Sketch for ESP32
 * ============================================================
 * Posts temperature & humidity telemetry directly to Swagata's
 * Fabric backend via Cloudflare Tunnel over HTTPS/HTTP.
 *
 * Requirements:
 *   - ESP32 Board package in Arduino IDE
 *   - DHT sensor library (Adafruit DHT)
 *   - ArduinoJson library
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "DHT.h"

// ------------------------------------------------------------
// 1. Wi-Fi Configuration (Fill in your Wi-Fi details)
// ------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ------------------------------------------------------------
// 2. Cloudflare / Backend Configuration
// ------------------------------------------------------------
// Update this URL whenever Swagata provides a new Cloudflare link
const char* BACKEND_URL = "https://youth-gregory-disc-might.trycloudflare.com/api/iot/temperature";
const char* BATCH_ID    = "BATCH_1792760493";
const char* REPORTER_ID = "Sensor_Omkar_01";

// ------------------------------------------------------------
// 3. Sensor Pin Configuration
// ------------------------------------------------------------
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// Interval between readings (10 seconds)
const unsigned long POST_INTERVAL_MS = 10000;
unsigned long lastPostTime = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- ColdChainRx ESP32 HTTP Client Starting ---");

  dht.begin();

  // Connect to Wi-Fi
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n[WiFi] Connected successfully!");
  Serial.print("[WiFi] IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  unsigned long now = millis();
  if (now - lastPostTime >= POST_INTERVAL_MS || lastPostTime == 0) {
    lastPostTime = now;

    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] Connection lost, reconnecting...");
      WiFi.reconnect();
      return;
    }

    // Read sensor data
    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();

    if (isnan(temp) || isnan(hum)) {
      Serial.println("[DHT] Warning: Failed to read from DHT22 sensor!");
      return;
    }

    Serial.printf("\n[Sensor] Temp: %.2f °C | Humidity: %.2f %%\n", temp, hum);

    // Build JSON payload
    StaticJsonDocument<256> doc;
    doc["batchId"]     = BATCH_ID;
    doc["sensor_id"]   = REPORTER_ID;
    doc["reporter"]    = REPORTER_ID;
    doc["temperature"] = temp;
    doc["humidity"]    = hum;
    doc["min_temp"]    = 2.0;
    doc["max_temp"]    = 8.0;
    doc["status"]      = (temp >= 2.0 && temp <= 8.0) ? "NORMAL" : "CRITICAL_EXCURSION";

    String requestBody;
    serializeJson(doc, requestBody);

    // Send HTTP POST
    HTTPClient http;
    http.begin(BACKEND_URL);
    http.addHeader("Content-Type", "application/json");

    Serial.print("[HTTP] POSTing to Fabric backend...");
    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.printf(" [HTTP %d]\n", httpResponseCode);
      Serial.println("[HTTP] Response: " + response);
    } else {
      Serial.printf(" [FAILED] Error code: %s\n", http.errorToString(httpResponseCode).c_str());
    }

    http.end();
  }
}
