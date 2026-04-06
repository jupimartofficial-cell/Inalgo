package com.inalgo.trade.repository;

import com.inalgo.trade.entity.TradingScriptPerfSnapshotEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TradingScriptPerfSnapshotRepository extends JpaRepository<TradingScriptPerfSnapshotEntity, Long> {
    Optional<TradingScriptPerfSnapshotEntity> findByScriptIdAndTenantIdAndUsername(Long scriptId, String tenantId, String username);

    List<TradingScriptPerfSnapshotEntity> findAllByTenantIdAndUsername(String tenantId, String username);

    @Modifying
    @Query(value = """
            INSERT INTO trading_script_perf_snapshot
                (script_id, tenant_id, username, latest_total_pnl, latest_executed_trades, latest_real_world_accuracy_pct, latest_evaluated_at, updated_at)
            VALUES
                (:scriptId, :tenantId, :username, :latestTotalPnl, :latestExecutedTrades, :latestRealWorldAccuracyPct, :latestEvaluatedAt, now())
            ON CONFLICT (script_id) DO UPDATE SET
                latest_total_pnl = EXCLUDED.latest_total_pnl,
                latest_executed_trades = EXCLUDED.latest_executed_trades,
                latest_real_world_accuracy_pct = EXCLUDED.latest_real_world_accuracy_pct,
                latest_evaluated_at = EXCLUDED.latest_evaluated_at,
                updated_at = now()
            """, nativeQuery = true)
    void upsert(
            @Param("scriptId") Long scriptId,
            @Param("tenantId") String tenantId,
            @Param("username") String username,
            @Param("latestTotalPnl") BigDecimal latestTotalPnl,
            @Param("latestExecutedTrades") Integer latestExecutedTrades,
            @Param("latestRealWorldAccuracyPct") BigDecimal latestRealWorldAccuracyPct,
            @Param("latestEvaluatedAt") Instant latestEvaluatedAt
    );
}
