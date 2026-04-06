package com.inalgo.trade.repository;

import com.inalgo.trade.entity.IntraTradeOrderEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IntraTradeOrderRepository extends JpaRepository<IntraTradeOrderEntity, Long> {
    boolean existsByTenantIdAndExecutionIdAndLegIdAndPhase(String tenantId, Long executionId, String legId, String phase);
    List<IntraTradeOrderEntity> findAllByTenantIdAndExecutionIdAndPhase(String tenantId, Long executionId, String phase);
}
