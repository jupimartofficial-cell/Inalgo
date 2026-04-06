package com.inalgo.trade.repository;

import com.inalgo.trade.entity.IntraPositionSnapshotEntity;
import com.inalgo.trade.entity.IntraRuntimeStrategyEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface IntraPositionSnapshotRepository extends JpaRepository<IntraPositionSnapshotEntity, Long> {
    List<IntraPositionSnapshotEntity> findAllByTenantIdAndExecutionId(String tenantId, Long executionId);

    List<IntraPositionSnapshotEntity> findAllByTenantIdAndRuntime(String tenantId, IntraRuntimeStrategyEntity runtime);

    void deleteAllByTenantIdAndExecutionId(String tenantId, Long executionId);

    Page<IntraPositionSnapshotEntity> findByTenantIdAndUsernameAndModeAndStatusOrderByUpdatedAtDesc(
            String tenantId,
            String username,
            String mode,
            String status,
            Pageable pageable
    );

    Page<IntraPositionSnapshotEntity> findByTenantIdAndUsernameAndModeOrderByUpdatedAtDesc(
            String tenantId,
            String username,
            String mode,
            Pageable pageable
    );

    Page<IntraPositionSnapshotEntity> findByTenantIdAndUsernameOrderByUpdatedAtDesc(
            String tenantId,
            String username,
            Pageable pageable
    );

    List<IntraPositionSnapshotEntity> findAllByTenantIdAndUsernameAndModeAndStatus(
            String tenantId,
            String username,
            String mode,
            String status
    );

    List<IntraPositionSnapshotEntity> findAllByTenantIdAndUsernameAndExecutionIdIn(
            String tenantId,
            String username,
            Collection<Long> executionIds
    );
}
