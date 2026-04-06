package com.inalgo.trade.repository;

import com.inalgo.trade.entity.IntraStrategyEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IntraStrategyRepository extends JpaRepository<IntraStrategyEntity, Long> {
    List<IntraStrategyEntity> findAllByTenantIdAndUsername(String tenantId, String username);

    Optional<IntraStrategyEntity> findByIdAndTenantId(Long id, String tenantId);

    Optional<IntraStrategyEntity> findByTenantIdAndUsernameAndSourceTradingScriptId(String tenantId, String username, Long sourceTradingScriptId);
}
