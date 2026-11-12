#include <WiFi.h>
#include <PubSubClient.h>
#include "DHT.h"
#include <time.h>

// ---------- 1. Wi-Fi Configuration ----------
// Connected to your phone hotspot
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// ==================================================
// 2. MQTT Configuration (Pointing to gateway.py on laptop)
// ==================================================
const char* mqtt_server = "YOUR_LAPTOP_IP";
const int mqtt_port = 1883;

// Telemetry & Alert Topics
const char* mqtt_topic       = "medical/sensor/data";
const char* mqtt_topic_alt   = "coldchain/telemetry";
const char* mqtt_alert_topic = "coldchain/Sensor_Omkar_01/alert";
const char* mqtt_alert_all   = "coldchain/alerts";

// ==================================================
// 3. Sensor & Hardware Configuration
// ==================================================
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// SENSOR ID ONLY — BATCH_ID REMOVED!
// The blockchain dynamically binds this sensor box to the active medicine batch.
const char* SENSOR_ID = "Sensor_Omkar_01";

// Safe medical storage limits (2°C - 8°C)
const float MIN_TEMP = 2.0;
const float MAX_TEMP = 8.0;

// Optional: LED Pin for Excursion Alerts
#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

// ==================================================
// 4. Simulation Mode
// ==================================================
// Set to false if reading from physical DHT11 sensor
bool simulationMode = false;

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

// ==================================================
// Network Objects & Timing
// ==================================================
WiFiClient espClient;
PubSubClient client(espClient);
unsigned long lastPublishTime = 0;
const unsigned long PUBLISH_INTERVAL = 5000;

// ==================================================
// Incoming MQTT Alert Callback (LED/Buzzer Trigger)
// ==================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("\n>>> [EXCURSION ALERT RECEIVED] Topic: ");
  Serial.println(topic);

  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.print(">>> Alert Details: ");
  Serial.println(message);

  // Flash alert LED
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(200);
    digitalWrite(LED_BUILTIN, LOW);
    delay(200);
  }
}

// ==================================================
// Wi-Fi Reconnection Logic
// ==================================================
void reconnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("\n================================");
  Serial.println("Wi-Fi connection lost!");
  Serial.println("Attempting Wi-Fi reconnection...");
  Serial.println("================================");

  WiFi.disconnect();
  delay(500);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi reconnected!");
    Serial.print("ESP32 IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi reconnection failed.");
  }
}

// ==================================================
// MQTT Reconnection Logic
// ==================================================
void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (client.connected()) return;

  Serial.println("Connecting to MQTT broker on laptop...");
  int attempts = 0;

  while (!client.connected() && attempts < 3) {
    String clientId = "ESP32_Sensor_Omkar_01-";
    clientId += String(random(0xffff), HEX);

    if (client.connect(clientId.c_str())) {
      Serial.println("MQTT connected to gateway.py broker!");

      // Subscribe to real-time excursion alert topics
      client.subscribe(mqtt_alert_topic);
      client.subscribe(mqtt_alert_all);
      Serial.println("Subscribed to excursion feedback alert topics.");
      return;
    } else {
      Serial.print("MQTT connection failed, state = ");
      Serial.println(client.state());
      delay(2000);
      attempts++;
    }
  }

  if (!client.connected()) {
    Serial.println("MQTT connection failed after 3 attempts.");
  }
}

// ==================================================
// Time Synchronization (NTP)
// ==================================================
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
    Serial.println("Time synchronization failed (gateway will inject timestamp).");
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

// ==================================================
// Sensor Helpers & Dynamic Payload Builder
// ==================================================
bool readSensorWithRetry(float &temperature, float &humidity) {
  for (int attempt = 1; attempt <= 3; attempt++) {
    temperature = dht.readTemperature();
    humidity    = dht.readHumidity();
    if (!isnan(temperature) && !isnan(humidity)) return true;
    delay(1000);
  }
  return false;
}

String getSensorStatus(float temperature, float humidity) {
  if (isnan(temperature) || isnan(humidity)) return "SENSOR_FAULT";
  if (temperature < -40.0 || temperature > 80.0 || humidity < 0.0 || humidity > 100.0) return "SENSOR_FAULT";
  if (temperature < MIN_TEMP || temperature > MAX_TEMP) return "EXCURSION";
  return "NORMAL";
}

// BATCH_ID OMITTED: Blockchain dynamically maps sensor_id -> active batch
String createPayload(float temperature, float humidity, String status) {
  String timestamp = getTimestamp();
  String payload = "{";
  payload += "\"sensor_id\":\"" + String(SENSOR_ID) + "\",";
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

void publishSensorData() {
  float temperature;
  float humidity;

  if (!simulationMode) {
    if (!readSensorWithRetry(temperature, humidity)) {
      temperature = NAN;
      humidity    = NAN;
      Serial.println("\nSENSOR FAULT: Missing reading");
    }
  } else {
    temperature = simulatedTemperatures[simulationIndex];
    humidity    = SIMULATED_HUMIDITY;
    simulationIndex++;
    if (simulationIndex >= sizeof(simulatedTemperatures) / sizeof(simulatedTemperatures[0])) {
      simulationIndex = 0;
    }
  }

  String status  = getSensorStatus(temperature, humidity);
  String payload = createPayload(temperature, humidity, status);

  Serial.println("\nSensor telemetry payload:");
  Serial.println(payload);

  if (client.connected()) {
    if (client.publish(mqtt_topic, payload.c_str())) {
      Serial.println("Data published to MQTT -> gateway.py");
    } else {
      Serial.println("ERROR: MQTT publish failed");
    }
  } else {
    Serial.println("MQTT not connected. Data not published.");
  }
}

// ==================================================
// Setup & Loop
// ==================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==========================================");
  Serial.println("ColdChainRx ESP32 (Dynamic Device Binding)");
  Serial.println("==========================================");

  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  dht.begin();
  Serial.println("Connecting to Wi-Fi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 30) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi connected!");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
    setupTime();
  } else {
    Serial.println("Initial Wi-Fi connection failed.");
  }

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);
  reconnectMQTT();
  Serial.println("System initialization complete.");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    reconnectWiFi();
    if (WiFi.status() == WL_CONNECTED) setupTime();
  }

  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) reconnectMQTT();
    client.loop();
  }

  unsigned long currentMillis = millis();
  if (currentMillis - lastPublishTime >= PUBLISH_INTERVAL) {
    lastPublishTime = currentMillis;
    publishSensorData();
  }
  delay(100);
}
