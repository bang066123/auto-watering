package com.iotv2.service;

import com.iotv2.model.Device;
import com.iotv2.model.History;
import com.iotv2.repository.DeviceRepository;
import com.iotv2.repository.HistoryRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceService {

    private final DeviceRepository deviceRepository;
    private final HistoryRepository historyRepository;
    private final com.iotv2.repository.UserRepository userRepository;
    private final WebSocketService webSocketService;
    @Lazy
    private final MqttService mqttService;
    @Lazy
    private final AlertService alertService;

    private final AtomicInteger historyIdCounter = new AtomicInteger(1000);

    // Cấu hình tham số vận hành máy bơm (Đồng bộ với ESP32 qua MQTT)
    private volatile int lowThreshold = 50;
    private volatile int highThreshold = 75;
    private volatile int pwmSpeed = 220;
    private final String gpioPin = "Pin 25 (PWM Output)";

    public Map<String, Object> getPumpConfig() {
        Device pump = deviceRepository.findAll().stream()
                .filter(d -> "PUMP".equalsIgnoreCase(d.getType()))
                .findFirst().orElse(null);
        String name = pump != null ? pump.getName() : "Máy bơm nước (PWM Pin 25)";

        Map<String, Object> resp = new HashMap<>();
        resp.put("deviceName", name);
        resp.put("gpioPin", gpioPin);
        resp.put("lowThreshold", lowThreshold);
        resp.put("highThreshold", highThreshold);
        resp.put("pwmSpeed", pwmSpeed);
        return resp;
    }

    public Map<String, Object> updatePumpConfig(Map<String, Object> config) {
        if (config.containsKey("lowThreshold")) {
            this.lowThreshold = ((Number) config.get("lowThreshold")).intValue();
        }
        if (config.containsKey("highThreshold")) {
            this.highThreshold = ((Number) config.get("highThreshold")).intValue();
        }
        if (config.containsKey("pwmSpeed")) {
            this.pwmSpeed = ((Number) config.get("pwmSpeed")).intValue();
        }
        if (config.containsKey("deviceName")) {
            String newName = (String) config.get("deviceName");
            deviceRepository.findAll().stream()
                    .filter(d -> "PUMP".equalsIgnoreCase(d.getType()))
                    .findFirst().ifPresent(p -> {
                        p.setName(newName);
                        deviceRepository.save(p);
                    });
        }

        // Bắn lệnh MQTT xuống ESP32 để áp dụng tức thì
        mqttService.publishPumpConfig(this.lowThreshold, this.highThreshold, this.pwmSpeed);

        log.info(">> [CẤU HÌNH THIẾT BỊ] Cập nhật thành công: Ngưỡng bật={}%, Ngưỡng tắt={}%, PWM={}/255",
                this.lowThreshold, this.highThreshold, this.pwmSpeed);

        Map<String, Object> result = getPumpConfig();
        result.put("success", true);
        result.put("message", "Đã lưu và gửi lệnh cấu hình xuống ESP32 thành công");
        return result;
    }

    @PostConstruct
    public void initDevices() {
        initDefaultUser();
        createDeviceIfMissing("Máy bơm nước (PWM Pin 25)", "PUMP", false);
        createDeviceIfMissing("Chế độ vận hành (Mode Pin 15)", "MODE", true); // Default AUTO
    }

    private void initDefaultUser() {
        // Tự động đồng bộ và chuẩn hóa thông tin người dùng quản trị viên
        List<com.iotv2.model.User> existingUsers = userRepository.findAll();
        for (com.iotv2.model.User u : existingUsers) {
            u.setName("Nguyễn Thanh Bằng");
            u.setStudentId("B23DCCN066");
            u.setClassName("");
            u.setEmail("thanhbang@ptit.edu.vn");
            userRepository.save(u);
            log.info(">> [DATABASE USER SYNC] Dong bo nguoi dung: id={}, name={}", u.getId(), u.getName());
        }

        if (userRepository.count() == 0) {
            com.iotv2.model.User defaultUser = com.iotv2.model.User.builder()
                    .name("Nguyễn Thanh Bằng")
                    .studentId("B23DCCN066")
                    .className("")
                    .email("thanhbang@ptit.edu.vn")
                    .password("$2b$12$MF.sl6EZL6SNtvkfsIBWUeIfJHmSo11fYRgaJ6oxylLHi7bPywDCG")
                    .build();
            userRepository.save(defaultUser);
            log.info("Initialized default user: Nguyen Thanh Bang");
        }
    }

    private void createDeviceIfMissing(String name, String type, boolean active) {
        if (deviceRepository.findByName(name).isEmpty()) {
            Device d = Device.builder().name(name).type(type).isActive(active).build();
            deviceRepository.save(d);
            log.info("Initialized device: {} ({})", name, type);
        }
    }

    public List<Device> getAllDevices() {
        return deviceRepository.findAll();
    }

    public Device getDeviceById(Integer id) {
        return deviceRepository.findById(id).orElseThrow(() -> new RuntimeException("Device not found: " + id));
    }

    /**
     * Send command to control pump or mode:
     * - Saves History with status PENDING and unique historyId
     * - Publishes command to MQTT topic nhom11/device/control
     */
    public History controlDevice(Integer deviceId, String action) {
        Device device = getDeviceById(deviceId);
        int historyId = historyIdCounter.incrementAndGet();

        com.iotv2.model.User user = userRepository.findAll().stream().findFirst().orElseGet(() -> {
            com.iotv2.model.User defaultUser = com.iotv2.model.User.builder()
                    .name("Nguyễn Thanh Bằng")
                    .studentId("B23DCCN066")
                    .className("")
                    .email("thanhbang@ptit.edu.vn")
                    .password("$2b$12$MF.sl6EZL6SNtvkfsIBWUeIfJHmSo11fYRgaJ6oxylLHi7bPywDCG")
                    .build();
            return userRepository.save(defaultUser);
        });

        History history = History.builder()
                .user(user)
                .device(device)
                .action(action.toUpperCase())
                .status("PENDING")
                .historyId(historyId)
                .time(LocalDateTime.now())
                .build();
        history = historyRepository.save(history);

        log.info("[DEVICE CONTROL] Issued command: device='{}', action='{}', historyId={}",
                device.getName(), action, historyId);

        // Send via MQTT
        if ("PUMP".equalsIgnoreCase(device.getType())) {
            if ("ON".equalsIgnoreCase(action) && mqttService.getCurrentRainLevel() >= 1) {
                log.warn("[PUMP BLOCKED] Cannot turn ON pump while it is raining!");
                throw new RuntimeException("Trời đang mưa! Hệ thống tự động khóa không cho bật máy bơm.");
            }
            mqttService.publishPumpControl(action, historyId);
        } else if ("MODE".equalsIgnoreCase(device.getType())) {
            mqttService.publishModeControl(action, historyId);
            // Khi chuyển từ AUTO sang MANUAL: máy bơm bắt buộc về trạng thái TẮT
            if ("MANUAL".equalsIgnoreCase(action)) {
                updateDeviceStateByType("PUMP", false);
                mqttService.publishPumpControl("OFF", null);
            }
        }

        Map<String, Object> wsDevice = new HashMap<>();
        wsDevice.put("deviceId", device.getId());
        wsDevice.put("action", action.toUpperCase());
        wsDevice.put("status", "PENDING");
        webSocketService.sendMessage("/topic/devices", wsDevice);

        webSocketService.sendMessage("/topic/history-update", history);
        webSocketService.sendMessage("/topic/history", history);
        return history;
    }

    /**
     * Handle ACK received from ESP32 via nhom11/device/ack
     */
    public void handleAck(String deviceType, String pumpState, String modeState, String status, Integer historyId) {
        if (historyId != null) {
            Optional<History> historyOpt = historyRepository.findByHistoryId(historyId);
            if (historyOpt.isPresent()) {
                History h = historyOpt.get();
                h.setStatus("SUCCESS".equalsIgnoreCase(status) ? "SUCCESS" : "FAILED");
                historyRepository.save(h);
                log.info("[ACK APPLIED] History #{} updated to {}", historyId, h.getStatus());
                webSocketService.sendMessage("/topic/history-update", h);
                webSocketService.sendMessage("/topic/history", h);
            }
        }

        // Update in-memory and database states
        if (pumpState != null) {
            updateDeviceStateByType("PUMP", "ON".equalsIgnoreCase(pumpState), true);
        }
        if (modeState != null) {
            updateDeviceStateByType("MODE", "AUTO".equalsIgnoreCase(modeState), true);
        }

        webSocketService.sendMessage("/topic/device-ack", getAllDevices());
    }

    public boolean updateDeviceStateByType(String type, boolean isActive) {
        return updateDeviceStateByType(type, isActive, false);
    }

    public synchronized boolean updateDeviceStateByType(String type, boolean isActive, boolean isFromCommandAck) {
        List<Device> devices = deviceRepository.findAll();
        boolean anyChanged = false;
        for (Device d : devices) {
            if (type.equalsIgnoreCase(d.getType())) {
                boolean stateChanged = (d.getIsActive() == null || d.getIsActive() != isActive);
                if (stateChanged || isFromCommandAck) {
                    d.setIsActive(isActive);
                    deviceRepository.save(d);
                    anyChanged = true;

                    String action = isActive
                            ? ("PUMP".equalsIgnoreCase(type) ? "ON" : "AUTO")
                            : ("PUMP".equalsIgnoreCase(type) ? "OFF" : "MANUAL");

                    Map<String, Object> ws = new HashMap<>();
                    ws.put("deviceId", d.getId());
                    ws.put("id", d.getId());
                    ws.put("type", d.getType());
                    ws.put("action", action);
                    ws.put("status", "SUCCESS");
                    ws.put("isActive", isActive);
                    webSocketService.sendMessage("/topic/devices", ws);

                    // Khi người dùng bấm nút vật lý trên mạch ESP32 hoặc thuật toán tự động kích
                    // hoạt
                    // (không phải phản hồi ACK của lệnh Web), ghi nhận ngay một bản ghi vào History
                    if (stateChanged && !isFromCommandAck) {
                        try {
                            com.iotv2.model.User user = userRepository.findAll().stream().findFirst().orElse(null);
                            int histId = historyIdCounter.incrementAndGet();
                            History history = History.builder()
                                    .user(user)
                                    .device(d)
                                    .action(action)
                                    .status("SUCCESS")
                                    .historyId(histId)
                                    .time(LocalDateTime.now())
                                    .build();
                            history = historyRepository.save(history);
                            webSocketService.sendMessage("/topic/history-update", history);
                            webSocketService.sendMessage("/topic/history", history);
                            log.info("[STATE SYNC] Ghi nhận lịch sử thao tác phần cứng/tự động: Thiết bị={}, Lệnh={}",
                                    d.getName(), action);

                            if (alertService != null) {
                                String alertType = isActive ? "SUCCESS" : "INFO";
                                String alertTitle = "PUMP".equalsIgnoreCase(type) ? "Trạng thái máy bơm"
                                        : "Chế độ vận hành";
                                String alertMsg = d.getName() + " đã chuyển sang trạng thái: " + action;
                                alertService.createAlert(alertType, alertTitle, alertMsg);
                            }
                        } catch (Exception ex) {
                            log.warn("Không thể lưu lịch sử đồng bộ trạng thái: {}", ex.getMessage());
                        }
                    }
                }
            }
        }
        return anyChanged;
    }
}
