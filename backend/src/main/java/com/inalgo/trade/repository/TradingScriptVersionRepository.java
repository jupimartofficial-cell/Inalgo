package com.inalgo.trade.repository;

import com.inalgo.trade.entity.TradingScriptVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TradingScriptVersionRepository extends JpaRepository<TradingScriptVersionEntity, Long> {
    List<TradingScriptVersionEntity> findAllByScriptIdAndTenantIdAndUsernameOrderByVersionDesc(Long scriptId, String tenantId, String username);

    Optional<TradingScriptVersionEntity> findByScriptIdAndVersionAndTenantIdAndUsername(Long scriptId, Integer version, String tenantId, String username);

    Optional<TradingScriptVersionEntity> findByIdAndScriptIdAndTenantIdAndUsername(Long id, Long scriptId, String tenantId, String username);
}
