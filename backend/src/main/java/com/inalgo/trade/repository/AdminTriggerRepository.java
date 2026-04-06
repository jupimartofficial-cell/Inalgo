package com.inalgo.trade.repository;

import com.inalgo.trade.entity.AdminTriggerEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Collection;

public interface AdminTriggerRepository extends JpaRepository<AdminTriggerEntity, Long> {
    List<AdminTriggerEntity> findAllByTenantIdOrderByUpdatedAtDescInstrumentKeyAscTimeframeUnitAscTimeframeIntervalAsc(String tenantId);

    Optional<AdminTriggerEntity> findByIdAndTenantId(Long id, String tenantId);

    List<AdminTriggerEntity> findTop20ByStatusAndNextRunAtLessThanEqualOrderByNextRunAtAsc(String status, Instant nextRunAt);

    boolean existsByTenantIdAndJobKeyAndStatusIn(String tenantId, String jobKey, Collection<String> statuses);
}
