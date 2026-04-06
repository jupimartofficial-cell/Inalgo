package com.inalgo.trade.repository;

import com.inalgo.trade.entity.FuturesContractRegistryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface FuturesContractRegistryRepository extends JpaRepository<FuturesContractRegistryEntity, Long> {

    List<FuturesContractRegistryEntity> findAll();

    Optional<FuturesContractRegistryEntity> findByUnderlyingKey(String underlyingKey);

    @Modifying
    @Query("""
            UPDATE FuturesContractRegistryEntity r
            SET r.instrumentKey = :instrumentKey,
                r.contractName  = :contractName,
                r.expiryDate    = :expiryDate,
                r.lotSize       = :lotSize,
                r.updatedAt     = CURRENT_TIMESTAMP
            WHERE r.underlyingKey = :underlyingKey
            """)
    int updateContract(
            @Param("underlyingKey") String underlyingKey,
            @Param("instrumentKey") String instrumentKey,
            @Param("contractName") String contractName,
            @Param("expiryDate") LocalDate expiryDate,
            @Param("lotSize") Integer lotSize
    );
}
