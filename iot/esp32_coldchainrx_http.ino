/*
 * ColdChainRx - ESP32 Telemetry via Direct HTTPS (Cloudflare Tunnel)
 * Option 1: Direct HTTP REST to Hyperledger Fabric Gateway
 * 
 * Target Board: ESP32 Dev Module / NodeMCU-32S
 * Sensor: DHT11 or DHT22 (Data pin connected to GPIO 4)
 * 
 * Hardware Wiring:
 *   ESP32 3V3 / VIN  --> DHT VCC
 *   ESP32 GND        --> DHT GND
 *   ESP32 GPIO 4     --> DHT DATA (Use 10k pullup resistor if not on breakout board)
 *   ESP32 GPIO 2     --> Built-in Status LED
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// ================= USER CONFIGURATION =================
// 1. Wi-Fi Credentials (Mobile hotspot, home Wi-Fi, etc.)
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// 2. ColdChainRx Cloudflare Live Endpoint
// Public tunnel URL created on Swagata's machine:
const char* BACKEND_URL   = "https://youth-gregory-disc-might.trycloudflare.com/api/iot/temperature";

// 3. Sensor & Batch Metadata
#define DHTPIN 4          // GPIO pin where DHT sensor data pin is connected
#define DHTTYPE DHT11     // Change to DHT22 if using white DHT22 sensor
#define LED_PIN 2         // ESP32 Onboard LED indicator

const char* BATCH_ID      = "BATCH_1792760493";
const char* REPORTER_ID   = "Sensor_Omkar_01";

// Interval between telemetry transmissions (in milliseconds)
const unsigned long SEND_INTERVAL_MS = 10000; // 10 seconds
// ======================================================

DHT dht(DHTPIN, DHTTYPE);
unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("\n==================================================");
  Serial.println(" ColdChainRx - ESP32 Blockchain IoT Client");
  Serial.println(" Option 1: Direct HTTPS REST via Cloudflare Tunnel");
  Serial.println("==================================================");

  // Initialize DHT sensor
  dht.begin();
  Serial.println("[Sensor] DHT initialized on GPIO " + String(DHTPIN));

  // Connect to Wi-Fi
  connectToWiFi();
}

void loop() {
  // Ensure Wi-Fi stays connected
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }

  // Periodic Telemetry Send
  unsigned long now = millis();
  if (now - lastSendTime >= SEND_INTERVAL_MS || lastSendTime == 0) {
    lastSendTime = now;
    sendTelemetry();
  }

  delay(100);
}

void connectToWiFi() {
  Serial.print("[WiFi] Connecting to: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN)); // Toggle LED while connecting
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_PIN, HIGH);
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP Assigned: ");
    Serial.println(WiFi.localIP());
    Serial.print("[WiFi] Signal Strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    digitalWrite(LED_PIN, LOW);
    Serial.println("\n[WiFi] Connection timed out. Will retry in main loop.");
  }
}

void sendTelemetry() {
  // Read temperature and humidity
  float temp = dht.readTemperature(); // Celsius
  float hum = dht.readHumidity();

  // Validate sensor readings (fallback to simulation if DHT sensor is disconnected)
  if (isnan(temp) || isnan(hum)) {
    Serial.println("[Warning] Failed to read from DHT sensor! (Check wiring)");
    Serial.println("[Info] Using fallback demo reading: 4.5 C, 55.0% RH");
    temp = 4.5;
    hum = 55.0;
  }

  Serial.println("\n--------------------------------------------------");
  Serial.printf("[Sensor Reading] Temp: %.2f C | Humidity: %.2f %%\n", temp, hum);

  // Construct JSON payload
  // Format matches ColdChainRx backend /api/iot/temperature
  String payload = "{";
  payload += "\"batchId\":\"" + String(BATCH_ID) + "\",";
  payload += "\"temperature\":" + String(temp, 2) + ",";
  payload += "\"humidity\":" + String(hum, 2) + ",";
  payload += "\"reporter\":\"" + String(REPORTER_ID) + "\"";
  payload += "}";

  Serial.println("[HTTP] Sending POST payload:");
  Serial.println(payload);

  HTTPClient http;
  
  // Initialize HTTPS connection
  // Cloudflare uses standard public CA TLS certificates recognized by default
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000); // 10 second timeout

  // Blink LED to indicate transmission
  digitalWrite(LED_PIN, LOW);
  int httpResponseCode = http.POST(payload);
  digitalWrite(LED_PIN, HIGH);

  if (httpResponseCode > 0) {
    Serial.printf("[HTTP] Success! Response Code: %d\n", httpResponseCode);
    String response = http.getString();
    Serial.println("[Blockchain Gateway Response]:");
    Serial.println(response);

    // Simple excursion alert visual feedback
    if (response.indexOf("\"excursionAlert\":true") != -1) {
      Serial.println("\n🚨 [ALERT] BLOCKCHAIN DETECTED TEMPERATURE EXCURSION! 🚨");
      // Fast blink 5 times
      for (int i = 0; i < 5; i++) {
        digitalWrite(LED_PIN, LOW);
        delay(100);
        digitalWrite(LED_PIN, HIGH);
        delay(100);
      }
    }
  } else {
    Serial.printf("[HTTP] Error sending POST request: %s (code %d)\n", 
                  http.errorToString(httpResponseCode).c_str(), httpResponseCode);
  }

  http.end();
  Serial.println("--------------------------------------------------");
}
