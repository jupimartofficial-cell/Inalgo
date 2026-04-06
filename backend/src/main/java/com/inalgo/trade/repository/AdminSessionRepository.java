package com.inalgo.trade.repository;

import com.inalgo.trade.entity.AdminSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;

public interface AdminSessionRepository extends JpaRepository<AdminSessionEntity, Long> {
    Optional<AdminSessionEntity> findByTenantIdAndTokenHash(String tenantId, String tokenHash);

    void deleteByExpiresAtBefore(Instant expiresAt);
}
