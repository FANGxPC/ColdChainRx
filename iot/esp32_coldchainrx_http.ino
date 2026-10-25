/*
 * ColdChainRx - Direct HTTP POST Sketch for ESP32
 * ============================================================
 * Dynamic Device Binding Support (No BATCH_ID required in firmware!)
 *
 * Posts temperature & humidity telemetry directly to Swagata's
 * Hyperledger Fabric backend via Cloudflare Tunnel over HTTPS.
 *
 * ZERO extra libraries required! (Uses built-in WiFi.h and HTTPClient.h)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"
#include <time.h>

// ------------------------------------------------------------
// 1. Wi-Fi Configuration
// ------------------------------------------------------------
const char* WIFI_SSID     = "iQOO Neo9 Pro";
const char* WIFI_PASSWORD = "priyanshu";

// ------------------------------------------------------------
// 2. Swagata's Live Cloudflare Backend & Sensor Device Identifier
// ------------------------------------------------------------
const char* BACKEND_URL = "https://inspection-contracting-done-ala.trycloudflare.com/api/iot/temperature";
const char* SENSOR_ID   = "Sensor_Omkar_01"; // Dynamically resolved on blockchain!

// Safe medical temperature limits (2°C - 8°C)
const float MIN_TEMP = 2.0;
const float MAX_TEMP = 8.0;

// ------------------------------------------------------------
// 3. Sensor & Simulation Settings
// ------------------------------------------------------------
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

bool simulationMode = true;

float simulatedTemperatures[] = {
  5.5,
  7.8,
  8.5,
  1.5,
  NAN,
  -999,
  150.0
};
int simulationIndex = 0;
const float SIMULATED_HUMIDITY = 60.0;

// ------------------------------------------------------------
// 4. Timing
// ------------------------------------------------------------
const unsigned long POST_INTERVAL_MS = 10000;
unsigned long lastPostTime = 0;

void reconnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println("\n[WiFi] Reconnecting...");
  WiFi.disconnect();
  delay(500);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
}

void setupTime() {
  configTime(19800, 0, "pool.ntp.org", "time.nist.gov");
  struct tm timeinfo;
  int attempts = 0;
  while (!getLocalTime(&timeinfo) && attempts < 10) {
    delay(500);
    attempts++;
  }
}

String getTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "TIME_UNAVAILABLE";
  char timestamp[25];
  strftime(timestamp, sizeof(timestamp), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(timestamp);
}

// Payload without BATCH_ID — resolved by Fabric chaincode dynamically
String createPayload(float temperature, float humidity) {
  String timestamp = getTimestamp();
  String payload = "{";
  payload += "\"sensor_id\":\"" + String(SENSOR_ID) + "\",";
  payload += "\"temperature\":";
  payload += isnan(temperature) ? "null" : String(temperature, 2);
  payload += ",";
  payload += "\"humidity\":";
  payload += isnan(humidity) ? "null" : String(humidity, 2);
  payload += ",";
  payload += "\"timestamp\":\"" + timestamp + "\"";
  payload += "}";
  return payload;
}

void sendTelemetry() {
  float temperature;
  float humidity;

  if (!simulationMode) {
    temperature = dht.readTemperature();
    humidity    = dht.readHumidity();
  } else {
    temperature = simulatedTemperatures[simulationIndex];
    humidity    = SIMULATED_HUMIDITY;
    simulationIndex++;
    if (simulationIndex >= sizeof(simulatedTemperatures) / sizeof(simulatedTemperatures[0])) {
      simulationIndex = 0;
    }
  }

  String payload = createPayload(temperature, humidity);
  Serial.println("\n--- Telemetry Payload ---");
  Serial.println(payload);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(BACKEND_URL);
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.POST(payload);
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.printf("[HTTP %d OK] Response: %s\n", httpResponseCode, response.c_str());
    } else {
      Serial.printf("[HTTP ERROR] %s\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== ColdChainRx ESP32 HTTP Client ===");

  dht.begin();
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
  setupTime();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) reconnectWiFi();
  unsigned long now = millis();
  if (now - lastPostTime >= POST_INTERVAL_MS || lastPostTime == 0) {
    lastPostTime = now;
    sendTelemetry();
  }
  delay(100);
}
