/*
 * ColdChainRx - Direct HTTP POST Sketch for ESP32
 * ============================================================
 * Recommended Remote Setup (Swagata's Method 1)
 *
 * Posts temperature & humidity telemetry directly to Swagata's
 * Hyperledger Fabric backend via Cloudflare Tunnel over HTTPS/HTTP.
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
// Set your Wi-Fi network name and password
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ------------------------------------------------------------
// 2. Swagata's Live Cloudflare Backend & Active Batch
// ------------------------------------------------------------
const char* BACKEND_URL = "https://youth-gregory-disc-might.trycloudflare.com/api/iot/temperature";
const char* BATCH_ID    = "BATCH_1792760493";
const char* REPORTER_ID = "Sensor_Omkar_01";

// Safe medical temperature limits (2°C - 8°C)
const float MIN_TEMP = 2.0;
const float MAX_TEMP = 8.0;

// ------------------------------------------------------------
// 3. Sensor & Simulation Settings
// ------------------------------------------------------------
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// true = cycles through test values (including normal & excursion)
// false = reads live physical DHT11 sensor on pin 4
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
const unsigned long POST_INTERVAL_MS = 10000; // Post every 10 seconds
unsigned long lastPostTime = 0;

// ------------------------------------------------------------
// Wi-Fi Reconnection Logic
// ------------------------------------------------------------
void reconnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("\n================================");
  Serial.println("Wi-Fi connection lost!");
  Serial.println("Attempting Wi-Fi reconnection...");
  Serial.println("================================");

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

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi reconnected!");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi reconnection failed.");
  }
}

// ------------------------------------------------------------
// NTP Time Synchronization
// ------------------------------------------------------------
void setupTime() {
  Serial.println("Getting time from NTP...");
  configTime(19800, 0, "pool.ntp.org", "time.nist.gov"); // IST = UTC + 5:30

  struct tm timeinfo;
  int attempts = 0;
  while (!getLocalTime(&timeinfo) && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (getLocalTime(&timeinfo)) {
    Serial.println("Time synchronized!");
  } else {
    Serial.println("NTP time sync failed (using fallback).");
  }
}

String getTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "TIME_UNAVAILABLE";
  }
  char timestamp[25];
  strftime(timestamp, sizeof(timestamp), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(timestamp);
}

// ------------------------------------------------------------
// Payload Construction (String-based, zero extra libraries)
// ------------------------------------------------------------
String getSensorStatus(float temperature) {
  if (isnan(temperature) || temperature < -40.0 || temperature > 80.0) {
    return "SENSOR_FAULT";
  }
  if (temperature < MIN_TEMP || temperature > MAX_TEMP) {
    return "EXCURSION";
  }
  return "NORMAL";
}

String createPayload(float temperature, float humidity, String status) {
  String timestamp = getTimestamp();
  String payload = "{";
  payload += "\"batchId\":\"" + String(BATCH_ID) + "\",";
  payload += "\"sensor_id\":\"" + String(REPORTER_ID) + "\",";
  payload += "\"reporter\":\"" + String(REPORTER_ID) + "\",";
  payload += "\"temperature\":";
  payload += isnan(temperature) ? "null" : String(temperature, 2);
  payload += ",";
  payload += "\"humidity\":";
  payload += isnan(humidity) ? "null" : String(humidity, 2);
  payload += ",";
  payload += "\"min_temp\":" + String(MIN_TEMP, 2) + ",";
  payload += "\"max_temp\":" + String(MAX_TEMP, 2) + ",";
  payload += "\"timestamp\":\"" + timestamp + "\",";
  payload += "\"status\":\"" + status + "\"";
  payload += "}";
  return payload;
}

// ------------------------------------------------------------
// HTTP POST Execution
// ------------------------------------------------------------
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

  String status  = getSensorStatus(temperature);
  String payload = createPayload(temperature, humidity, status);

  Serial.println("\n--- Telemetry Payload ---");
  Serial.println(payload);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(BACKEND_URL);
    http.addHeader("Content-Type", "application/json");

    Serial.print("[HTTP] POSTing directly to Swagata's Fabric backend...");
    int httpResponseCode = http.POST(payload);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.printf(" [HTTP %d OK]\n", httpResponseCode);
      Serial.println("[Fabric Response] " + response);
    } else {
      Serial.printf(" [HTTP ERROR] %s\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  } else {
    Serial.println("[HTTP] Wi-Fi not connected. Skipping upload.");
  }
}

// ------------------------------------------------------------
// Setup & Main Loop
// ------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==========================================");
  Serial.println("ColdChainRx - ESP32 Direct HTTP Client");
  Serial.println("==========================================");

  dht.begin();

  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 30) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
    setupTime();
  } else {
    Serial.println("[WiFi] Initial connection failed.");
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    reconnectWiFi();
    if (WiFi.status() == WL_CONNECTED) setupTime();
  }

  unsigned long now = millis();
  if (now - lastPostTime >= POST_INTERVAL_MS || lastPostTime == 0) {
    lastPostTime = now;
    sendTelemetry();
  }
  delay(100);
}
