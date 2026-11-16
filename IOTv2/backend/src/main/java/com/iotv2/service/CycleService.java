package com.iotv2.service;

import com.iotv2.model.IrrigationCycle;
import com.iotv2.repository.IrrigationCycleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CycleService {

    private final IrrigationCycleRepository cycleRepository;
    private final WebSocketService webSocketService;
    private final AlertService alertService;

    public IrrigationCycle saveCycle(Integer cycleId, Double durationSeconds, Integer startMoisture,
                                     Integer endMoisture, Integer moistureGain, Integer lowThreshold,
                                     Integer highThreshold, String status) {
        IrrigationCycle cycle = IrrigationCycle.builder()
                .cycleId(cycleId)
                .durationSeconds(durationSeconds)
                .startMoisture(startMoisture)
                .endMoisture(endMoisture)
                .moistureGain(moistureGain)
                .lowThreshold(lowThreshold != null ? lowThreshold : 50)
                .highThreshold(highThreshold != null ? highThreshold : 75)
                .status(status != null ? status : "COMPLETED")
                .build();

        cycle = cycleRepository.save(cycle);
        log.info("[CYCLE COMPLETED] Cycle #{} Duration: {}s, Gain: +{}%", cycleId, durationSeconds, moistureGain);
        
        alertService.createAlert("SUCCESS", "Chu kỳ tưới hoàn tất",
                String.format("Chu kỳ #%d đã tưới thành công trong %.1f giây (+%d%% ẩm).",
                        cycleId, durationSeconds, moistureGain));

        webSocketService.sendMessage("/topic/cycles", cycle);
        return cycle;
    }

    public List<IrrigationCycle> getRecentCycles(int limit) {
        return cycleRepository.findRecent(limit);
    }
}

