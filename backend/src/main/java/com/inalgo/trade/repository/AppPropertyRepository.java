package com.inalgo.trade.repository;

import com.inalgo.trade.entity.AppPropertyEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AppPropertyRepository extends JpaRepository<AppPropertyEntity, Long> {
    Optional<AppPropertyEntity> findByTenantIdAndPropertyKey(String tenantId, String propertyKey);
}
