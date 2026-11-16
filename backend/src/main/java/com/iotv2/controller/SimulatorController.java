package com.iotv2.controller;

import com.iotv2.service.SimulatorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/simulator")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SimulatorController {

    private final SimulatorService simulatorService;

    @PostMapping("/toggle")
    public ResponseEntity<Map<String, Object>> toggleSimulator(@RequestBody(required = false) Map<String, Boolean> body) {
        boolean target = body != null && body.containsKey("enable") ? body.get("enable") : !simulatorService.isRunning();
        simulatorService.setRunning(target);
        return ResponseEntity.ok(Map.of("isRunning", target));
    }

    @PostMapping("/set-moisture")
    public ResponseEntity<Map<String, Object>> setMoisture(@RequestBody Map<String, Double> body) {
        if (body.containsKey("value")) {
            simulatorService.setSoilMoisture(body.get("value"));
            return ResponseEntity.ok(Map.of("success", true, "value", body.get("value")));
        }
        return ResponseEntity.badRequest().build();
    }

    @PostMapping("/set-rain")
    public ResponseEntity<Map<String, Object>> setRain(@RequestBody Map<String, String> body) {
        if (body.containsKey("condition")) {
            simulatorService.setRainCondition(body.get("condition"));
            return ResponseEntity.ok(Map.of("success", true, "condition", body.get("condition")));
        }
        return ResponseEntity.badRequest().build();
    }
}

