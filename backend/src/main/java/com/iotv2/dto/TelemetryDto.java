package com.iotv2.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TelemetryDto {
    private Double temperature;
    private Double humidity;
    private Double soilMoisture;
    private String mode;
    private String pump;
    private String rain;
    private Integer rainVal;
    private Integer rainLevel;

    // Cycle fields
    private Integer cycleId;
    private Double duration_s;
    private Integer startMoisture;
    private Integer endMoisture;
    private Integer moistureGain;
    private Integer lowThreshold;
    private Integer highThreshold;
}

