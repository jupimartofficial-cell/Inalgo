package com.inalgo.trade.repository;

import com.inalgo.trade.entity.TradingScriptEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TradingScriptRepository extends JpaRepository<TradingScriptEntity, Long> {
    List<TradingScriptEntity> findAllByTenantIdAndUsername(String tenantId, String username);

    Optional<TradingScriptEntity> findByIdAndTenantId(Long id, String tenantId);
}
