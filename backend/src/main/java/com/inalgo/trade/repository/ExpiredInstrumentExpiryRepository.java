package com.inalgo.trade.repository;

import com.inalgo.trade.entity.ExpiredInstrumentExpiryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ExpiredInstrumentExpiryRepository extends JpaRepository<ExpiredInstrumentExpiryEntity, Long> {
    List<ExpiredInstrumentExpiryEntity> findAllByTenantIdAndUnderlyingKeyOrderByExpiryDateAsc(
            String tenantId,
            String underlyingKey
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            INSERT INTO expired_instrument_expiry_cache (
                tenant_id,
                underlying_key,
                expiry_date,
                updated_at
            ) VALUES (
                :tenantId,
                :underlyingKey,
                :expiryDate,
                NOW()
            )
            ON CONFLICT (tenant_id, underlying_key, expiry_date)
            DO UPDATE SET
                updated_at = NOW()
            """, nativeQuery = true)
    int upsert(
            @Param("tenantId") String tenantId,
            @Param("underlyingKey") String underlyingKey,
            @Param("expiryDate") LocalDate expiryDate
    );
}
