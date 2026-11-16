package com.iotv2.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "irrigation_cycles")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IrrigationCycle {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "cycle_id")
    private Integer cycleId;

    @Column(name = "duration_s")
    private Double durationSeconds;

    @Column(name = "start_moisture")
    private Integer startMoisture;

    @Column(name = "end_moisture")
    private Integer endMoisture;

    @Column(name = "moisture_gain")
    private Integer moistureGain;

    @Column(name = "low_threshold")
    private Integer lowThreshold;

    @Column(name = "high_threshold")
    private Integer highThreshold;

    @Column(length = 20)
    private String status; // COMPLETED, RUNNING, INTERRUPTED_RAIN

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}

