package com.inalgo.trade.repository;

import com.inalgo.trade.entity.IntraStrategyPerfSnapshotEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface IntraStrategyPerfSnapshotRepository extends JpaRepository<IntraStrategyPerfSnapshotEntity, Long> {
    Optional<IntraStrategyPerfSnapshotEntity> findByStrategyIdAndTenantIdAndUsername(
            Long strategyId,
            String tenantId,
            String username
    );

    List<IntraStrategyPerfSnapshotEntity> findAllByTenantIdAndUsername(String tenantId, String username);

    @Modifying
    @Query(value = """
            INSERT INTO intra_strategy_perf_snapshot
                (strategy_id, tenant_id, username, latest_total_pnl, latest_executed_trades, latest_evaluated_at, updated_at)
            VALUES
                (:strategyId, :tenantId, :username, :latestTotalPnl, :latestExecutedTrades, :latestEvaluatedAt, now())
            ON CONFLICT (strategy_id) DO UPDATE SET
                latest_total_pnl       = EXCLUDED.latest_total_pnl,
                latest_executed_trades = EXCLUDED.latest_executed_trades,
                latest_evaluated_at    = EXCLUDED.latest_evaluated_at,
                updated_at             = now()
            """, nativeQuery = true)
    void upsert(
            @Param("strategyId") Long strategyId,
            @Param("tenantId") String tenantId,
            @Param("username") String username,
            @Param("latestTotalPnl") BigDecimal latestTotalPnl,
            @Param("latestExecutedTrades") Integer latestExecutedTrades,
            @Param("latestEvaluatedAt") Instant latestEvaluatedAt
    );
}
