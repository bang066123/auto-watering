package com.iotv2.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class SimulatorService {

    private final MqttService mqttService;
    private final ObjectMapper objectMapper;
    private final Random random = new Random();

    @Getter
    private boolean running = false;

    private double temperature = 29.0;
    private double humidity = 70.0;
    private double soilMoisture = 55.0;
    private String rainText = "No Rain";
    private int rainVal = 3850;

    public void setRunning(boolean running) {
        this.running = running;
        log.info("[SIMULATOR] Hardware Simulator status: {}", running ? "RUNNING" : "STOPPED");
    }

    public void setSoilMoisture(double val) {
        this.soilMoisture = Math.max(0, Math.min(100, val));
        sendSimulatedTelemetry();
    }

    public void setRainCondition(String cond) {
        if ("HEAVY_RAIN".equalsIgnoreCase(cond)) {
            rainText = "Heavy Rain";
            rainVal = 650;
        } else if ("MODERATE_RAIN".equalsIgnoreCase(cond)) {
            rainText = "Moderate Rain";
            rainVal = 1600;
        } else if ("LIGHT_RAIN".equalsIgnoreCase(cond)) {
            rainText = "Light Rain";
            rainVal = 2600;
        } else {
            rainText = "No Rain";
            rainVal = 3850;
        }
        sendSimulatedRain();
    }

    @Scheduled(fixedRate = 3000)
    public void simulationLoop() {
        if (!running || !mqttService.isConnected()) return;

        // Slight realistic fluctuations
        temperature = 28.0 + random.nextInt(5);
        humidity = 65.0 + random.nextInt(10);
        soilMoisture = 52.0 + random.nextInt(8);

        sendSimulatedTelemetry();
        sendSimulatedRain();
    }

    private void sendSimulatedTelemetry() {
        try {
            Map<String, Object> map = new HashMap<>();
            map.put("temperature", (int) temperature);
            map.put("humidity", (int) humidity);
            map.put("soilMoisture", (int) soilMoisture);
            map.put("mode", "AUTO");
            map.put("pump", "OFF");
            map.put("rain", rainText);

            String json = objectMapper.writeValueAsString(map);
            mqttService.publish("nhom11/sensor/telemetry", json);
        } catch (Exception e) {
            log.error("Failed to send simulated telemetry", e);
        }
    }

    private void sendSimulatedRain() {
        try {
            Map<String, Object> map = new HashMap<>();
            map.put("rain", rainText);
            map.put("value", rainVal);

            String json = objectMapper.writeValueAsString(map);
            mqttService.publish("rain/data", json);
        } catch (Exception e) {
            log.error("Failed to send simulated rain", e);
        }
    }
}

