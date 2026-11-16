#include <AceButton.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClient.h>
#if __has_include(<esp_arduino_version.h>)
#include <esp_arduino_version.h>
#endif
using namespace ace_button;

// ================================================================
// PUMP CONTROLLER - ESP32 + MQTT BROKER LOCAL (PORT 1884)
// GIAO THUC: MQTT CO BAO MAT USERNAME / PASSWORD
// ================================================================

// ================================================================
// CHE DO STANDALONE (OFFLINE)
//   true  = Chi dung nut bam + tu dong tuoi, KHONG can WiFi/MQTT
//   false = Day du: WiFi + MQTT + Web Dashboard
// Doi thanh true khi muon chay doc lap khong can mang
// ================================================================
#define STANDALONE_MODE false

// ================================================================
// 1. CAU HINH WI-FI & MQTT BROKER BAO MAT (THEO abc.txt)
// ================================================================
// Wi-Fi (Hotspot 2.4 GHz)
const char *ssid = "Iphone";
const char *password = "02042005";

// Cau hinh MQTT Mosquitto Broker chay tren may tinh
const char *mqtt_broker =
    "172.20.10.2";         // Dia chi IPv4 cua may tinh trong mang Wi-Fi
const int mqtt_port = 1884; // Cong MQTT bao mat
const char *mqtt_clientId = "ESP32_PumpController";

// Thong tin tai khoan xac thuc MQTT Mosquitto
const char *mqtt_username = "HoangManhCuong";
const char *mqtt_password = "B23DCCN108";

// Danh sach cac MQTT Topic theo thiet ke he thong
const char *topic_telemetry = "nhom11/sensor/telemetry"; // Day du lieu cam bien
const char *topic_control =
    "nhom11/device/control";                 // Nhan lenh dieu khien bat/tat
const char *topic_ack = "nhom11/device/ack"; // Ban phan hoi trang thai thuc thi

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ================================================================
// 2. CAU HINH CHAN PHAN CUNG (HARDWARE PINS)
// ================================================================
#define SensorPin 34
#define DHTPin 14
#define PumpPin 25
#define wifiLed 2
#define RelayButtonPin 32
#define ModeSwitchPin 33
#define BuzzerPin 26
#define ModeLed 15
#define DHTTYPE DHT11

// ================================================================
// 3. BIEN TOAN CUC & KHOI TAO DOI TUONG
// ================================================================
int drySoilVal = 0;
int wetSoilVal = 500;
int moistPerLow = 50;
int moistPerHigh = 75;

int sensorVal = 0;
int moisturePercentage = 0;
bool togglePump = LOW;
bool prevMode = true;    // true = Auto, false = Manual
bool pumpActive = false; // Chu ky tuoi tu dong dang hoat dong
int temperature1 = 0;
int humidity1 = 0;
int rainLevel = 0;
String rainText = "No Rain";
String currMode = "AUTO";

unsigned long cycleStartTime = 0;
int startMoisture = 0;
int endMoisture = 0;
int cycleId = 0;

unsigned long lastTelemetryMillis = 0;
const unsigned long telemetryInterval =
    3000; // Gui du lieu cam bien moi 3 giay len telemetry

DHT dht(DHTPin, DHTTYPE);
ButtonConfig config1, config2;
AceButton button1(&config1), button2(&config2);

// PWM Bơm
#define PWM_CHANNEL 0
#define PWM_FREQ 1000
#define PWM_RES 8
int pumpPwmSpeed = 220; // Toc do xung PWM may bom (0 - 255), mac dinh 220/255 (~86%)

// ================================================================
// 4. FUNCTION PROTOTYPES
// ================================================================
void controlBuzzer(int duration);
void button1Handler(AceButton *, uint8_t, uint8_t);
void button2Handler(AceButton *, uint8_t, uint8_t);
void getMoisture();
void getWeather();
void controlMoist();
void checkRainSafety();
void sendTelemetry();
void reconnectMQTT();
void applyMode(bool autoMode);
void applyPump(bool on);
void parseRainLevelFromText(const String &txt);
void sendCycleSummary();
void mqttCallback(char *topic, byte *payload, unsigned int length);

// ================================================================
// 5. CAC HAM HO TRO (HELPERS)
// ================================================================
void pumpSpeed(int duty) {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(PumpPin, duty);
#else
  ledcWrite(PWM_CHANNEL, duty);
#endif
}

void controlBuzzer(int duration) {
  // Tao chuoi xung vuong ~2.5kHz: dam bao keu to ro cho ca Passive Buzzer va
  // Active Buzzer
  unsigned long start = millis();
  while (millis() - start < (unsigned long)duration) {
    digitalWrite(BuzzerPin, HIGH);
    delayMicroseconds(200);
    digitalWrite(BuzzerPin, LOW);
    delayMicroseconds(200);
  }
  digitalWrite(BuzzerPin, LOW);
}

void getMoisture() {
  // Đọc trung bình 5 lần để lọc nhiễu xung nguồn từ dây/củ sạc
  long sum = 0;
  for (int i = 0; i < 5; i++) {
    sum += analogRead(SensorPin);
    delay(3);
  }
  sensorVal = sum / 5;

  // Ánh xạ sang tỷ lệ phần trăm (0 - 100%)
  moisturePercentage = map(sensorVal, drySoilVal, wetSoilVal, 0, 100);
  moisturePercentage = constrain(moisturePercentage, 0, 100);

  Serial.printf(">> [CAM BIEN DAT] ADC Pin 34: %d -> Do am: %d%%\n", sensorVal, moisturePercentage);
}

void getWeather() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (!isnan(h) && !isnan(t)) {
    humidity1 = int(h);
    temperature1 = int(t);
  }
}

void parseRainLevelFromText(const String &txt) {
  String t = txt;
  t.toLowerCase();
  if (t.indexOf("heavy") >= 0 || t.indexOf("lon") >= 0 ||
      t.indexOf("lá»›n") >= 0)
    rainLevel = 3;
  else if (t.indexOf("moderate") >= 0 || t.indexOf("vua") >= 0 ||
           t.indexOf("vá»«a") >= 0)
    rainLevel = 2;
  else if (t.indexOf("light") >= 0 || t.indexOf("nho") >= 0 ||
           t.indexOf("nhá»") >= 0)
    rainLevel = 1;
  else if (t.indexOf("no rain") >= 0 || t.indexOf("khong mua") >= 0 ||
           t.indexOf("khÃ´ng mÆ°a") >= 0)
    rainLevel = 0;
  else if (t.indexOf("rain") >= 0 || t.indexOf("mua") >= 0 ||
           t.indexOf("mÆ°a") >= 0)
    rainLevel = 1;
  else
    rainLevel = 0;
}

// Ham kiem tra an toan mua: chay lien tuc trong loop, bat ke AUTO hay MANUAL
void checkRainSafety() {
  if (rainLevel >= 1 && togglePump == HIGH) {
    Serial.printf(">> [CANH BAO AN TOAN] Phat hien troi mua (Level %d) o che "
                  "do %s -> Ngat bom ngay lap tuc!\n",
                  rainLevel, currMode.c_str());
    applyPump(false);
    controlBuzzer(200);
    pumpActive = false;
  }
}

// ================================================================
// 6. GUI TELEMETRY & BAO CAO LEN MQTT BROKER (TOPIC: nhom11/sensor/telemetry)
// ================================================================
void sendTelemetry() {
  getMoisture();
  getWeather();
  currMode = prevMode ? "AUTO" : "MANUAL";

  StaticJsonDocument<384> doc;
  doc["temperature"] = temperature1;
  doc["humidity"] = humidity1;
  doc["soilMoisture"] = moisturePercentage;
  doc["mode"] = currMode;
  doc["pump"] = togglePump ? "ON" : "OFF";
  doc["rain"] = rainText;
  doc["lowThreshold"] = moistPerLow;
  doc["highThreshold"] = moistPerHigh;
  doc["pwmSpeed"] = pumpPwmSpeed;

  char payload[256];
  serializeJson(doc, payload);

  Serial.printf(">> [TELEMETRY] Dat: ADC=%d (%d%%) | Nhiet do: %dC | Do am: %d%% | Bom: %s | Che do: %s\n",
                sensorVal, moisturePercentage, temperature1, humidity1, togglePump ? "ON" : "OFF", currMode.c_str());

  if (mqttClient.connected()) {
    mqttClient.publish(topic_telemetry, payload);
    Serial.printf(">> [MQTT TELEMETRY PUB] -> [%s]: %s\n", topic_telemetry,
                  payload);
  }
}

void sendCycleSummary() {
  unsigned long duration_s = (millis() - cycleStartTime) / 1000.0;
  int moistureGain = endMoisture - startMoisture;

  StaticJsonDocument<256> doc;
  doc["cycleId"] = cycleId;
  doc["duration_s"] = duration_s;
  doc["startMoisture"] = startMoisture;
  doc["endMoisture"] = endMoisture;
  doc["moistureGain"] = moistureGain;
  doc["lowThreshold"] = moistPerLow;
  doc["highThreshold"] = moistPerHigh;

  char payload[256];
  serializeJson(doc, payload);

  Serial.printf(">> [TELEMETRY] Dat: ADC=%d (%d%%) | Nhiet do: %dC | Do am: %d%% | Bom: %s | Che do: %s\n",
                sensorVal, moisturePercentage, temperature1, humidity1, togglePump ? "ON" : "OFF", currMode.c_str());

  if (mqttClient.connected()) {
    mqttClient.publish(topic_telemetry, payload);
    Serial.printf(">> [CYCLE SUMMARY PUB] -> [%s]: %s\n", topic_telemetry,
                  payload);
  }
}

void applyMode(bool autoMode) {
  prevMode = autoMode;
  currMode = prevMode ? "AUTO" : "MANUAL";
  digitalWrite(ModeLed, prevMode ? HIGH : LOW);

  // Neu chuyen sang MANUAL: bat buoc tat bom va huy chu ky tuoi an toan
  if (!prevMode) {
    applyPump(false);
    pumpActive = false;
  }

  StaticJsonDocument<128> doc;
  doc["mode"] = currMode;
  char payload[128];
  serializeJson(doc, payload);

  if (mqttClient.connected()) {
    mqttClient.publish(topic_telemetry, payload);
  }
  Serial.println(">> Mode sync: " + currMode);
}

void applyPump(bool on) {
  // Neu co mua ma co lenh bat bom -> Khoa va tu choi bat (ke ca nut bam hay
  // lenh Web)
  if (on && rainLevel >= 1) {
    Serial.printf(
        ">> [KHOA AN TOAN] Dang co mua (Level %d), tu choi bat bom!\n",
        rainLevel);
    controlBuzzer(300);
    togglePump = false;
    pumpSpeed(0);
    digitalWrite(PumpPin, LOW);
    sendTelemetry();
    return;
  }

  togglePump = on;
  if (togglePump) {
    pumpSpeed(pumpPwmSpeed);
    digitalWrite(PumpPin, HIGH);
  } else {
    pumpSpeed(0);
    digitalWrite(PumpPin, LOW);
  }

  sendTelemetry();
  Serial.println(togglePump ? ">> Pump ON" : ">> Pump OFF");
}

// ================================================================
// 7. HAM XU LY NHAN LENH MQTT (TOPIC: nhom11/device/control & rain/data)
// ================================================================
void mqttCallback(char *topic, byte *payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  String topicStr(topic);
  Serial.printf("\n[MQTT RECV] Topic [%s]: %s\n", topicStr.c_str(),
                message.c_str());

  // 1. Nháº­n dá»¯ liá»‡u cáº­p nháº­t mÆ°a tá»« rain sensor (topic: rain/data
  // hoáº·c payload cÃ³ key "rain")
  if (topicStr == "rain/data" || message.indexOf("\"rain\"") >= 0) {
    StaticJsonDocument<256> rainDoc;
    DeserializationError err = deserializeJson(rainDoc, message);
    if (!err) {
      if (rainDoc.containsKey("rain")) {
        rainText = rainDoc["rain"].as<String>();
      }
      if (rainDoc.containsKey("value")) {
        int val = rainDoc["value"].as<int>();
        if (val <= 1000)
          rainLevel = 3;
        else if (val <= 2000)
          rainLevel = 2;
        else if (val <= 3500)
          rainLevel = 1;
        else
          rainLevel = 0;
      }
      parseRainLevelFromText(rainText);
    } else if (message.indexOf("\"rain\"") >= 0) {
      int rs = message.indexOf(":\"", message.indexOf("\"rain\"")) + 2;
      int re = message.indexOf("\"", rs);
      rainText = message.substring(rs, re);
      parseRainLevelFromText(rainText);
    }
    Serial.printf(">> Cap nhat du lieu mua: %s (Level: %d)\n", rainText.c_str(),
                  rainLevel);

    // Kiem tra an toan mua: ngat bom ngay neu dang bat
    checkRainSafety();
  }

  // 2. Nháº­n lá»‡nh Ä‘iá»u khiá»ƒn (topic_control hoáº·c RPC
  // request)
  if (topicStr == topic_control ||
      topicStr.startsWith("v1/devices/me/rpc/request/")) {
    StaticJsonDocument<384> doc;
    DeserializationError err = deserializeJson(doc, message);

    int historyId = 0;
    bool handled = false;

    if (!err) {
      if (doc.containsKey("historyId"))
        historyId = doc["historyId"].as<int>();

      // Cau hinh tham so nguong do am va toc do PWM tu Web
      if (doc.containsKey("lowThreshold") || doc.containsKey("highThreshold") || doc.containsKey("pwmSpeed")) {
        if (doc.containsKey("lowThreshold")) {
          moistPerLow = doc["lowThreshold"].as<int>();
        }
        if (doc.containsKey("highThreshold")) {
          moistPerHigh = doc["highThreshold"].as<int>();
        }
        if (doc.containsKey("pwmSpeed")) {
          pumpPwmSpeed = doc["pwmSpeed"].as<int>();
        }
        Serial.printf(">> [CAU HINH MOI TU WEB] Nguong bat: %d%%, Nguong tat: %d%%, PWM: %d/255\n",
                      moistPerLow, moistPerHigh, pumpPwmSpeed);
        controlBuzzer(150);
        sendTelemetry();
        handled = true;
      }

      // Äá»•i cháº¿ Ä‘á»™ Auto / Manual
      if (doc.containsKey("mode")) {
        String m = doc["mode"].as<String>();
        m.toUpperCase();
        bool newMode = (m == "AUTO" || m == "A" || m == "TRUE" || m == "1");
        applyMode(newMode);
        handled = true;
      } else if (doc.containsKey("setMode")) {
        bool newMode = doc["setMode"].as<bool>() ||
                       (doc["setMode"].as<String>() == "true");
        applyMode(newMode);
        handled = true;
      }

      // Äiá»u khiá»ƒn bÆ¡m
      if (doc.containsKey("action")) {
        String action = doc["action"].as<String>();
        action.toUpperCase();
        if (action == "ON" || action == "1" || action == "PUMP_ON") {
          if (prevMode)
            applyMode(
                false); // Chuyá»ƒn vá» MANUAL khi can thiá»‡p bÆ¡m
          applyPump(true);
          handled = true;
        } else if (action == "OFF" || action == "0" || action == "PUMP_OFF") {
          if (prevMode)
            applyMode(
                false); // Chuyá»ƒn vá» MANUAL khi can thiá»‡p bÆ¡m
          applyPump(false);
          handled = true;
        } else if (action == "AUTO") {
          applyMode(true);
          handled = true;
        } else if (action == "MANUAL") {
          applyMode(false);
          handled = true;
        }
      } else if (doc.containsKey("pump")) {
        String p = doc["pump"].as<String>();
        p.toUpperCase();
        bool newPump = (p == "ON" || p == "1" || p == "TRUE");
        if (prevMode)
          applyMode(false);
        applyPump(newPump);
        handled = true;
      } else if (doc.containsKey("setWater")) {
        bool newPump = doc["setWater"].as<bool>() ||
                       (doc["setWater"].as<String>() == "true");
        if (prevMode)
          applyMode(false);
        applyPump(newPump);
        handled = true;
      }
    } else {
      // Fallback xá»­ lÃ½ dáº¡ng text Ä‘Æ¡n giáº£n
      String upper = message;
      upper.toUpperCase();
      if (upper.indexOf("PUMP_ON") != -1 || upper.indexOf("ON") != -1) {
        if (prevMode)
          applyMode(false);
        applyPump(true);
        handled = true;
      } else if (upper.indexOf("PUMP_OFF") != -1 ||
                 upper.indexOf("OFF") != -1) {
        if (prevMode)
          applyMode(false);
        applyPump(false);
        handled = true;
      }
      if (upper.indexOf("AUTO") != -1) {
        applyMode(true);
        handled = true;
      } else if (upper.indexOf("MANUAL") != -1) {
        applyMode(false);
        handled = true;
      }
    }

    if (handled) {
      controlBuzzer(120);

      StaticJsonDocument<200> ackDoc;
      ackDoc["device"] = "pump_controller";
      ackDoc["pump"] = togglePump ? "ON" : "OFF";
      ackDoc["mode"] = currMode;
      ackDoc["status"] = "SUCCESS";
      if (historyId > 0) {
        ackDoc["historyId"] = historyId;
      }

      char ackBuffer[200];
      serializeJson(ackDoc, ackBuffer);
      mqttClient.publish(topic_ack, ackBuffer);
      Serial.printf(">> [MQTT ACK PUB] -> [%s]: %s\n", topic_ack, ackBuffer);
    }
  }
}

// ================================================================
// 8. HAM DUY TRI KET NOI MQTT BROKER (CO XAC THUC USER / PASS)
// ================================================================
void reconnectMQTT() {
  if (!mqttClient.connected()) {
    Serial.printf(">> Dang ket noi MQTT Broker bao mat (%s:%d)...\n",
                  mqtt_broker, mqtt_port);

    if (mqttClient.connect(mqtt_clientId, mqtt_username, mqtt_password)) {
      Serial.println(">> [THANH CONG] Da xac thuc va ket noi MQTT Broker!");
      digitalWrite(wifiLed, HIGH);

      // Dang ky nhan lenh dieu khien va du lieu cam bien mua
      mqttClient.subscribe(topic_control);
      Serial.printf(">> Da Subscribe topic: %s\n", topic_control);

      mqttClient.subscribe("rain/data");
      Serial.println(">> Da Subscribe topic: rain/data");

      // Dong bo ngay lap tuc trang thai khi ket noi thanh cong
      sendTelemetry();
    } else {
      Serial.printf(">> [THAT BAI], ma loi rc=%d (rc=4: Sai User/Pass, rc=5: "
                    "Khong co quyen). Thu lai sau 3s...\n",
                    mqttClient.state());
      digitalWrite(wifiLed, LOW);
    }
  }
}

// ================================================================
// 9. THUAT TOAN TUOI TU DONG THONG MINH
// ================================================================
void controlMoist() {
  static unsigned long lastPumpTime = 0;
  static bool midSent = false;
  static bool cycleSent = false;
  unsigned long now = millis();

  // 1. Kiem tra an toan troi mua: ca AUTO va MANUAL deu ap dung
  if (rainLevel >= 1) {
    if (togglePump == HIGH) {
      checkRainSafety();
    }
    pumpActive = false;
    return;
  }

  // 2. Chi chay chu ky tuoi tu dong khi o che do AUTO (prevMode == true)
  if (prevMode) {
    if (pumpActive) {
      unsigned long elapsed = now - lastPumpTime;

      // Dang bom va da du 10 giay -> Dung bom nghi 10 giay cho nuoc ngam
      if (togglePump == HIGH && elapsed >= 10000) {
        Serial.println("â¸ Da bom du 10s -> Dung nghi 10s cho nuoc ngam");
        applyPump(false);
        lastPumpTime = now;
        midSent = false;
      }
      // Dang nghi va da du 10 giay -> Doc lai cam bien de quyet dinh
      else if (togglePump == LOW && elapsed >= 10000) {
        getMoisture();
        Serial.printf(">> Het 10s ngam, do lai do am: %d%%\n",
                      moisturePercentage);

        if (moisturePercentage >= moistPerHigh) {
          endMoisture = moisturePercentage;
          applyPump(false);
          sendCycleSummary();
          cycleSent = true;
          pumpActive = false;
          Serial.println(">> [HOAN TAT] Dat da dat do am mong muon!");
        } else {
          Serial.println(">> Dat van chua du am -> Bom tiep 10s");
          applyPump(true);
          lastPumpTime = now;
        }
        midSent = false;
      }
      return;
    }

    // 3. Neu chua trong chu ky tuoi: Kiem tra khi dat kho (< 50%) de bat dau
    getMoisture();
    if (moisturePercentage < moistPerLow && rainLevel < 1) {
      cycleId++;
      Serial.printf(
          ">> [BAT DAU] Dat kho (%d%% < 50%%) -> Kich hoat chu ky #%d\n",
          moisturePercentage, cycleId);

      StaticJsonDocument<64> doc;
      doc["cycleId"] = cycleId;
      char payload[64];
      serializeJson(doc, payload);
      mqttClient.publish(topic_telemetry, payload);

      startMoisture = moisturePercentage;
      cycleStartTime = now;
      pumpActive = true;
      cycleSent = false;
      lastPumpTime = now;
      applyPump(true);
      controlBuzzer(100);
    }
  } else {
    pumpActive = false;
  }
}

// ================================================================
// 10. XU LY NUT BAM VAT LY TRUC TIEP (NHAY 100%, CHONG RUNG PHIM)
// ================================================================
void handleButtons() {
  static int lastS2 = HIGH;
  static int lastS7 = HIGH;
  static unsigned long lastDebounceS2 = 0;
  static unsigned long lastDebounceS7 = 0;
  unsigned long now = millis();

  // Nut S2: Chuyen doi che do AUTO / MANUAL (Chan 33)
  int s2 = digitalRead(ModeSwitchPin);
  if (s2 == LOW && lastS2 == HIGH && (now - lastDebounceS2 > 300)) {
    lastDebounceS2 = now;
    controlBuzzer(100);
    applyMode(!prevMode); // Chuyen che do: AUTO <-> MANUAL
    Serial.printf(">> [NUT S2 BAM] Chuyen che do -> %s\n", currMode.c_str());
  }
  lastS2 = s2;

  // Nut S7: Bat / Tat may bom (Chan 32)
  int s7 = digitalRead(RelayButtonPin);
  if (s7 == LOW && lastS7 == HIGH && (now - lastDebounceS7 > 300)) {
    lastDebounceS7 = now;
    controlBuzzer(100);
    if (prevMode) {
      applyMode(
          false); // Dang o AUTO ma can thiep nut bom -> Tu chuyen ve MANUAL
    }
    applyPump(!togglePump); // Dao trang thai bom: ON <-> OFF
    Serial.printf(">> [NUT S7 BAM] May bom -> %s (Che do: %s)\n",
                  togglePump ? "ON" : "OFF", currMode.c_str());
  }
  lastS7 = s7;
}

void button1Handler(AceButton *, uint8_t eventType, uint8_t) {}
void button2Handler(AceButton *, uint8_t eventType, uint8_t) {}

// ================================================================
// 11. SETUP KHOI DONG HE THONG
// ================================================================
void setup() {
  Serial.begin(9600);
  pinMode(wifiLed, OUTPUT);
  pinMode(ModeLed, OUTPUT);
  pinMode(BuzzerPin, OUTPUT);
  pinMode(RelayButtonPin, INPUT_PULLUP);
  pinMode(ModeSwitchPin, INPUT_PULLUP);

#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(PumpPin, PWM_FREQ, PWM_RES);
#else
  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RES);
  ledcAttachPin(PumpPin, PWM_CHANNEL);
#endif

  dht.begin();
  config1.setEventHandler(button1Handler);
  config2.setEventHandler(button2Handler);
  button1.init(RelayButtonPin);
  button2.init(ModeSwitchPin);

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
  } else {
    Serial.println();
    Serial.println(
        "[CANH BAO] Ket noi Wi-Fi cham hoac chua nhan, tiep tuc vong lap...");
  }

  mqttClient.setServer(mqtt_broker, mqtt_port);
  mqttClient.setCallback(mqttCallback);

  randomSeed(analogRead(0));

  controlBuzzer(200);
  digitalWrite(ModeLed, prevMode ? HIGH : LOW);
}

// ================================================================
// 12. VONG LAP CHINH (LOOP)
// ================================================================
void loop() {
  // 1. Quet nut bam vat ly S2 (Mode) va S7 (Relay/Bom) truc tiep (100% khong
  // loi)
  handleButtons();

  // 2. Kiem tra an toan troi mua lien tuc (ngat bom tuc thi cho ca MANUAL va
  // AUTO)
  checkRainSafety();

  // 3. Duy tri ket noi Wi-Fi & MQTT Broker
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
  }

  // 4. Thu thap du lieu cam bien va day len topic telemetry moi 3 giay
  unsigned long now = millis();
  if (now - lastTelemetryMillis >= telemetryInterval) {
    lastTelemetryMillis = now;
    sendTelemetry();
  }

  // 5. Thuat toan tuoi tu dong thong minh
  controlMoist();
}