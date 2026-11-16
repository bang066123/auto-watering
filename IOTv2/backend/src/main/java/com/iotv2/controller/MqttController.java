package com.iotv2.controller;

import com.iotv2.service.MqttService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/mqtt")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class MqttController {

    private final MqttService mqttService;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getMqttStatus() {
        return ResponseEntity.ok(mqttService.getStatus());
    }
}

