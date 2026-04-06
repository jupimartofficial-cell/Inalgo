export const DEFAULT_TRADING_SCRIPT = `export default defineScript({
  meta: {
    name: 'Opening Range BankNifty',
    instrumentKey: 'NSE_INDEX|Nifty Bank',
    timeframeUnit: 'minutes',
    timeframeInterval: 5,
    strategyType: 'INTRADAY',
    marketSession: 'REGULAR_MARKET',
  },
  inputs: {
    stopLossPct: {
      label: 'Stop Loss %',
      type: 'number',
      defaultValue: 20,
      required: true,
      description: 'Percentage stop loss used by the risk block.',
    },
    targetPct: {
      label: 'Target %',
      type: 'number',
      defaultValue: 40,
      required: true,
      description: 'Percentage target used by the risk block.',
    },
  },
  notes: ['Trading Scripts v1 evaluates completed bars only.'],
  runtimeHints: {
    lookbackBars: 30,
    liveScope: 'OPTIONS_ONLY',
  },
  compiledStrategy: {
    strategyName: 'Opening Range BankNifty',
    underlyingKey: 'NSE_INDEX|Nifty Bank',
    underlyingSource: 'CASH',
    strategyType: 'INTRADAY',
    entryTime: '09:20',
    exitTime: '15:15',
    startDate: '2026-01-01',
    endDate: '2026-03-28',
    legs: [
      {
        id: 'ce-entry',
        segment: 'OPTIONS',
        lots: 1,
        position: 'BUY',
        optionType: 'CALL',
        expiryType: 'WEEKLY',
        strikeType: 'ATM',
        strikeSteps: 0,
      },
    ],
    legwiseSettings: {
      squareOffMode: 'COMPLETE',
      trailSlToBreakEven: false,
      trailScope: 'ALL_LEGS',
      noReEntryAfterEnabled: false,
      overallMomentumEnabled: false,
    },
    overallSettings: {
      stopLossEnabled: true,
      stopLossMode: 'PERCENT',
      stopLossValue: 20,
      targetEnabled: true,
      targetMode: 'PERCENT',
      targetValue: 40,
      trailingEnabled: false,
    },
    advancedConditions: {
      enabled: false,
    },
  },
  onBar(ctx, state, api) {
    const trend = api.trends.marketBias();
    const signal = api.signals.latest('ORB_BREAKOUT');

    if (signal.active && trend === 'BULLISH') {
      return api.actions.enter({
        reason: 'Breakout aligned with bullish trend',
        direction: 'LONG',
        legs: api.legs.atmCallBuy(1),
      });
    }

    if (state.positionOpen) {
      return api.actions.hold({ reason: 'Manage the open position until target or stop is hit.' });
    }

    return api.actions.hold({ reason: 'No entry on this completed bar.' });
  },
});
`;
