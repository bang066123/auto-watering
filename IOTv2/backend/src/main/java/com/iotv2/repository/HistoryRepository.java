package com.iotv2.repository;

import com.iotv2.model.History;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface HistoryRepository extends JpaRepository<History, Integer> {

    Optional<History> findByHistoryId(Integer historyId);

    @Query("SELECT h FROM History h ORDER BY h.id DESC LIMIT :limit")
    List<History> findRecent(@Param("limit") int limit);

    @Query("SELECT h FROM History h WHERE " +
           "(:deviceId IS NULL OR h.device.id = :deviceId) AND " +
           "(:status IS NULL OR h.status = :status) AND " +
           "(:action IS NULL OR h.action = :action) AND " +
           "(:from IS NULL OR h.time >= :from) AND " +
           "(:to IS NULL OR h.time <= :to) " +
           "ORDER BY h.id DESC")
    Page<History> filterHistory(
            @Param("deviceId") Integer deviceId,
            @Param("status") String status,
            @Param("action") String action,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            Pageable pageable);
}

