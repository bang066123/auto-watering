package com.iotv2.repository;

import com.iotv2.model.AlertHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlertHistoryRepository extends JpaRepository<AlertHistory, Integer> {

    Page<AlertHistory> findAllByOrderByIdDesc(Pageable pageable);

    Page<AlertHistory> findByAlertTypeOrderByIdDesc(String alertType, Pageable pageable);

    @Query("SELECT a FROM AlertHistory a WHERE " +
           "(:alertType IS NULL OR :alertType = '' OR a.alertType = :alertType) AND " +
           "(:keyword IS NULL OR :keyword = '' OR LOWER(a.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(a.message) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "ORDER BY a.id DESC")
    Page<AlertHistory> searchAlerts(@Param("alertType") String alertType, @Param("keyword") String keyword, Pageable pageable);

    @Query(value = "SELECT * FROM alert_history ORDER BY id DESC LIMIT :limit", nativeQuery = true)
    List<AlertHistory> findRecent(@Param("limit") int limit);
}


