package com.iotv2.controller;

import com.iotv2.dto.DeviceControlRequest;
import com.iotv2.model.Device;
import com.iotv2.repository.AlertHistoryRepository;
import com.iotv2.repository.DeviceRepository;
import com.iotv2.service.DeviceService;
import com.iotv2.service.MqttService;
import com.iotv2.service.SensorService;
import com.iotv2.service.SimulatorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SystemController {

    private final MqttService mqttService;
    private final DeviceService deviceService;
    private final SensorService sensorService;
    private final SimulatorService simulatorService;
    private final DeviceRepository deviceRepository;
    private final AlertHistoryRepository alertHistoryRepository;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getSystemStatus() {
        Map<String, Object> resp = new HashMap<>();

        Map<String, Object> state = new HashMap<>();
        Map<String, Object> latest = sensorService.getLatestReadings();
        state.put("temperature", latest.get("temperature"));
        state.put("humidity", latest.get("humidity"));
        state.put("soilMoisture", latest.get("soil_moisture"));

        List<Device> devices = deviceService.getAllDevices();
        boolean pumpOn = devices.stream().anyMatch(d -> "PUMP".equalsIgnoreCase(d.getType()) && Boolean.TRUE.equals(d.getIsActive()));
        boolean isAuto = devices.stream().anyMatch(d -> "MODE".equalsIgnoreCase(d.getType()) && Boolean.TRUE.equals(d.getIsActive()));

        state.put("pump", pumpOn ? "ON" : "OFF");
        state.put("mode", isAuto ? "AUTO" : "MANUAL");

        Map<String, Object> mqttStat = mqttService.getStatus();
        state.put("rain", mqttStat.get("currentRain"));
        state.put("rainLevel", mqttStat.get("rainLevel"));
        state.put("pumpControllerOnline", mqttService.isPumpControllerOnline());
        state.put("rainSensorOnline", mqttService.isRainSensorOnline());
        state.put("brokerStatus", mqttService.isConnected() ? "CONNECTED" : "DISCONNECTED");

        resp.put("state", state);
        resp.put("simulatorRunning", simulatorService.isRunning());
        resp.put("serverPort", 8080);
        resp.put("mqttPort", 1883);

        List<Map<String, String>> ips = getLocalIpAddresses();
        resp.put("localIps", ips);
        resp.put("recommendedIp", ips.stream()
                .filter(i -> !i.get("interface").toLowerCase().contains("vmware") && !i.get("interface").toLowerCase().contains("virtual"))
                .map(i -> i.get("address"))
                .findFirst().orElse("127.0.0.1"));

        return ResponseEntity.ok(resp);
    }

    @PostMapping("/control")
    public ResponseEntity<Map<String, Object>> handleControl(@RequestBody Map<String, String> body) {
        String type = body.get("type"); // PUMP or MODE
        String action = body.get("action"); // ON, OFF, AUTO, MANUAL

        Integer targetDeviceId = 1; // Default PUMP
        if ("MODE".equalsIgnoreCase(type) || "AUTO".equalsIgnoreCase(action) || "MANUAL".equalsIgnoreCase(action)) {
            targetDeviceId = deviceRepository.findAll().stream()
                    .filter(d -> "MODE".equalsIgnoreCase(d.getType()))
                    .map(Device::getId)
                    .findFirst().orElse(2);
        } else {
            targetDeviceId = deviceRepository.findAll().stream()
                    .filter(d -> "PUMP".equalsIgnoreCase(d.getType()))
                    .map(Device::getId)
                    .findFirst().orElse(1);
        }

        var history = deviceService.controlDevice(targetDeviceId, action);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "historyId", history.getHistoryId(),
                "message", "Đã gửi lệnh " + action + " tới phần cứng"
        ));
    }

    @GetMapping("/telemetry/history")
    public ResponseEntity<List<Map<String, Object>>> getTelemetryHistory(
            @RequestParam(defaultValue = "60") int limit) {
        return ResponseEntity.ok(sensorService.getRecentForChart(limit));
    }

    @PostMapping("/alerts/clear")
    public ResponseEntity<Map<String, Boolean>> clearAlerts() {
        alertHistoryRepository.deleteAll();
        return ResponseEntity.ok(Map.of("success", true));
    }

    private List<Map<String, String>> getLocalIpAddresses() {
        List<Map<String, String>> list = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface nif = interfaces.nextElement();
                if (nif.isLoopback() || !nif.isUp()) continue;
                Enumeration<InetAddress> addresses = nif.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    if (addr.getHostAddress().contains(".") && !addr.isLoopbackAddress()) {
                        list.add(Map.of(
                                "interface", nif.getDisplayName(),
                                "address", addr.getHostAddress()
                        ));
                    }
                }
            }
        } catch (Exception ignored) {}
        return list;
    }
}

