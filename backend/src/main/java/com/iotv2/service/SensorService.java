package com.iotv2.service;

import com.iotv2.model.DataSensor;
import com.iotv2.model.Sensor;
import com.iotv2.repository.DataSensorRepository;
import com.iotv2.repository.SensorRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class SensorService {

    private final SensorRepository sensorRepository;
    private final DataSensorRepository dataSensorRepository;

    @PostConstruct
    public void initSensors() {
        createSensorIfMissing("Nhiệt độ (DHT11)", "temperature");
        createSensorIfMissing("Độ ẩm không khí (DHT11)", "humidity");
        createSensorIfMissing("Độ ẩm đất (Soil Pin 34)", "soil_moisture");
        createSensorIfMissing("Cảm biến mưa (Rain Pin 34)", "rain");
    }

    private void createSensorIfMissing(String name, String type) {
        if (sensorRepository.findBySensorType(type).isEmpty()) {
            Sensor s = Sensor.builder().name(name).sensorType(type).isActive(true).build();
            sensorRepository.save(s);
            log.info("Initialized sensor: {} ({})", name, type);
        }
    }

    public List<Sensor> getAllSensors() {
        return sensorRepository.findAll();
    }

    public void saveSensorReadings(Double temp, Double hum, Double soilMoisture, Double rainVal) {
        if (temp != null) saveValue("temperature", temp);
        if (hum != null) saveValue("humidity", hum);
        if (soilMoisture != null) saveValue("soil_moisture", soilMoisture);
        if (rainVal != null) saveValue("rain", rainVal);
    }

    private void saveValue(String type, Double val) {
        sensorRepository.findBySensorType(type).ifPresent(s -> {
            DataSensor ds = DataSensor.builder()
                    .sensor(s)
                    .value(BigDecimal.valueOf(val))
                    .build();
            dataSensorRepository.save(ds);
        });
    }

    public Map<String, Object> getLatestReadings() {
        Map<String, Object> map = new HashMap<>();
        List<Sensor> sensors = sensorRepository.findAll();
        for (Sensor s : sensors) {
            DataSensor latest = dataSensorRepository.findLatestBySensorId(s.getId());
            map.put(s.getSensorType(), latest != null ? latest.getValue() : null);
        }
        return map;
    }

    public List<Map<String, Object>> getRecentForChart(int limit) {
        List<DataSensor> recent = dataSensorRepository.findRecent(limit);
        List<Map<String, Object>> list = new ArrayList<>();
        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("HH:mm:ss");

        for (DataSensor ds : recent) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", ds.getId());
            item.put("sensorType", ds.getSensor().getSensorType());
            item.put("value", ds.getValue());
            item.put("time", ds.getTime() != null ? ds.getTime().format(dtf) : null);
            list.add(item);
        }
        Collections.reverse(list);
        return list;
    }

    public Page<DataSensor> filterData(String sensorType, LocalDateTime from, LocalDateTime to,
                                       BigDecimal minVal, BigDecimal maxVal, Pageable pageable) {
        return dataSensorRepository.filterData(sensorType, from, to, minVal, maxVal, pageable);
    }
}

