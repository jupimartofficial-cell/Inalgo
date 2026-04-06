package com.inalgo.trade.repository;

import com.inalgo.trade.entity.BacktestStrategyEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BacktestStrategyRepository extends JpaRepository<BacktestStrategyEntity, Long> {
    Page<BacktestStrategyEntity> findAllByTenantIdAndUsernameOrderByUpdatedAtDesc(
            String tenantId,
            String username,
            Pageable pageable
    );

    Optional<BacktestStrategyEntity> findByIdAndTenantId(Long id, String tenantId);

    List<BacktestStrategyEntity> findAllByTenantIdAndUsername(String tenantId, String username);
}
