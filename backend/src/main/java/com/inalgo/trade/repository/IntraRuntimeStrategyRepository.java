package com.inalgo.trade.repository;

import com.inalgo.trade.entity.IntraRuntimeStrategyEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface IntraRuntimeStrategyRepository extends JpaRepository<IntraRuntimeStrategyEntity, Long> {
    Optional<IntraRuntimeStrategyEntity> findByTenantIdAndExecutionId(String tenantId, Long executionId);

    Page<IntraRuntimeStrategyEntity> findByTenantIdAndUsernameAndModeAndStatusOrderByUpdatedAtDesc(
            String tenantId,
            String username,
            String mode,
            String status,
            Pageable pageable
    );

    Page<IntraRuntimeStrategyEntity> findByTenantIdAndUsernameAndModeOrderByUpdatedAtDesc(
            String tenantId,
            String username,
            String mode,
            Pageable pageable
    );

    Page<IntraRuntimeStrategyEntity> findByTenantIdAndUsernameOrderByUpdatedAtDesc(
            String tenantId,
            String username,
            Pageable pageable
    );

    List<IntraRuntimeStrategyEntity> findAllByTenantIdAndUsername(String tenantId, String username);

    boolean existsByTenantIdAndUsernameAndStrategyIdAndModeAndStatusIn(
            String tenantId,
            String username,
            Long strategyId,
            String mode,
            Collection<String> statuses
    );

    void deleteByTenantIdAndExecutionId(String tenantId, Long executionId);
}
