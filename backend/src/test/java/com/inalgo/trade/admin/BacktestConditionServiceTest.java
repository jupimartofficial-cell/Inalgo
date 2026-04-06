package com.inalgo.trade.admin;

import com.inalgo.trade.entity.TradingDayParamEntity;
import com.inalgo.trade.entity.TradingSignalEntity;
import com.inalgo.trade.repository.TradingDayParamRepository;
import com.inalgo.trade.repository.TradingSignalRepository;
import jakarta.validation.ValidationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BacktestConditionServiceTest {

    @Mock
    private TradingSignalRepository tradingSignalRepository;

    @Mock
    private TradingDayParamRepository tradingDayParamRepository;

    @Test
    void evaluatesEntryAndExitConditionsFromTradingSignalAndTradingDayParamData() {
        BacktestConditionService service = new BacktestConditionService(tradingSignalRepository, tradingDayParamRepository);
        LocalDate previousDate = LocalDate.of(2026, 1, 6);
        LocalDate tradeDate = LocalDate.of(2026, 1, 7);
        TradingSignalEntity previousSignal = tradingSignal(previousDate, new BigDecimal("96"), new BigDecimal("100"), "SELL");
        TradingSignalEntity currentSignal = tradingSignal(tradeDate, new BigDecimal("105"), new BigDecimal("100"), "BUY");
        TradingDayParamEntity currentDayParam = tradingDayParam(tradeDate, "Gap Up");

        when(tradingSignalRepository.findForBacktestRange("tenant-a", "NSE_INDEX|Nifty 50", tradeDate.minusDays(15), tradeDate.plusDays(1)))
                .thenReturn(List.of(previousSignal, currentSignal));
        when(tradingDayParamRepository.findForBacktestRange("tenant-a", "NSE_INDEX|Nifty 50", tradeDate.minusDays(15), tradeDate.plusDays(1)))
                .thenReturn(List.of(currentDayParam));

        AdminDtos.BacktestAdvancedConditionsPayload conditions = new AdminDtos.BacktestAdvancedConditionsPayload(
                true,
                new AdminDtos.BacktestConditionGroupPayload(
                        "AND",
                        List.of(
                                new AdminDtos.BacktestConditionNodePayload(
                                        new AdminDtos.BacktestConditionRulePayload(
                                                "minutes",
                                                1,
                                                new AdminDtos.BacktestConditionOperandPayload("FIELD", "TRADING_SIGNAL", "signal", null, null),
                                                "EQUAL_TO",
                                                new AdminDtos.BacktestConditionOperandPayload("VALUE", null, null, "BUY", "STRING")
                                        ),
                                        null
                                ),
                                new AdminDtos.BacktestConditionNodePayload(
                                        new AdminDtos.BacktestConditionRulePayload(
                                                "minutes",
                                                1,
                                                new AdminDtos.BacktestConditionOperandPayload("FIELD", "TRADING_SIGNAL", "currentClose", null, null),
                                                "CROSSES_ABOVE",
                                                new AdminDtos.BacktestConditionOperandPayload("FIELD", "TRADING_SIGNAL", "dma9", null, null)
                                        ),
                                        null
                                )
                        )
                ),
                new AdminDtos.BacktestConditionGroupPayload(
                        "AND",
                        List.of(new AdminDtos.BacktestConditionNodePayload(
                                new AdminDtos.BacktestConditionRulePayload(
                                        "minutes",
                                        1,
                                        new AdminDtos.BacktestConditionOperandPayload("FIELD", "TRADING_DAY_PARAM", "gapType", null, null),
                                        "EQUAL_TO",
                                        new AdminDtos.BacktestConditionOperandPayload("VALUE", null, null, "Gap Up", "STRING")
                                ),
                                null
                        ))
                )
        );

        AdminDtos.BacktestStrategyPayload strategy = new AdminDtos.BacktestStrategyPayload(
                "Advance Strategy",
                "NSE_INDEX|Nifty 50",
                "FUTURES",
                "INTRADAY",
                LocalTime.of(9, 35),
                LocalTime.of(15, 15),
                tradeDate,
                tradeDate,
                List.of(new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, null)),
                new AdminDtos.BacktestLegwiseSettingsPayload("PARTIAL", false, "ALL_LEGS", false, null, false, null, null),
                new AdminDtos.BacktestOverallSettingsPayload(false, null, null, false, null, null, false, null, null, null),
                conditions
        );

        BacktestConditionService.EvaluationContext context = service.prepareEvaluationContext("tenant-a", strategy);

        assertTrue(service.shouldEnter(context, tradeDate));
        assertFalse(service.shouldEnter(context, previousDate));
        assertTrue(service.shouldExit(context, tradeDate));
        assertFalse(service.shouldExit(context, previousDate));
    }

    @Test
    void rejectsNumericComparatorForStringField() {
        BacktestConditionService service = new BacktestConditionService(tradingSignalRepository, tradingDayParamRepository);

        AdminDtos.BacktestAdvancedConditionsPayload conditions = new AdminDtos.BacktestAdvancedConditionsPayload(
                true,
                new AdminDtos.BacktestConditionGroupPayload(
                        "AND",
                        List.of(new AdminDtos.BacktestConditionNodePayload(
                                new AdminDtos.BacktestConditionRulePayload(
                                        "minutes",
                                        1,
                                        new AdminDtos.BacktestConditionOperandPayload("FIELD", "TRADING_SIGNAL", "signal", null, null),
                                        "HIGHER_THAN",
                                        new AdminDtos.BacktestConditionOperandPayload("VALUE", null, null, "1", "NUMBER")
                                ),
                                null
                        ))
                ),
                null
        );

        assertThrows(ValidationException.class, () -> service.validateAdvancedConditions(service.normalizeAdvancedConditions(conditions)));
    }

    @Test
    void evaluateIntradayEntry_usesPreviousCompletedCandleForPreviousCloseField() {
        BacktestConditionService service = new BacktestConditionService(tradingSignalRepository, tradingDayParamRepository);
        LocalDate tradeDate = LocalDate.of(2026, 1, 7);
        TradingSignalEntity currentSignal = mock(TradingSignalEntity.class);
        when(currentSignal.getSignalDate()).thenReturn(tradeDate);
        when(currentSignal.getTimeframeUnit()).thenReturn("minutes");
        when(currentSignal.getTimeframeInterval()).thenReturn(1);

        when(tradingSignalRepository.findForBacktestRange(any(), any(), any(), any()))
                .thenReturn(List.of(currentSignal));
        when(tradingDayParamRepository.findForBacktestRange(any(), any(), any(), any()))
                .thenReturn(List.of());

        AdminDtos.BacktestAdvancedConditionsPayload conditions = new AdminDtos.BacktestAdvancedConditionsPayload(
                true,
                new AdminDtos.BacktestConditionGroupPayload(
                        "AND",
                        List.of(new AdminDtos.BacktestConditionNodePayload(
                                new AdminDtos.BacktestConditionRulePayload(
                                        "minutes",
                                        1,
                                        new AdminDtos.BacktestConditionOperandPayload("FIELD", "TRADING_SIGNAL", "currentClose", null, null),
                                        "HIGHER_THAN",
                                        new AdminDtos.BacktestConditionOperandPayload("FIELD", "TRADING_SIGNAL", "previousClose", null, null)
                                ),
                                null
                        ))
                ),
                null
        );

        AdminDtos.BacktestStrategyPayload strategy = new AdminDtos.BacktestStrategyPayload(
                "Intraday previous close",
                "NSE_INDEX|Nifty 50",
                "FUTURES",
                "INTRADAY",
                LocalTime.of(9, 35),
                LocalTime.of(15, 15),
                tradeDate,
                tradeDate,
                List.of(new AdminDtos.BacktestLegPayload("leg-1", "FUTURES", 1, "BUY", null, "WEEKLY", "ATM", 0, null)),
                new AdminDtos.BacktestLegwiseSettingsPayload("PARTIAL", false, "ALL_LEGS", false, null, false, null, null),
                new AdminDtos.BacktestOverallSettingsPayload(false, null, null, false, null, null, false, null, null, null),
                conditions
        );

        BacktestConditionService.EvaluationContext context = service.prepareEvaluationContext("tenant-a", strategy);

        assertTrue(service.evaluateIntradayEntry(context, tradeDate, new BigDecimal("105"), new BigDecimal("101")));
        assertFalse(service.evaluateIntradayEntry(context, tradeDate, new BigDecimal("100"), new BigDecimal("101")));
    }

    private TradingSignalEntity tradingSignal(LocalDate signalDate, BigDecimal currentClose, BigDecimal dma9, String signal) {
        TradingSignalEntity entity = mock(TradingSignalEntity.class);
        when(entity.getSignalDate()).thenReturn(signalDate);
        when(entity.getTimeframeUnit()).thenReturn("minutes");
        when(entity.getTimeframeInterval()).thenReturn(1);
        when(entity.getCurrentClose()).thenReturn(currentClose);
        when(entity.getDma9()).thenReturn(dma9);
        when(entity.getSignal()).thenReturn(signal);
        return entity;
    }

    private TradingDayParamEntity tradingDayParam(LocalDate tradeDate, String gapType) {
        TradingDayParamEntity entity = mock(TradingDayParamEntity.class);
        when(entity.getTradeDate()).thenReturn(tradeDate);
        when(entity.getGapType()).thenReturn(gapType);
        return entity;
    }
}
