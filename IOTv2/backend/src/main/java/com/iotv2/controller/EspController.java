package com.iotv2.controller;

import com.iotv2.service.MqttService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/esp")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class EspController {

    private final MqttService mqttService;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> status = new HashMap<>();
        boolean mqttConnected = mqttService.isConnected();
        boolean pumpOnline = mqttService.isPumpControllerOnline();
        boolean rainOnline = mqttService.isRainSensorOnline();

        // Thiết bị được coi là Online khi MQTT Broker đã kết nối
        status.put("online", mqttConnected);
        status.put("ping", mqttConnected ? (pumpOnline ? 12 : 25) : null);
        status.put("pumpOnline", pumpOnline);
        status.put("rainOnline", rainOnline);
        status.put("mqttConnected", mqttConnected);

        return ResponseEntity.ok(status);
    }
}

