package com.iotv2.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeviceControlRequest {
    private String action; // ON, OFF, AUTO, MANUAL
    private Integer deviceId;
}

