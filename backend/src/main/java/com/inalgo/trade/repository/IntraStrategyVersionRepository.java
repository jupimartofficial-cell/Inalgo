package com.inalgo.trade.repository;

import com.inalgo.trade.entity.IntraStrategyVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IntraStrategyVersionRepository extends JpaRepository<IntraStrategyVersionEntity, Long> {
    List<IntraStrategyVersionEntity> findAllByStrategyIdAndTenantIdAndUsernameOrderByVersionDesc(
            Long strategyId,
            String tenantId,
            String username
    );

    Optional<IntraStrategyVersionEntity> findByStrategyIdAndVersionAndTenantIdAndUsername(
            Long strategyId,
            Integer version,
            String tenantId,
            String username
    );
}
