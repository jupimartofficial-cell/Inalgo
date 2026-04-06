package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraTradeExecutionEntity;
import com.inalgo.trade.repository.IntraPnlDailyRepository;
import com.inalgo.trade.repository.IntraTradeExecutionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class IntraPnlService {

    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Kolkata");

    private final IntraTradeExecutionRepository executionRepository;
    private final IntraPnlDailyRepository pnlDailyRepository;
    private final IntraPnlCalculator calculator;
    private final IntraPnlExportService exportService;

    @Autowired
    public IntraPnlService(
            IntraTradeExecutionRepository executionRepository,
            IntraPnlDailyRepository pnlDailyRepository,
            IntraPnlCalculator calculator,
            IntraPnlExportService exportService
    ) {
        this.executionRepository = executionRepository;
        this.pnlDailyRepository = pnlDailyRepository;
        this.calculator = calculator;
        this.exportService = exportService;
    }

    @Transactional
    public void refreshDailyAggregates(String tenantId, String username) {
        List<IntraTradeExecutionEntity> executions = executionRepository.findAllByTenantIdAndUsername(tenantId, username).stream()
                .filter(e -> calculator.isLivePaper(e.getMode()))
                .toList();

        pnlDailyRepository.deleteAllByTenantIdAndUsername(tenantId, username);

        Map<String, List<IntraTradeExecutionEntity>> byMode = executions.stream()
                .collect(Collectors.groupingBy(IntraTradeExecutionEntity::getMode));

        for (Map.Entry<String, List<IntraTradeExecutionEntity>> entry : byMode.entrySet()) {
            String mode = entry.getKey();
            List<IntraTradeExecutionEntity> sorted = entry.getValue().stream()
                    .sorted(Comparator.comparing(calculator::resolveTradeInstant))
                    .toList();

            BigDecimal cumulative = BigDecimal.ZERO;
            BigDecimal peak = BigDecimal.ZERO;
            Map<LocalDate, DailyAccumulator> acc = new LinkedHashMap<>();

            for (IntraTradeExecutionEntity execution : sorted) {
                LocalDate date = calculator.resolveTradeInstant(execution).atZone(MARKET_ZONE).toLocalDate();
                DailyAccumulator bucket = acc.computeIfAbsent(date, ignored -> new DailyAccumulator());

                BigDecimal pnl = calculator.safe(execution.getTotalPnl());
                cumulative = cumulative.add(pnl);
                peak = peak.max(cumulative);
                BigDecimal drawdown = peak.subtract(cumulative).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);

                boolean open = calculator.isOpenStatus(execution.getStatus());
                if (open) {
                    bucket.unrealized = bucket.unrealized.add(pnl);
                } else {
                    bucket.realized = bucket.realized.add(pnl);
                }
                bucket.total = bucket.total.add(pnl);
                bucket.trades += Optional.ofNullable(execution.getExecutedTrades()).orElse(0);
                if (pnl.signum() > 0) {
                    bucket.wins++;
                } else if (pnl.signum() < 0) {
                    bucket.losses++;
                }
                bucket.maxDrawdown = bucket.maxDrawdown.max(drawdown);
            }

            for (Map.Entry<LocalDate, DailyAccumulator> daily : acc.entrySet()) {
                DailyAccumulator v = daily.getValue();
                pnlDailyRepository.upsertDailyBucket(
                        tenantId, username, mode, daily.getKey(),
                        v.realized.setScale(2, RoundingMode.HALF_UP),
                        v.unrealized.setScale(2, RoundingMode.HALF_UP),
                        v.total.setScale(2, RoundingMode.HALF_UP),
                        v.trades, v.wins, v.losses,
                        v.maxDrawdown.setScale(2, RoundingMode.HALF_UP)
                );
            }
        }
    }

    public IntraPnlDtos.PnlDashboardResponse dashboard(
            String tenantId,
            String username,
            String mode,
            LocalDate fromDate,
            LocalDate toDate,
            String strategy,
            String instrument,
            String status,
            String account
    ) {
        LocalDate from = fromDate == null ? LocalDate.now(MARKET_ZONE).minusDays(30) : fromDate;
        LocalDate to = toDate == null ? LocalDate.now(MARKET_ZONE) : toDate;

        List<IntraTradeExecutionEntity> filtered = calculator.filterExecutions(
                executionRepository.findAllByTenantIdAndUsername(tenantId, username),
                mode,
                from,
                to,
                strategy,
                instrument,
                status,
                account,
                tenantId,
                username
        );

        List<IntraPnlDtos.PnlChartPoint> daily = calculator.buildDailyTrend(filtered);
        return new IntraPnlDtos.PnlDashboardResponse(
                calculator.buildSummary(filtered),
                daily,
                calculator.buildCumulative(daily),
                calculator.buildStrategyPerformance(filtered),
                calculator.buildTradeLedger(filtered, tenantId, username)
        );
    }

    public byte[] export(String format, IntraPnlDtos.PnlDashboardResponse dashboard) {
        return exportService.export(format, dashboard);
    }

    private static final class DailyAccumulator {
        private BigDecimal realized = BigDecimal.ZERO;
        private BigDecimal unrealized = BigDecimal.ZERO;
        private BigDecimal total = BigDecimal.ZERO;
        private int trades = 0;
        private int wins = 0;
        private int losses = 0;
        private BigDecimal maxDrawdown = BigDecimal.ZERO;
    }
}
