package com.iotv2.repository;

import com.iotv2.model.IrrigationCycle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IrrigationCycleRepository extends JpaRepository<IrrigationCycle, Integer> {

    @Query("SELECT c FROM IrrigationCycle c ORDER BY c.id DESC LIMIT :limit")
    List<IrrigationCycle> findRecent(@Param("limit") int limit);
}

