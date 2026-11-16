package com.iotv2.repository;

import com.iotv2.model.DataSensor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DataSensorRepository extends JpaRepository<DataSensor, Integer> {

    @Query("SELECT d FROM DataSensor d WHERE d.sensor.id = :sensorId ORDER BY d.id DESC LIMIT 1")
    DataSensor findLatestBySensorId(@Param("sensorId") Integer sensorId);

    @Query("SELECT d FROM DataSensor d ORDER BY d.id DESC LIMIT :limit")
    List<DataSensor> findRecent(@Param("limit") int limit);

    @Query("SELECT d FROM DataSensor d WHERE " +
           "(:sensorType IS NULL OR d.sensor.sensorType = :sensorType) AND " +
           "(:from IS NULL OR d.time >= :from) AND " +
           "(:to IS NULL OR d.time <= :to) AND " +
           "(:minVal IS NULL OR d.value >= :minVal) AND " +
           "(:maxVal IS NULL OR d.value <= :maxVal) " +
           "ORDER BY d.id DESC")
    Page<DataSensor> filterData(
            @Param("sensorType") String sensorType,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            @Param("minVal") BigDecimal minVal,
            @Param("maxVal") BigDecimal maxVal,
            Pageable pageable);
}

