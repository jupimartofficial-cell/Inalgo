package com.inalgo.trade.repository;

import com.inalgo.trade.entity.AdminUserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AdminUserRepository extends JpaRepository<AdminUserEntity, Long> {
    Optional<AdminUserEntity> findByTenantIdAndUsernameAndActiveTrue(String tenantId, String username);
}
