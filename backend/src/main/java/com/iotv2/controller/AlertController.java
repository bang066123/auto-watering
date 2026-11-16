package com.iotv2.controller;

import com.iotv2.model.AlertHistory;
import com.iotv2.service.AlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AlertController {

    private final AlertService alertService;

    @GetMapping
    public ResponseEntity<Page<AlertHistory>> getAlertsPage(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "8") int size,
            @RequestParam(name = "limit", required = false) Integer limit,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String keyword) {
        int pageSize = (limit != null && limit > 0) ? limit : size;
        return ResponseEntity.ok(alertService.getAlertsPage(page, pageSize, type, keyword));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<AlertHistory>> getRecentAlerts(
            @RequestParam(defaultValue = "8") int limit) {
        return ResponseEntity.ok(alertService.getRecentAlerts(limit));
    }
}

