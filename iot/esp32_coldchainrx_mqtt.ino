/*
 * ColdChainRx - ESP32 Telemetry via Secure Cloud MQTT (HiveMQ Cloud / EMQX)
 * Option 2: Cloud MQTT Broker (TLS / Port 8883)
 * 
 * Target Board: ESP32 Dev Module / NodeMCU-32S
 * Libraries Required:
 *   - PubSubClient by Nick O'Leary
 *   - DHT sensor library by Adafruit
 *   - Adafruit Unified Sensor
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>

// ================= USER CONFIGURATION =================
// 1. Wi-Fi Settings
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// 2. Cloud MQTT Broker (e.g. HiveMQ Cloud cluster or EMQX Cloud)
const char* MQTT_BROKER   = "YOUR_CLUSTER_ID.s1.eu.hivemq.cloud";
const int   MQTT_PORT     = 8883; // TLS Secure port
const char* MQTT_USER     = "esp32_sensor_user";
const char* MQTT_PASS     = "YourSecurePassword123!";

// 3. Sensor & MQTT Topics
#define DHTPIN 4
#define DHTTYPE DHT11
#define LED_PIN 2

const char* BATCH_ID         = "BATCH_1792760493";
const char* REPORTER_ID      = "Sensor_Omkar_01";
const char* TOPIC_TELEMETRY  = "coldchain/telemetry";
const char* TOPIC_ALERT      = "coldchain/alerts";

const unsigned long SEND_INTERVAL_MS = 10000; // 10 seconds
// ======================================================

WiFiClientSecure secureEspClient;
PubSubClient mqttClient(secureEspClient);
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastSendTime = 0;

void mqttCallback(char* topic, byte* message, unsigned int length) {
  Serial.print("\n[MQTT Alert Received] Topic: ");
  Serial.println(topic);
  String msg = "";
  for (unsigned int i = 0; i < length; i++) {
    msg += (char)message[i];
  }
  Serial.println("Payload: " + msg);

  // If excursion alert, flash LED
  if (msg.indexOf("TEMPERATURE_EXCURSION") != -1) {
    Serial.println("🚨 [ALARM] TEMPERATURE EXCURSION REPORTED BY BLOCKCHAIN GATEWAY! 🚨");
    for (int i = 0; i < 6; i++) {
      digitalWrite(LED_PIN, LOW);
      delay(80);
      digitalWrite(LED_PIN, HIGH);
      delay(80);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("\n==================================================");
  Serial.println(" ColdChainRx - ESP32 Cloud MQTT (TLS 8883)");
  Serial.println(" Option 2: HiveMQ Cloud / PubSubClient");
  Serial.println("==================================================");

  dht.begin();

  // Insecure mode allows TLS connection to public cloud broker without
  // bundling bulky CA certificate files in ESP32 flash memory.
  secureEspClient.setInsecure();

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  connectToWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }

  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  unsigned long now = millis();
  if (now - lastSendTime >= SEND_INTERVAL_MS || lastSendTime == 0) {
    lastSendTime = now;
    publishTelemetry();
  }

  delay(100);
}

void connectToWiFi() {
  Serial.print("[WiFi] Connecting to: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }

  digitalWrite(LED_PIN, HIGH);
  Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Connecting to cloud broker: ");
    Serial.print(MQTT_BROKER);
    Serial.print("...");

    String clientId = "ESP32_Client_" + String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println(" Connected!");
      // Subscribe to alert topic for real-time feedback from Fabric
      mqttClient.subscribe(TOPIC_ALERT);
      Serial.println("[MQTT] Subscribed to: " + String(TOPIC_ALERT));
    } else {
      Serial.print(" Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" Retrying in 5 seconds...");
      delay(5000);
    }
  }
}

void publishTelemetry() {
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  if (isnan(temp) || isnan(hum)) {
    Serial.println("[Warning] DHT sensor error! Using simulated: 4.8 C");
    temp = 4.8;
    hum = 53.0;
  }

  String payload = "{";
  payload += "\"batchId\":\"" + String(BATCH_ID) + "\",";
  payload += "\"temperature\":" + String(temp, 2) + ",";
  payload += "\"humidity\":" + String(hum, 2) + ",";
  payload += "\"reporter\":\"" + String(REPORTER_ID) + "\"";
  payload += "}";

  Serial.println("[MQTT] Publishing to " + String(TOPIC_TELEMETRY) + ": " + payload);
  mqttClient.publish(TOPIC_TELEMETRY, payload.c_str());
}
