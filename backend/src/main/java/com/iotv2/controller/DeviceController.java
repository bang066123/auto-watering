package com.iotv2.controller;

import com.iotv2.dto.DeviceControlRequest;
import com.iotv2.model.Device;
import com.iotv2.model.History;
import com.iotv2.service.DeviceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DeviceController {

    private final DeviceService deviceService;

    @GetMapping
    public ResponseEntity<List<Device>> getAllDevices() {
        return ResponseEntity.ok(deviceService.getAllDevices());
    }

    @GetMapping("/status")
    public ResponseEntity<List<Map<String, Object>>> getDevicesStatus() {
        List<Device> devices = deviceService.getAllDevices();
        List<Map<String, Object>> statusList = devices.stream().map(d -> Map.of(
                "id", (Object) d.getId(),
                "name", (Object) d.getName(),
                "type", (Object) d.getType(),
                "isActive", (Object) (d.getIsActive() != null ? d.getIsActive() : false),
                "status", (Object) ((d.getIsActive() != null && d.getIsActive()) ? "ON" : "OFF")
        )).toList();
        return ResponseEntity.ok(statusList);
    }

    @PostMapping("/{id}/control")
    public ResponseEntity<History> controlDevice(@PathVariable Integer id,
                                                 @RequestBody DeviceControlRequest request) {
        String action = request.getAction() != null ? request.getAction() : "ON";
        History history = deviceService.controlDevice(id, action);
        return ResponseEntity.ok(history);
    }

    @GetMapping("/pump/config")
    public ResponseEntity<Map<String, Object>> getPumpConfig() {
        return ResponseEntity.ok(deviceService.getPumpConfig());
    }

    @PostMapping("/pump/config")
    public ResponseEntity<Map<String, Object>> updatePumpConfig(@RequestBody Map<String, Object> config) {
        return ResponseEntity.ok(deviceService.updatePumpConfig(config));
    }
}

