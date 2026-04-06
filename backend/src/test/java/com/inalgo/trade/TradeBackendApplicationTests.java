package com.inalgo.trade;

import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.repository.AppPropertyRepository;
import com.inalgo.trade.repository.AdminMigrationJobRepository;
import com.inalgo.trade.repository.AdminSessionRepository;
import com.inalgo.trade.repository.AdminTriggerRepository;
import com.inalgo.trade.repository.MarketSentimentSnapshotRepository;
import com.inalgo.trade.repository.IntraTradeExecutionRepository;
import com.inalgo.trade.repository.IntraRuntimeStrategyRepository;
import com.inalgo.trade.repository.IntraPositionSnapshotRepository;
import com.inalgo.trade.repository.IntraEventAuditRepository;
import com.inalgo.trade.repository.IntraPnlDailyRepository;
import com.inalgo.trade.repository.IntraStrategyRepository;
import com.inalgo.trade.repository.IntraStrategyVersionRepository;
import com.inalgo.trade.repository.IntraStrategyPerfSnapshotRepository;
import com.inalgo.trade.repository.BacktestStrategyRepository;
import com.inalgo.trade.repository.MarketWatchConfigRepository;
import com.inalgo.trade.repository.TradingDayParamRepository;
import com.inalgo.trade.repository.TradingSignalRepository;
import com.inalgo.trade.repository.FuturesContractRegistryRepository;
import com.inalgo.trade.repository.TradingPreferenceRepository;
import com.inalgo.trade.repository.UpstoxMigrationStateRepository;
import com.inalgo.trade.admin.AdminTriggerService;
import com.inalgo.trade.admin.BacktestAnalyticsService;
import com.inalgo.trade.admin.BacktestCandleSyncService;
import com.inalgo.trade.admin.BacktestRunService;
import com.inalgo.trade.admin.BacktestStrategyService;
import com.inalgo.trade.admin.MarketWatchService;
import com.inalgo.trade.service.TradingAnalyticsService;
import com.inalgo.trade.upstox.ExpiredInstrumentCatalogService;
import com.inalgo.trade.upstox.OptionChainService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

@SpringBootTest(properties = {
        "spring.flyway.enabled=false",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration",
        "upstox.migration.enabled=false"
})
class TradeBackendApplicationTests {

    @MockBean
    private CandleRepository candleRepository;

    @MockBean
    private UpstoxMigrationStateRepository upstoxMigrationStateRepository;

    @MockBean
    private AppPropertyRepository appPropertyRepository;

    @MockBean
    private AdminMigrationJobRepository adminMigrationJobRepository;

    @MockBean
    private TradingPreferenceRepository tradingPreferenceRepository;

    @MockBean
    private AdminSessionRepository adminSessionRepository;

    @MockBean
    private OptionChainService optionChainService;

    @MockBean
    private AdminTriggerService adminTriggerService;

    @MockBean
    private TradingAnalyticsService tradingAnalyticsService;

    @MockBean
    private TradingSignalRepository tradingSignalRepository;

    @MockBean
    private TradingDayParamRepository tradingDayParamRepository;

    @MockBean
    private BacktestStrategyService backtestStrategyService;

    @MockBean
    private BacktestRunService backtestRunService;

    @MockBean
    private BacktestCandleSyncService backtestCandleSyncService;

    @MockBean
    private BacktestAnalyticsService backtestAnalyticsService;

    @MockBean
    private ExpiredInstrumentCatalogService expiredInstrumentCatalogService;

    @MockBean
    private AdminTriggerRepository adminTriggerRepository;

    @MockBean
    private MarketSentimentSnapshotRepository marketSentimentSnapshotRepository;

    @MockBean
    private MarketWatchService marketWatchService;

    @MockBean
    private BacktestStrategyRepository backtestStrategyRepository;

    @MockBean
    private MarketWatchConfigRepository marketWatchConfigRepository;

    @MockBean
    private IntraTradeExecutionRepository intraTradeExecutionRepository;

    @MockBean
    private IntraRuntimeStrategyRepository intraRuntimeStrategyRepository;

    @MockBean
    private IntraPositionSnapshotRepository intraPositionSnapshotRepository;

    @MockBean
    private IntraEventAuditRepository intraEventAuditRepository;

    @MockBean
    private IntraPnlDailyRepository intraPnlDailyRepository;

    @MockBean
    private IntraStrategyRepository intraStrategyRepository;

    @MockBean
    private IntraStrategyVersionRepository intraStrategyVersionRepository;

    @MockBean
    private IntraStrategyPerfSnapshotRepository intraStrategyPerfSnapshotRepository;

    @MockBean
    private FuturesContractRegistryRepository futuresContractRegistryRepository;

    @Test
    void contextLoads() {
    }
}
