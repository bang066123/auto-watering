package com.iotv2.controller;

import com.iotv2.model.IrrigationCycle;
import com.iotv2.service.CycleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cycles")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CycleController {

    private final CycleService cycleService;

    @GetMapping
    public ResponseEntity<List<IrrigationCycle>> getCycles(
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(cycleService.getRecentCycles(limit));
    }
}

