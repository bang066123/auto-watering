#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClient.h>

// ================================================================
// RAIN SENSOR - ESP32 + MQTT BROKER LOCAL (PORT 1884)
// GIAO THUC: MQTT CO BAO MAT USERNAME / PASSWORD
// ================================================================

// ================================================================
// 1. CAU HINH WI-FI & MQTT BROKER
// ================================================================
const char *ssid = "Iphone";
const char *password = "02042005";

// Dia chi IP broker (dung truc tiep kieu IPAddress de tranh loi DNS / spinlock trong lwIP)
IPAddress mqtt_broker(172, 20, 10, 4);
const int mqtt_port = 1884;
const char *mqtt_clientId = "ESP32_RainSensor";

// Thong tin tai khoan xac thuc MQTT Mosquitto
const char *mqtt_username = "BuiQuangAnh";
const char *mqtt_password = "020405";

// MQTT Topic
const char *topic_telemetry = "rain/data"; // Day du lieu cam bien mua

// ================================================================
// 2. CAU HINH CHAN PHAN CUNG & BIEN TOAN CUC
// ================================================================
#define RainPin 34
#define wifiLed 2

WiFiClient espClient;
PubSubClient mqttClient(espClient);

String rainText = "No Rain";
unsigned long lastTelemetryMillis = 0;
const unsigned long telemetryInterval = 3000;

// ================================================================
// 3. HAM KET NOI WI-FI AN TOAN
// ================================================================
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.print(">> Dang ket noi Wi-Fi: ");
  Serial.print(ssid);
  Serial.print(" ");

  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 40) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("[OK] Wi-Fi da ket noi thanh cong!");
    Serial.print(">> Dia chi IP cua ESP32: ");
    Serial.println(WiFi.localIP());
    // Cho 1 giay de stack TCP/IP tren Core 0 hoan tat gan IP on dinh
    delay(1000);
  } else {
    Serial.println();
    Serial.println("[CANH BAO] Ket noi Wi-Fi cham, tiep tuc trong loop...");
  }
}

// ================================================================
// 4. HAM DUY TRI KET NOI MQTT BROKER
// ================================================================
void reconnectMQTT() {
  if (!mqttClient.connected()) {
    Serial.print(">> Dang ket noi MQTT Broker (");
    Serial.print(mqtt_broker);
    Serial.printf(":%d)...\n", mqtt_port);

    if (mqttClient.connect(mqtt_clientId, mqtt_username, mqtt_password)) {
      Serial.println(">> [THANH CONG] Da xac thuc va ket noi MQTT Broker!");
      digitalWrite(wifiLed, HIGH);
    } else {
      digitalWrite(wifiLed, LOW);
      Serial.printf(">> [THAT BAI] Ma loi rc=%d. Thu lai sau 3s...\n", mqttClient.state());
    }
  }
}

// ================================================================
// 5. HAM DOC VA GUI DU LIEU CAM BIEN MUA
// ================================================================
void sendRain() {
  int rainVal = analogRead(RainPin);

  if (rainVal > 3500)
    rainText = "No Rain";
  else if (rainVal > 2000)
    rainText = "Light Rain";
  else if (rainVal > 1000)
    rainText = "Moderate Rain";
  else
    rainText = "Heavy Rain";

  Serial.printf(">> [SENSOR] Rain Value: %d | Trang thai: %s\n", rainVal, rainText.c_str());

  if (mqttClient.connected()) {
    String payload = "{\"rain\":\"" + rainText + "\",\"value\":" + String(rainVal) + "}";
    mqttClient.publish(topic_telemetry, payload.c_str());
    Serial.printf(">> [MQTT PUB] -> [%s]: %s\n", topic_telemetry, payload.c_str());
  }
}

// ================================================================
// 6. SETUP & LOOP
// ================================================================
void setup() {
  Serial.begin(9600);
  delay(500);

  pinMode(RainPin, INPUT);
  pinMode(wifiLed, OUTPUT);
  digitalWrite(wifiLed, LOW);

  Serial.println();
  Serial.println("========================================================");
  Serial.println("KHOI DONG ESP32 RAIN SENSOR (MQTT AUTHENTICATION)");
  Serial.println("========================================================");

  connectWiFi();

  mqttClient.setServer(mqtt_broker, mqtt_port);
  mqttClient.setBufferSize(512);
  mqttClient.setKeepAlive(60);
  mqttClient.setSocketTimeout(5);

  lastTelemetryMillis = millis();
}

void loop() {
  // 1. Duy tri ket noi Wi-Fi & MQTT
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      static unsigned long lastMqttRetry = 0;
      if (millis() - lastMqttRetry > 3000) {
        lastMqttRetry = millis();
        reconnectMQTT();
      }
    } else {
      mqttClient.loop();
    }
  } else {
    digitalWrite(wifiLed, LOW);
    static unsigned long lastWifiRetry = 0;
    if (millis() - lastWifiRetry > 10000) {
      lastWifiRetry = millis();
      WiFi.begin(ssid, password);
    }
  }

  // 2. Doc va gui du lieu cam bien mua moi 3 giay (chi gui khi da ket noi MQTT thanh cong)
  unsigned long now = millis();
  if (now - lastTelemetryMillis >= telemetryInterval) {
    lastTelemetryMillis = now;
    if (mqttClient.connected()) {
      sendRain();
    }
  }
}
