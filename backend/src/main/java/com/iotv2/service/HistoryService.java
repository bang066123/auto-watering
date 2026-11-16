package com.iotv2.service;

import com.iotv2.model.History;
import com.iotv2.repository.HistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class HistoryService {

    private final HistoryRepository historyRepository;

    public Page<History> getHistory(Integer deviceId, String status, String action,
                                   LocalDateTime from, LocalDateTime to, Pageable pageable) {
        return historyRepository.filterHistory(deviceId, status, action, from, to, pageable);
    }

    public List<History> getRecentHistory(int limit) {
        return historyRepository.findRecent(limit);
    }
}

