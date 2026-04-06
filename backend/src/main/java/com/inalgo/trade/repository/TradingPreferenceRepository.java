package com.inalgo.trade.repository;

import com.inalgo.trade.entity.TradingPreferenceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TradingPreferenceRepository extends JpaRepository<TradingPreferenceEntity, Long> {
    Optional<TradingPreferenceEntity> findByTenantIdAndUsername(String tenantId, String username);
}

