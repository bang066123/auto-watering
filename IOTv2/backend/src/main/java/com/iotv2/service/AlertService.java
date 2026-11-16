package com.iotv2.service;

import com.iotv2.model.AlertHistory;
import com.iotv2.repository.AlertHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AlertService {

    private final AlertHistoryRepository alertHistoryRepository;
    private final WebSocketService webSocketService;

    public AlertHistory createAlert(String type, String title, String message) {
        AlertHistory alert = AlertHistory.builder()
                .alertType(type)
                .title(title)
                .message(message)
                .time(LocalDateTime.now())
                .build();
        alert = alertHistoryRepository.save(alert);
        log.info("[ALERT] [{} - {}]: {}", type, title, message);
        webSocketService.sendMessage("/topic/alerts", alert);
        return alert;
    }

    public Page<AlertHistory> getAlertsPage(int page, int size, String type, String keyword) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size), Sort.by(Sort.Direction.DESC, "id"));
        if ((type != null && !type.trim().isEmpty()) || (keyword != null && !keyword.trim().isEmpty())) {
            return alertHistoryRepository.searchAlerts(type, keyword, pageable);
        }
        return alertHistoryRepository.findAllByOrderByIdDesc(pageable);
    }

    public List<AlertHistory> getRecentAlerts(int limit) {
        return alertHistoryRepository.findRecent(limit);
    }
}


