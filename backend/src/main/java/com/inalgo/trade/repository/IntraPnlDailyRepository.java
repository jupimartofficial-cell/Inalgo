package com.inalgo.trade.repository;

import com.inalgo.trade.entity.IntraPnlDailyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface IntraPnlDailyRepository extends JpaRepository<IntraPnlDailyEntity, Long> {
    Optional<IntraPnlDailyEntity> findByTenantIdAndUsernameAndModeAndTradeDate(
            String tenantId,
            String username,
            String mode,
            LocalDate tradeDate
    );

    List<IntraPnlDailyEntity> findByTenantIdAndUsernameAndTradeDateBetweenOrderByTradeDateAsc(
            String tenantId,
            String username,
            LocalDate from,
            LocalDate to
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM IntraPnlDailyEntity e WHERE e.tenantId = :tenantId AND e.username = :username")
    void deleteAllByTenantIdAndUsername(@Param("tenantId") String tenantId, @Param("username") String username);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            INSERT INTO intra_pnl_daily
              (tenant_id, username, mode, trade_date,
               realized_pnl, unrealized_pnl, total_pnl,
               trades_count, win_count, loss_count, max_drawdown,
               created_at, updated_at)
            VALUES
              (:tenantId, :username, :mode, :tradeDate,
               :realizedPnl, :unrealizedPnl, :totalPnl,
               :tradesCount, :winCount, :lossCount, :maxDrawdown,
               now(), now())
            ON CONFLICT (tenant_id, username, mode, trade_date) DO UPDATE SET
              realized_pnl   = EXCLUDED.realized_pnl,
              unrealized_pnl = EXCLUDED.unrealized_pnl,
              total_pnl      = EXCLUDED.total_pnl,
              trades_count   = EXCLUDED.trades_count,
              win_count      = EXCLUDED.win_count,
              loss_count     = EXCLUDED.loss_count,
              max_drawdown   = EXCLUDED.max_drawdown,
              updated_at     = now()
            """, nativeQuery = true)
    void upsertDailyBucket(
            @Param("tenantId") String tenantId,
            @Param("username") String username,
            @Param("mode") String mode,
            @Param("tradeDate") java.time.LocalDate tradeDate,
            @Param("realizedPnl") java.math.BigDecimal realizedPnl,
            @Param("unrealizedPnl") java.math.BigDecimal unrealizedPnl,
            @Param("totalPnl") java.math.BigDecimal totalPnl,
            @Param("tradesCount") int tradesCount,
            @Param("winCount") int winCount,
            @Param("lossCount") int lossCount,
            @Param("maxDrawdown") java.math.BigDecimal maxDrawdown
    );
}
