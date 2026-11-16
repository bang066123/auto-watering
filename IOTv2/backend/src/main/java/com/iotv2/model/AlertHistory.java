package com.iotv2.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "alert_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "alert_type", nullable = false, length = 50)
    private String alertType; // WARNING, DANGER, INFO, SUCCESS

    @Column(length = 100)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "time")
    private LocalDateTime time;

    @PrePersist
    protected void onCreate() {
        if (time == null) {
            time = LocalDateTime.now();
        }
    }
}

