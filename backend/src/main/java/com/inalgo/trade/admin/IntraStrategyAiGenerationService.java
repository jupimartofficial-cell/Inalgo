package com.inalgo.trade.admin;

import com.inalgo.trade.entity.TradingDayParamEntity;
import com.inalgo.trade.entity.TradingSignalEntity;
import com.inalgo.trade.repository.TradingDayParamRepository;
import com.inalgo.trade.repository.TradingSignalRepository;
import com.inalgo.trade.service.OpenAiIntraStrategyClient;
import com.inalgo.trade.service.OpenAiProperties;
import com.inalgo.trade.service.OpenAiTokenService;
import jakarta.validation.ValidationException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
public class IntraStrategyAiGenerationService {

    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Kolkata");

    private final TradingSignalRepository tradingSignalRepository;
    private final TradingDayParamRepository tradingDayParamRepository;
    private final OpenAiIntraStrategyClient openAiIntraStrategyClient;
    private final OpenAiTokenService openAiTokenService;
    private final OpenAiProperties openAiProperties;
    private final BacktestStrategyService backtestStrategyService;
    private final BacktestRunService backtestRunService;
    private final IntraStrategyValidationEngine validationEngine;
    private final IntraStrategyService intraStrategyService;
    private final IntraTradeTrendAdvisor trendAdvisor;
    private final Clock clock;

    @Autowired
    public IntraStrategyAiGenerationService(
            TradingSignalRepository tradingSignalRepository,
            TradingDayParamRepository tradingDayParamRepository,
            OpenAiIntraStrategyClient openAiIntraStrategyClient,
            OpenAiTokenService openAiTokenService,
            OpenAiProperties openAiProperties,
            BacktestStrategyService backtestStrategyService,
            BacktestRunService backtestRunService,
            IntraStrategyValidationEngine validationEngine,
            IntraStrategyService intraStrategyService,
            IntraTradeTrendAdvisor trendAdvisor
    ) {
        this(
                tradingSignalRepository,
                tradingDayParamRepository,
                openAiIntraStrategyClient,
                openAiTokenService,
                openAiProperties,
                backtestStrategyService,
                backtestRunService,
                validationEngine,
                intraStrategyService,
                trendAdvisor,
                Clock.system(MARKET_ZONE)
        );
    }

    IntraStrategyAiGenerationService(
            TradingSignalRepository tradingSignalRepository,
            TradingDayParamRepository tradingDayParamRepository,
            OpenAiIntraStrategyClient openAiIntraStrategyClient,
            OpenAiTokenService openAiTokenService,
            OpenAiProperties openAiProperties,
            BacktestStrategyService backtestStrategyService,
            BacktestRunService backtestRunService,
            IntraStrategyValidationEngine validationEngine,
            IntraStrategyService intraStrategyService,
            IntraTradeTrendAdvisor trendAdvisor,
            Clock clock
    ) {
        this.tradingSignalRepository = tradingSignalRepository;
        this.tradingDayParamRepository = tradingDayParamRepository;
        this.openAiIntraStrategyClient = openAiIntraStrategyClient;
        this.openAiTokenService = openAiTokenService;
        this.openAiProperties = openAiProperties;
        this.backtestStrategyService = backtestStrategyService;
        this.backtestRunService = backtestRunService;
        this.validationEngine = validationEngine;
        this.intraStrategyService = intraStrategyService;
        this.trendAdvisor = trendAdvisor;
        this.clock = clock;
    }

    public IntraStrategyDtos.IntraStrategyAiGenerateResponse generate(
            String tenantId,
            IntraStrategyDtos.IntraStrategyAiGenerateRequest request
    ) {
        String username = requireText(request.username(), "username");
        String instrumentKey = requireText(request.instrumentKey(), "instrumentKey");
        int candidateCount = request.candidateCount();
        int lookbackDays = request.lookbackDays();
        String timeframeUnit = request.timeframeUnit().trim().toLowerCase();
        Integer timeframeInterval = request.timeframeInterval();
        boolean saveAsDrafts = Boolean.TRUE.equals(request.saveAsDrafts());
        LocalDate lookbackTo = LocalDate.now(clock);
        LocalDate lookbackFrom = lookbackTo.minusDays(Math.max(lookbackDays - 1, 1));

        List<TradingSignalEntity> tradingSignals = tradingSignalRepository.findForBacktestRange(
                tenantId, instrumentKey, lookbackFrom, lookbackTo
        );
        List<TradingDayParamEntity> dayParams = tradingDayParamRepository.findForBacktestRange(
                tenantId, instrumentKey, lookbackFrom, lookbackTo
        );
        if (tradingSignals.size() < 20 || dayParams.size() < 20) {
            throw new ValidationException(
                    "Insufficient trading analytics data for generation. Need at least 20 rows in both trading_signal and trading_day_param."
            );
        }

        Optional<TradingSignalEntity> latestTrend = tradingSignalRepository
                .findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndSignalDateLessThanEqualOrderBySignalDateDescUpdatedAtDesc(
                        tenantId, instrumentKey, timeframeUnit, timeframeInterval, lookbackTo
                );
        String latestTrendSignal = latestTrend.map(TradingSignalEntity::getSignal).orElse("HOLD");
        String analyticsSummary = IntraStrategyAiTemplateSupport.buildAnalyticsSummary(
                instrumentKey,
                timeframeUnit,
                timeframeInterval,
                lookbackFrom,
                lookbackTo,
                latestTrendSignal,
                tradingSignals,
                dayParams,
                candidateCount
        );

        String generationSource = "OPENAI";
        List<OpenAiIntraStrategyClient.GeneratedPlan> plans;
        if (openAiProperties.enabled() && openAiTokenService.findTokenForTenant(tenantId).isPresent()) {
            try {
                plans = openAiIntraStrategyClient.generatePlans(tenantId, analyticsSummary, candidateCount);
            } catch (Exception ex) {
                generationSource = "FALLBACK_TEMPLATE";
                plans = IntraStrategyAiTemplateSupport.fallbackPlans(candidateCount, latestTrendSignal);
            }
        } else {
            generationSource = "FALLBACK_TEMPLATE";
            plans = IntraStrategyAiTemplateSupport.fallbackPlans(candidateCount, latestTrendSignal);
        }

        List<IntraStrategyDtos.IntraStrategyAiCandidate> candidates = buildCandidateResponses(
                tenantId,
                username,
                instrumentKey,
                timeframeUnit,
                timeframeInterval,
                lookbackFrom,
                lookbackTo,
                saveAsDrafts,
                plans
        );

        Integer recommendedRank = candidates.stream()
                .filter(item -> item.backtest() != null)
                .max(Comparator.comparing(IntraStrategyDtos.IntraStrategyAiCandidate::selectionScore))
                .map(IntraStrategyDtos.IntraStrategyAiCandidate::rank)
                .orElse(null);

        return new IntraStrategyDtos.IntraStrategyAiGenerateResponse(
                instrumentKey,
                timeframeUnit,
                timeframeInterval,
                lookbackFrom,
                lookbackTo,
                latestTrendSignal,
                generationSource,
                "No strategy can guarantee 100% trading accuracy. Use measured backtest and live controls before production trading.",
                recommendedRank,
                List.copyOf(candidates)
        );
    }

    private List<IntraStrategyDtos.IntraStrategyAiCandidate> buildCandidateResponses(
            String tenantId,
            String username,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            LocalDate lookbackFrom,
            LocalDate lookbackTo,
            boolean saveAsDrafts,
            List<OpenAiIntraStrategyClient.GeneratedPlan> plans
    ) {
        List<IntraStrategyDtos.IntraStrategyAiCandidate> candidates = new ArrayList<>();
        for (int index = 0; index < plans.size(); index += 1) {
            OpenAiIntraStrategyClient.GeneratedPlan plan = plans.get(index);
            AdminDtos.BacktestStrategyPayload strategyPayload = IntraStrategyAiTemplateSupport.buildStrategyPayload(
                    plan, instrumentKey, lookbackFrom, lookbackTo, index + 1
            );
            AdminDtos.BacktestStrategyPayload normalized = backtestStrategyService.normalizeStrategyPayload(strategyPayload);
            backtestStrategyService.validateStrategyPayload(normalized);

            IntraStrategyDtos.IntraStrategyBuilderPayload builderPayload = new IntraStrategyDtos.IntraStrategyBuilderPayload(
                    normalized,
                    timeframeUnit,
                    timeframeInterval,
                    normalized.advancedConditions() != null && Boolean.TRUE.equals(normalized.advancedConditions().enabled()),
                    "REGULAR_MARKET"
            );
            IntraStrategyDtos.IntraStrategyValidationResult validation = validationEngine.validate(builderPayload);
            Long savedStrategyId = saveAsDrafts ? saveStrategyDraft(tenantId, username, builderPayload) : null;

            IntraStrategyDtos.IntraStrategyAiBacktestSummary backtestSummary = null;
            List<String> notes = new ArrayList<>();
            BigDecimal score = BigDecimal.valueOf(-999999);
            try {
                AdminDtos.BacktestRunResponse backtest = backtestRunService.runBacktest(
                        tenantId, new AdminDtos.BacktestRunRequest(username, normalized)
                );
                backtestSummary = new IntraStrategyDtos.IntraStrategyAiBacktestSummary(
                        backtest.totalPnl(),
                        backtest.averagePnl(),
                        backtest.executedTrades(),
                        backtest.winTrades(),
                        backtest.lossTrades(),
                        backtest.realWorldAccuracyPct(),
                        backtest.marketPricedTrades(),
                        backtest.fallbackPricedTrades(),
                        backtest.notes()
                );
                score = IntraStrategyAiTemplateSupport.scoreCandidate(backtest);
            } catch (Exception ex) {
                notes.add("Backtest failed: " + ex.getMessage());
            }

            IntraTradeDtos.IntraTradeTrendCheckResponse trendCheck = trendAdvisor.checkTrend(
                    tenantId, instrumentKey, timeframeUnit, timeframeInterval, normalized
            );
            if (trendCheck.hasConflict()) {
                score = score.subtract(BigDecimal.valueOf(150));
            }

            candidates.add(new IntraStrategyDtos.IntraStrategyAiCandidate(
                    index + 1,
                    normalized.strategyName(),
                    plan.template(),
                    plan.direction(),
                    plan.rationale(),
                    normalized,
                    validation,
                    backtestSummary,
                    trendCheck.hasConflict(),
                    trendCheck.strategyBias(),
                    trendCheck.currentTrend(),
                    trendCheck.message(),
                    score,
                    savedStrategyId,
                    List.copyOf(notes)
            ));
        }
        return candidates;
    }

    private Long saveStrategyDraft(
            String tenantId,
            String username,
            IntraStrategyDtos.IntraStrategyBuilderPayload builderPayload
    ) {
        IntraStrategyDtos.IntraStrategyDetailsResponse saved = intraStrategyService.createDraft(
                tenantId,
                new IntraStrategyDtos.IntraStrategyCreateDraftRequest(username, builderPayload)
        );
        return saved.strategy() == null ? null : saved.strategy().id();
    }

    private String requireText(String value, String field) {
        if (!StringUtils.hasText(value)) {
            throw new ValidationException(field + " is required");
        }
        return value.trim();
    }
}
