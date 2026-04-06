package com.inalgo.trade.repository;

import com.inalgo.trade.entity.AdminMigrationJobEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AdminMigrationJobRepository extends JpaRepository<AdminMigrationJobEntity, Long> {
    Optional<AdminMigrationJobEntity> findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval
    );

    Optional<AdminMigrationJobEntity> findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndJobType(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String jobType
    );

    List<AdminMigrationJobEntity> findAllByTenantIdOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAscJobTypeAsc(String tenantId);
}
