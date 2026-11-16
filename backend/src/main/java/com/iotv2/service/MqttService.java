package com.iotv2.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class MqttService implements MqttCallbackExtended {

    @Value("${mqtt.broker:tcp://127.0.0.1:1883}")
    private String brokerUrl;

    @Value("${mqtt.username:HoangManhCuong}")
    private String username;

    @Value("${mqtt.password:B23DCCN108}")
    private String password;

    @Value("${mqtt.client-id:iotv2-spring-backend}")
    private String clientIdPrefix;

    @Value("${mqtt.topics.sensor-telemetry:bqa/sensor/telemetry}")
    private String sensorTopic;

    @Value("${mqtt.topics.device-control:bqa/device/control}")
    private String controlTopic;

    @Value("${mqtt.topics.device-ack:bqa/device/ack}")
    private String ackTopic;

    @Value("${mqtt.topics.rain-data:rain/data}")
    private String rainTopic;

    private MqttClient client;
    private final ObjectMapper objectMapper;
    private final SensorService sensorService;
    private final DeviceService deviceService;
    private final CycleService cycleService;
    private final AlertService alertService;
    private final WebSocketService webSocketService;

    private LocalDateTime lastTelemetryTime = null;
    private LocalDateTime lastRainTime = null;
    private String currentRain = "No Rain";
    private Integer currentRainVal = null;
    private int currentRainLevel = 0;

    public MqttService(ObjectMapper objectMapper,
                       @Lazy SensorService sensorService,
                       @Lazy DeviceService deviceService,
                       @Lazy CycleService cycleService,
                       @Lazy AlertService alertService,
                       @Lazy WebSocketService webSocketService) {
        this.objectMapper = objectMapper;
        this.sensorService = sensorService;
        this.deviceService = deviceService;
        this.cycleService = cycleService;
        this.alertService = alertService;
        this.webSocketService = webSocketService;
    }

    @PostConstruct
    public void init() {
        connect();
    }

    public synchronized void connect() {
        if (client != null && client.isConnected()) {
            return;
        }

        try {
            if (client != null && !client.isConnected()) {
                try { client.close(); } catch (Exception ignored) {}
                client = null;
            }

            String uniqueClientId = clientIdPrefix + "-" + UUID.randomUUID().toString().substring(0, 8);
            client = new MqttClient(brokerUrl, uniqueClientId, new MemoryPersistence());
            client.setCallback(this);

            MqttConnectOptions options = new MqttConnectOptions();
            options.setAutomaticReconnect(true);
            options.setCleanSession(true);
            options.setConnectionTimeout(5);
            options.setKeepAliveInterval(60);

            if (username != null && !username.isBlank()) {
                options.setUserName(username.trim());
            }
            if (password != null && !password.isBlank()) {
                options.setPassword(password.trim().toCharArray());
            }

            log.info("[MQTT Service] Connecting to broker: {}", brokerUrl);
            client.connect(options);
            log.info("[MQTT Service] Connected successfully as {}", uniqueClientId);
            subscribeTopics();
            broadcastStatus();
        } catch (MqttException e) {
            log.warn("[MQTT Service] Could not connect to broker at {}: {}. Scheduled retry will proceed.",
                    brokerUrl, e.getMessage());
            broadcastStatus();
        }
    }

    @Scheduled(fixedDelay = 5000, initialDelay = 5000)
    public void ensureConnected() {
        if (!isConnected()) {
            log.info("[MQTT Service] Disconnected. Reconnecting to broker: {}...", brokerUrl);
            connect();
        }
    }

    public boolean isConnected() {
        return client != null && client.isConnected();
    }

    public boolean isPumpControllerOnline() {
        return lastTelemetryTime != null &&
                Duration.between(lastTelemetryTime, LocalDateTime.now()).getSeconds() < 10;
    }

    public boolean isRainSensorOnline() {
        return lastRainTime != null &&
                Duration.between(lastRainTime, LocalDateTime.now()).getSeconds() < 10;
    }

    @Override
    public void connectComplete(boolean reconnect, String serverURI) {
        log.info("[MQTT Service] Connection complete (reconnect: {}) to {}", reconnect, serverURI);
        subscribeTopics();
        broadcastStatus();
    }

    private void subscribeTopics() {
        try {
            if (client != null && client.isConnected()) {
                client.subscribe(sensorTopic, 1);
                client.subscribe(ackTopic, 1);
                client.subscribe(controlTopic, 1);
                client.subscribe(rainTopic, 1);
                log.info("[MQTT Service] Subscribed to topics: [{}], [{}], [{}] and [{}]",
                        sensorTopic, ackTopic, controlTopic, rainTopic);
            }
        } catch (MqttException e) {
            log.error("[MQTT Service] Failed to subscribe to topics", e);
        }
    }

    public void publish(String topic, String message) {
        try {
            if (client != null && client.isConnected()) {
                MqttMessage mqttMessage = new MqttMessage(message.getBytes(StandardCharsets.UTF_8));
                mqttMessage.setQos(1);
                client.publish(topic, mqttMessage);
                log.info("[MQTT PUB] -> [{}]: {}", topic, message);
            } else {
                log.warn("[MQTT PUB] Client not connected. Cannot publish message to {}", topic);
            }
        } catch (MqttException e) {
            log.error("[MQTT PUB] Failed to publish message to topic: {}", topic, e);
        }
    }

    public void publishPumpControl(String action, Integer historyId) {
        try {
            Map<String, Object> map = new HashMap<>();
            map.put("action", action.toUpperCase());
            map.put("pump", action.toUpperCase());
            if (historyId != null) map.put("historyId", historyId);
            String payload = objectMapper.writeValueAsString(map);
            publish(controlTopic, payload);
        } catch (Exception e) {
            log.error("Error creating pump control message", e);
        }
    }

    public void publishPumpConfig(int lowThreshold, int highThreshold, int pwmSpeed) {
        try {
            Map<String, Object> map = new HashMap<>();
            map.put("action", "CONFIG");
            map.put("lowThreshold", lowThreshold);
            map.put("highThreshold", highThreshold);
            map.put("pwmSpeed", pwmSpeed);
            String payload = objectMapper.writeValueAsString(map);
            publish(controlTopic, payload);
            log.info(">> [MQTT CONFIG PUB] -> [{}]: {}", controlTopic, payload);
        } catch (Exception e) {
            log.error("Error creating pump config message", e);
        }
    }

    public void publishModeControl(String action, Integer historyId) {
        try {
            Map<String, Object> map = new HashMap<>();
            map.put("action", action.toUpperCase());
            map.put("mode", action.toUpperCase());
            if (historyId != null) map.put("historyId", historyId);
            String payload = objectMapper.writeValueAsString(map);
            publish(controlTopic, payload);
        } catch (Exception e) {
            log.error("Error creating mode control message", e);
        }
    }

    @Override
    public void connectionLost(Throwable cause) {
        log.warn("[MQTT Service] Connection lost: {}", cause != null ? cause.getMessage() : "Unknown");
        broadcastStatus();
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) {
        String payload = new String(message.getPayload(), StandardCharsets.UTF_8);

        try {
            if (topic.equals(sensorTopic)) {
                handleTelemetryPayload(payload);
            } else if (topic.equals(rainTopic)) {
                handleRainPayload(payload);
            } else if (topic.equals(ackTopic)) {
                handleAckPayload(payload);
            }
        } catch (Exception e) {
            log.error("[MQTT Service] Error processing message on topic {}: {}", topic, e.getMessage(), e);
        }
    }

    private void handleTelemetryPayload(String payload) {
        try {
            JsonNode node = objectMapper.readTree(payload);

            // 1. Cycle Start Marker: {"cycleId": 1}
            if (node.has("cycleId") && !node.has("temperature") && !node.has("duration_s")) {
                int cycleId = node.get("cycleId").asInt();
                log.info(">> [CYCLE START] ESP32 started cycle #{}", cycleId);
                alertService.createAlert("INFO", "Bắt đầu chu kỳ tưới",
                        "Độ ẩm đất thấp (<50%), ESP32 tự động bắt đầu chu kỳ tưới #" + cycleId);
                webSocketService.sendMessage("/topic/cycle-start", Map.of("cycleId", cycleId));
                return;
            }

            // 2. Cycle Summary: {"cycleId": 1, "duration_s": 25, "startMoisture": 45, "endMoisture": 76, ...}
            if (node.has("duration_s") && node.has("cycleId")) {
                int cycleId = node.get("cycleId").asInt();
                double duration_s = node.get("duration_s").asDouble();
                int startM = node.has("startMoisture") ? node.get("startMoisture").asInt() : 0;
                int endM = node.has("endMoisture") ? node.get("endMoisture").asInt() : 0;
                int gain = node.has("moistureGain") ? node.get("moistureGain").asInt() : (endM - startM);
                int lowTh = node.has("lowThreshold") ? node.get("lowThreshold").asInt() : 50;
                int highTh = node.has("highThreshold") ? node.get("highThreshold").asInt() : 75;

                cycleService.saveCycle(cycleId, duration_s, startM, endM, gain, lowTh, highTh, "COMPLETED");
                return;
            }

            // 3. Mode Sync: {"mode": "AUTO"}
            if (node.has("mode") && !node.has("temperature")) {
                String mode = node.get("mode").asText();
                deviceService.updateDeviceStateByType("MODE", "AUTO".equalsIgnoreCase(mode));
                webSocketService.sendMessage("/topic/mode-sync", Map.of("mode", mode));
                return;
            }

            // 4. Standard Telemetry
            Double temp = node.has("temperature") ? node.get("temperature").asDouble() : null;
            Double hum = node.has("humidity") ? node.get("humidity").asDouble() : null;
            Double soil = node.has("soilMoisture") ? node.get("soilMoisture").asDouble() : null;
            String mode = node.has("mode") ? node.get("mode").asText() : null;
            String pump = node.has("pump") ? node.get("pump").asText() : null;

            if (temp != null || soil != null) {
                this.lastTelemetryTime = LocalDateTime.now();
                sensorService.saveSensorReadings(temp, hum, soil, null);

                if (pump != null) {
                    deviceService.updateDeviceStateByType("PUMP", "ON".equalsIgnoreCase(pump));
                }
                if (mode != null) {
                    deviceService.updateDeviceStateByType("MODE", "AUTO".equalsIgnoreCase(mode));
                }

                Map<String, Object> map = new HashMap<>();
                map.put("temperature", temp);
                map.put("humidity", hum);
                map.put("soilMoisture", soil);
                map.put("mode", mode);
                map.put("pump", pump);
                map.put("rain", currentRain);
                map.put("rainVal", currentRainVal);
                map.put("rainLevel", currentRainLevel);
                map.put("pumpOnline", isPumpControllerOnline());
                map.put("rainOnline", isRainSensorOnline());

                webSocketService.sendMessage("/topic/telemetry", map);
                webSocketService.sendMessage("/topic/sensors", map);
            }
        } catch (Exception e) {
            log.error("Failed to parse telemetry: {}", payload, e);
        }
    }

    private void handleRainPayload(String payload) {
        try {
            JsonNode node = objectMapper.readTree(payload);
            if (node.has("rain")) {
                this.lastRainTime = LocalDateTime.now();
                String prevRain = currentRain;
                currentRain = node.get("rain").asText();
                currentRainVal = node.has("value") ? node.get("value").asInt() : null;

                if (currentRain.contains("Heavy")) currentRainLevel = 3;
                else if (currentRain.contains("Moderate")) currentRainLevel = 2;
                else if (currentRain.contains("Light")) currentRainLevel = 1;
                else if (currentRainVal != null) {
                    if (currentRainVal < 1000) currentRainLevel = 3;
                    else if (currentRainVal < 2000) currentRainLevel = 2;
                    else if (currentRainVal <= 3500) currentRainLevel = 1;
                    else currentRainLevel = 0;
                } else currentRainLevel = 0;

                // Tự động ngắt máy bơm khi phát hiện có mưa (bất kể AUTO hay MANUAL, bất kể DB state nào)
                if (currentRainLevel >= 1) {
                    boolean wasPumpActive = deviceService.getAllDevices().stream()
                            .filter(d -> "PUMP".equalsIgnoreCase(d.getType()))
                            .anyMatch(d -> Boolean.TRUE.equals(d.getIsActive()));

                    deviceService.updateDeviceStateByType("PUMP", false);
                    publishPumpControl("OFF", null);

                    if (wasPumpActive) {
                        log.info("[RAIN DETECTED] Rain level={}, turning OFF pump immediately!", currentRainLevel);
                        alertService.createAlert("WARNING", "Phát hiện trời mưa - Đã ngắt bơm",
                                "Cảm biến mưa phát hiện '" + currentRain + "' (ADC: " + currentRainVal + "). Hệ thống đã tự động ngắt máy bơm bảo vệ cây trồng!");
                    }
                } else if (currentRainLevel >= 2 && !prevRain.contains("Moderate") && !prevRain.contains("Heavy")) {
                    alertService.createAlert("WARNING", "Phát hiện mưa lớn",
                            "Cảm biến mưa phát hiện '" + currentRain + "' (ADC: " + currentRainVal + "). Hệ thống sẽ ưu tiên ngắt bơm!");
                }

                if (currentRainVal != null) {
                    sensorService.saveSensorReadings(null, null, null, currentRainVal.doubleValue());
                }

                Map<String, Object> map = new HashMap<>();
                map.put("rain", currentRain);
                map.put("value", currentRainVal);
                map.put("rainVal", currentRainVal);
                map.put("rainLevel", currentRainLevel);
                map.put("online", true);

                webSocketService.sendMessage("/topic/rain", map);
                webSocketService.sendMessage("/topic/sensors", map);
            }
        } catch (Exception e) {
            log.error("Failed to parse rain payload: {}", payload, e);
        }
    }

    private void handleAckPayload(String payload) {
        try {
            JsonNode node = objectMapper.readTree(payload);
            String device = node.has("device") ? node.get("device").asText() : "pump_controller";
            String pump = node.has("pump") ? node.get("pump").asText() : null;
            String mode = node.has("mode") ? node.get("mode").asText() : null;
            String status = node.has("status") ? node.get("status").asText() : "SUCCESS";
            Integer historyId = node.has("historyId") ? node.get("historyId").asInt() : null;

            log.info("[MQTT ACK RECV] Device: {}, Pump: {}, Mode: {}, Status: {}, HistoryId: {}",
                    device, pump, mode, status, historyId);

            deviceService.handleAck(device, pump, mode, status, historyId);
        } catch (Exception e) {
            log.error("Failed to parse ACK payload: {}", payload, e);
        }
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) {}

    public void broadcastStatus() {
        webSocketService.sendMessage("/topic/mqtt-status", getStatus());

        Map<String, Object> espStat = new HashMap<>();
        boolean mqttConnected = isConnected();
        boolean pumpOnline = isPumpControllerOnline();
        boolean rainOnline = isRainSensorOnline();
        espStat.put("online", mqttConnected);
        espStat.put("ping", mqttConnected ? (pumpOnline ? 12 : 25) : null);
        espStat.put("pumpOnline", pumpOnline);
        espStat.put("rainOnline", rainOnline);
        webSocketService.sendMessage("/topic/esp-status", espStat);
    }

    public Map<String, Object> getStatus() {
        Map<String, Object> map = new HashMap<>();
        map.put("connected", isConnected());
        map.put("broker", brokerUrl);
        map.put("pumpOnline", isPumpControllerOnline());
        map.put("rainOnline", isRainSensorOnline());
        map.put("lastTelemetryTime", lastTelemetryTime != null ? lastTelemetryTime.toString() : null);
        map.put("lastRainTime", lastRainTime != null ? lastRainTime.toString() : null);
        map.put("currentRain", currentRain);
        map.put("rainLevel", currentRainLevel);
        return map;
    }

    public int getCurrentRainLevel() {
        return currentRainLevel;
    }

    @PreDestroy
    public void destroy() {
        try {
            if (client != null && client.isConnected()) {
                client.disconnect();
                client.close();
            }
        } catch (MqttException ignored) {}
    }
}

