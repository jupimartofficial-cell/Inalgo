package com.inalgo.trade.repository;

import com.inalgo.trade.entity.IntraTradeExecutionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IntraTradeExecutionRepository extends JpaRepository<IntraTradeExecutionEntity, Long> {
    Page<IntraTradeExecutionEntity> findAllByTenantIdAndUsernameOrderByUpdatedAtDesc(
            String tenantId,
            String username,
            Pageable pageable
    );

    Optional<IntraTradeExecutionEntity> findByIdAndTenantId(Long id, String tenantId);

    void deleteByIdAndTenantId(Long id, String tenantId);

    boolean existsByTenantIdAndStrategyId(String tenantId, Long strategyId);

    Optional<IntraTradeExecutionEntity> findTopByTenantIdAndUsernameAndStrategyIdOrderByEvaluatedAtDesc(
            String tenantId,
            String username,
            Long strategyId
    );

    List<IntraTradeExecutionEntity> findAllByTenantIdAndUsername(String tenantId, String username);
}
