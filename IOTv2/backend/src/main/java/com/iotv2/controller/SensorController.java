package com.iotv2.controller;

import com.iotv2.model.DataSensor;
import com.iotv2.model.Sensor;
import com.iotv2.service.SensorService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SensorController {

    private final SensorService sensorService;

    @GetMapping("/sensors")
    public ResponseEntity<List<Sensor>> getAllSensors() {
        return ResponseEntity.ok(sensorService.getAllSensors());
    }

    @GetMapping("/sensors/latest")
    public ResponseEntity<Map<String, Object>> getLatestSensorData() {
        return ResponseEntity.ok(sensorService.getLatestReadings());
    }

    @GetMapping({"/sensors/chart", "/sensors/recent"})
    public ResponseEntity<List<Map<String, Object>>> getChartData(
            @RequestParam(defaultValue = "60") int limit) {
        return ResponseEntity.ok(sensorService.getRecentForChart(limit));
    }

    @GetMapping("/datasensor")
    public ResponseEntity<Page<DataSensor>> getDataSensors(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) BigDecimal minValue,
            @RequestParam(required = false) BigDecimal maxValue,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<DataSensor> result = sensorService.filterData(type, from, to, minValue, maxValue, pageable);
        return ResponseEntity.ok(result);
    }
}

