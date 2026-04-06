package com.inalgo.trade.repository;

import com.inalgo.trade.entity.ExpiredDerivativeContractEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface ExpiredDerivativeContractRepository extends JpaRepository<ExpiredDerivativeContractEntity, Long> {
    List<ExpiredDerivativeContractEntity> findAllByTenantIdAndContractKindAndUnderlyingKeyAndExpiryDateOrderByStrikePriceAscInstrumentKeyAsc(
            String tenantId,
            String contractKind,
            String underlyingKey,
            LocalDate expiryDate
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            INSERT INTO expired_derivative_contract_cache (
                tenant_id,
                contract_kind,
                underlying_key,
                expiry_date,
                instrument_key,
                name,
                segment,
                exchange,
                exchange_token,
                trading_symbol,
                lot_size,
                instrument_type,
                strike_price,
                weekly,
                option_type,
                updated_at
            ) VALUES (
                :tenantId,
                :contractKind,
                :underlyingKey,
                :expiryDate,
                :instrumentKey,
                :name,
                :segment,
                :exchange,
                :exchangeToken,
                :tradingSymbol,
                :lotSize,
                :instrumentType,
                :strikePrice,
                :weekly,
                :optionType,
                NOW()
            )
            ON CONFLICT (tenant_id, contract_kind, underlying_key, expiry_date, instrument_key)
            DO UPDATE SET
                name = EXCLUDED.name,
                segment = EXCLUDED.segment,
                exchange = EXCLUDED.exchange,
                exchange_token = EXCLUDED.exchange_token,
                trading_symbol = EXCLUDED.trading_symbol,
                lot_size = EXCLUDED.lot_size,
                instrument_type = EXCLUDED.instrument_type,
                strike_price = EXCLUDED.strike_price,
                weekly = EXCLUDED.weekly,
                option_type = EXCLUDED.option_type,
                updated_at = NOW()
            """, nativeQuery = true)
    int upsert(
            @Param("tenantId") String tenantId,
            @Param("contractKind") String contractKind,
            @Param("underlyingKey") String underlyingKey,
            @Param("expiryDate") LocalDate expiryDate,
            @Param("instrumentKey") String instrumentKey,
            @Param("name") String name,
            @Param("segment") String segment,
            @Param("exchange") String exchange,
            @Param("exchangeToken") String exchangeToken,
            @Param("tradingSymbol") String tradingSymbol,
            @Param("lotSize") Integer lotSize,
            @Param("instrumentType") String instrumentType,
            @Param("strikePrice") BigDecimal strikePrice,
            @Param("weekly") Boolean weekly,
            @Param("optionType") String optionType
    );
}
