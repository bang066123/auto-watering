package com.iotv2.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "sensors")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Sensor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "sensor_type", nullable = false, length = 50)
    private String sensorType; // temperature, humidity, soil_moisture, rain

    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;
}

