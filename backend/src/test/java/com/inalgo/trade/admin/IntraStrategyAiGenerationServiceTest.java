package com.inalgo.trade.admin;

import com.inalgo.trade.entity.TradingDayParamEntity;
import com.inalgo.trade.entity.TradingSignalEntity;
import com.inalgo.trade.repository.TradingDayParamRepository;
import com.inalgo.trade.repository.TradingSignalRepository;
import com.inalgo.trade.service.OpenAiIntraStrategyClient;
import com.inalgo.trade.service.OpenAiProperties;
import com.inalgo.trade.service.OpenAiTokenService;
import jakarta.validation.ValidationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IntraStrategyAiGenerationServiceTest {

    @Mock private TradingSignalRepository tradingSignalRepository;
    @Mock private TradingDayParamRepository tradingDayParamRepository;
    @Mock private OpenAiIntraStrategyClient openAiIntraStrategyClient;
    @Mock private OpenAiTokenService openAiTokenService;
    @Mock private BacktestStrategyService backtestStrategyService;
    @Mock private BacktestRunService backtestRunService;
    @Mock private IntraStrategyValidationEngine validationEngine;
    @Mock private IntraStrategyService intraStrategyService;
    @Mock private IntraTradeTrendAdvisor trendAdvisor;

    @Test
    void generate_usesFallbackTemplatesWhenOpenAiDisabled() {
        OpenAiProperties properties = new OpenAiProperties(false, "https://api.openai.com", "gpt-4o-mini", 45, "low", 6, "gpt-4o-mini", 30);
        IntraStrategyAiGenerationService service = buildService(properties, "2026-03-23T04:30:00Z");
        List<TradingSignalEntity> signals = mockSignals(30, "BUY");
        List<TradingDayParamEntity> dayParams = mockDayParams(30);
        TradingSignalEntity latest = signal("BUY", LocalDate.of(2026, 3, 23));

        when(tradingSignalRepository.findForBacktestRange(eq("tenant-a"), eq("NSE_INDEX|Nifty Bank"), any(), any()))
                .thenReturn(signals);
        when(tradingDayParamRepository.findForBacktestRange(eq("tenant-a"), eq("NSE_INDEX|Nifty Bank"), any(), any()))
                .thenReturn(dayParams);
        when(tradingSignalRepository.findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndSignalDateLessThanEqualOrderBySignalDateDescUpdatedAtDesc(
                "tenant-a", "NSE_INDEX|Nifty Bank", "minutes", 5, LocalDate.of(2026, 3, 23)
        )).thenReturn(Optional.of(latest));
        when(backtestStrategyService.normalizeStrategyPayload(any())).thenAnswer(inv -> inv.getArgument(0));
        when(validationEngine.validate(any())).thenReturn(validValidation());
        when(backtestRunService.runBacktest(eq("tenant-a"), any())).thenReturn(successRun());
        when(trendAdvisor.checkTrend(eq("tenant-a"), eq("NSE_INDEX|Nifty Bank"), eq("minutes"), eq(5), any()))
                .thenReturn(new IntraTradeDtos.IntraTradeTrendCheckResponse(false, "BULL", "BUY", ""));

        IntraStrategyDtos.IntraStrategyAiGenerateResponse response = service.generate(
                "tenant-a",
                new IntraStrategyDtos.IntraStrategyAiGenerateRequest(
                        "admin",
                        "NSE_INDEX|Nifty Bank",
                        2,
                        365,
                        "minutes",
                        5,
                        false
                )
        );

        assertThat(response.generationSource()).isEqualTo("FALLBACK_TEMPLATE");
        assertThat(response.candidates()).hasSize(2);
        assertThat(response.recommendedRank()).isNotNull();
        assertThat(response.disclaimer()).contains("No strategy can guarantee 100% trading accuracy");
        verify(openAiIntraStrategyClient, never()).generatePlans(any(), any(), anyInt());
        verify(intraStrategyService, never()).createDraft(any(), any());
    }

    @Test
    void generate_throwsWhenAnalyticsDataInsufficient() {
        OpenAiProperties properties = new OpenAiProperties(false, "https://api.openai.com", "gpt-4o-mini", 45, "low", 6, "gpt-4o-mini", 30);
        IntraStrategyAiGenerationService service = buildService(properties, "2026-03-23T04:30:00Z");
        List<TradingSignalEntity> signals = mockSignals(10, "BUY");
        List<TradingDayParamEntity> dayParams = mockDayParams(10);

        when(tradingSignalRepository.findForBacktestRange(eq("tenant-a"), eq("NSE_INDEX|Nifty Bank"), any(), any()))
                .thenReturn(signals);
        when(tradingDayParamRepository.findForBacktestRange(eq("tenant-a"), eq("NSE_INDEX|Nifty Bank"), any(), any()))
                .thenReturn(dayParams);

        assertThatThrownBy(() -> service.generate(
                "tenant-a",
                new IntraStrategyDtos.IntraStrategyAiGenerateRequest(
                        "admin",
                        "NSE_INDEX|Nifty Bank",
                        2,
                        365,
                        "minutes",
                        5,
                        false
                )
        ))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Insufficient trading analytics data");
    }

    @Test
    void generate_savesDraftsWhenRequested() {
        OpenAiProperties properties = new OpenAiProperties(false, "https://api.openai.com", "gpt-4o-mini", 45, "low", 6, "gpt-4o-mini", 30);
        IntraStrategyAiGenerationService service = buildService(properties, "2026-03-23T04:30:00Z");
        List<TradingSignalEntity> signals = mockSignals(35, "SELL");
        List<TradingDayParamEntity> dayParams = mockDayParams(35);
        TradingSignalEntity latest = signal("SELL", LocalDate.of(2026, 3, 23));

        when(tradingSignalRepository.findForBacktestRange(eq("tenant-a"), eq("NSE_INDEX|Nifty Bank"), any(), any()))
                .thenReturn(signals);
        when(tradingDayParamRepository.findForBacktestRange(eq("tenant-a"), eq("NSE_INDEX|Nifty Bank"), any(), any()))
                .thenReturn(dayParams);
        when(tradingSignalRepository.findTopByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndSignalDateLessThanEqualOrderBySignalDateDescUpdatedAtDesc(
                "tenant-a", "NSE_INDEX|Nifty Bank", "minutes", 5, LocalDate.of(2026, 3, 23)
        )).thenReturn(Optional.of(latest));
        when(backtestStrategyService.normalizeStrategyPayload(any())).thenAnswer(inv -> inv.getArgument(0));
        when(validationEngine.validate(any())).thenReturn(validValidation());
        when(backtestRunService.runBacktest(eq("tenant-a"), any())).thenReturn(successRun());
        when(trendAdvisor.checkTrend(eq("tenant-a"), eq("NSE_INDEX|Nifty Bank"), eq("minutes"), eq(5), any()))
                .thenReturn(new IntraTradeDtos.IntraTradeTrendCheckResponse(false, "BEAR", "SELL", ""));
        when(intraStrategyService.createDraft(eq("tenant-a"), any()))
                .thenReturn(new IntraStrategyDtos.IntraStrategyDetailsResponse(
                        new IntraStrategyDtos.IntraStrategyLibraryItem(
                                101L, "AI Draft", "NSE_INDEX|Nifty Bank", "minutes", 5, "INTRADAY", "DRAFT",
                                Instant.parse("2026-03-23T04:30:00Z"), "admin", 1, true, true, BigDecimal.ZERO, 0
                        ),
                        null
                ));

        IntraStrategyDtos.IntraStrategyAiGenerateResponse response = service.generate(
                "tenant-a",
                new IntraStrategyDtos.IntraStrategyAiGenerateRequest(
                        "admin",
                        "NSE_INDEX|Nifty Bank",
                        2,
                        365,
                        "minutes",
                        5,
                        true
                )
        );

        assertThat(response.candidates()).hasSize(2);
        assertThat(response.candidates().getFirst().savedStrategyId()).isEqualTo(101L);
        verify(intraStrategyService, times(2)).createDraft(eq("tenant-a"), any());
    }

    private IntraStrategyAiGenerationService buildService(OpenAiProperties properties, String nowUtc) {
        return new IntraStrategyAiGenerationService(
                tradingSignalRepository,
                tradingDayParamRepository,
                openAiIntraStrategyClient,
                openAiTokenService,
                properties,
                backtestStrategyService,
                backtestRunService,
                validationEngine,
                intraStrategyService,
                trendAdvisor,
                Clock.fixed(Instant.parse(nowUtc), ZoneOffset.UTC)
        );
    }

    private List<TradingSignalEntity> mockSignals(int count, String signal) {
        List<TradingSignalEntity> rows = new java.util.ArrayList<>();
        LocalDate start = LocalDate.of(2025, 1, 1);
        for (int i = 0; i < count; i += 1) {
            rows.add(signal(signal, start.plusDays(i)));
        }
        return rows;
    }

    private List<TradingDayParamEntity> mockDayParams(int count) {
        List<TradingDayParamEntity> rows = new java.util.ArrayList<>();
        LocalDate start = LocalDate.of(2025, 1, 1);
        for (int i = 0; i < count; i += 1) {
            rows.add(dayParam(start.plusDays(i)));
        }
        return rows;
    }

    private TradingSignalEntity signal(String signalValue, LocalDate tradeDate) {
        TradingSignalEntity signal = org.mockito.Mockito.mock(TradingSignalEntity.class);
        lenient().when(signal.getSignal()).thenReturn(signalValue);
        lenient().when(signal.getSignalDate()).thenReturn(tradeDate);
        lenient().when(signal.getCurrentClose()).thenReturn(new BigDecimal("50000"));
        lenient().when(signal.getDma9()).thenReturn(new BigDecimal("49980"));
        lenient().when(signal.getDma26()).thenReturn(new BigDecimal("49950"));
        lenient().when(signal.getDma110()).thenReturn(new BigDecimal("49850"));
        return signal;
    }

    private TradingDayParamEntity dayParam(LocalDate tradeDate) {
        TradingDayParamEntity row = org.mockito.Mockito.mock(TradingDayParamEntity.class);
        lenient().when(row.getTradeDate()).thenReturn(tradeDate);
        lenient().when(row.getOrbBreakout()).thenReturn("Yes");
        lenient().when(row.getOrbBreakdown()).thenReturn("No");
        lenient().when(row.getGapPct()).thenReturn(new BigDecimal("0.22"));
        lenient().when(row.getOrbHigh()).thenReturn(new BigDecimal("50120"));
        lenient().when(row.getOrbLow()).thenReturn(new BigDecimal("49920"));
        lenient().when(row.getPrevClose()).thenReturn(new BigDecimal("50000"));
        return row;
    }

    private IntraStrategyDtos.IntraStrategyValidationResult validValidation() {
        return new IntraStrategyDtos.IntraStrategyValidationResult(
                true,
                true,
                true,
                List.of(),
                List.of(),
                List.of()
        );
    }

    private AdminDtos.BacktestRunResponse successRun() {
        return new AdminDtos.BacktestRunResponse(
                null,
                List.of(),
                new BigDecimal("1200.00"),
                new BigDecimal("120.00"),
                10,
                7,
                3,
                1,
                2000,
                new BigDecimal("92.50"),
                9,
                1,
                List.of("ok")
        );
    }
}
