package com.inalgo.trade.repository;

import com.inalgo.trade.entity.UpstoxMigrationStateEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UpstoxMigrationStateRepository extends JpaRepository<UpstoxMigrationStateEntity, Long> {
    Optional<UpstoxMigrationStateEntity> findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeInterval(
            String tenantId,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval
    );

    List<UpstoxMigrationStateEntity> findAllByTenantIdOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(
            String tenantId
    );

    List<UpstoxMigrationStateEntity> findAllByTenantIdAndTimeframeUnitOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(
            String tenantId,
            String timeframeUnit
    );

    List<UpstoxMigrationStateEntity> findAllByTenantIdAndTimeframeIntervalOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(
            String tenantId,
            Integer timeframeInterval
    );

    List<UpstoxMigrationStateEntity> findAllByTenantIdAndTimeframeUnitAndTimeframeIntervalOrderByInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(
            String tenantId,
            String timeframeUnit,
            Integer timeframeInterval
    );
}
