package com.inalgo.trade.repository;

import com.inalgo.trade.entity.MarketWatchConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MarketWatchConfigRepository extends JpaRepository<MarketWatchConfigEntity, Long> {
    Optional<MarketWatchConfigEntity> findByTenantIdAndUsername(String tenantId, String username);
}
