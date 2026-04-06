package com.inalgo.trade.repository;

import com.inalgo.trade.entity.OptionChainMigrationStateEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface OptionChainMigrationStateRepository extends JpaRepository<OptionChainMigrationStateEntity, Long> {
    Optional<OptionChainMigrationStateEntity> findByTenantIdAndUnderlyingKeyAndExpiryDate(
            String tenantId,
            String underlyingKey,
            LocalDate expiryDate
    );

    List<OptionChainMigrationStateEntity> findAllByTenantIdAndUnderlyingKeyOrderByExpiryDateAsc(
            String tenantId,
            String underlyingKey
    );
}
