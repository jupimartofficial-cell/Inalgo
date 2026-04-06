package com.inalgo.trade.repository;

import com.inalgo.trade.entity.IntraEventAuditEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IntraEventAuditRepository extends JpaRepository<IntraEventAuditEntity, Long> {
    Page<IntraEventAuditEntity> findByTenantIdAndUsernameOrderByCreatedAtDesc(String tenantId, String username, Pageable pageable);

    Page<IntraEventAuditEntity> findByTenantIdAndUsernameAndEventTypeOrderByCreatedAtDesc(
            String tenantId,
            String username,
            String eventType,
            Pageable pageable
    );
}
