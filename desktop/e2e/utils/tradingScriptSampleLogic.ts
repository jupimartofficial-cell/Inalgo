export type AttachmentDayType = 'GAP_UP' | 'GAP_DOWN' | 'NORMAL';
export type AttachmentDecision = 'ENTER_CALL' | 'ENTER_PUT' | 'HOLD';

export type TradingSignalRow = {
  signalDate: string;
  currentClose: number | null;
  signal: string | null;
};

export type TradingDayParamRow = {
  tradeDate: string;
  orbHigh: number | null;
  orbLow: number | null;
  gapType: string | null;
};

export type AttachmentEvaluation = {
  date: string;
  dayType: AttachmentDayType;
  decision: AttachmentDecision;
  triggerFamily: 'GAP_UP_BREAKOUT' | 'GAP_DOWN_BREAKDOWN' | 'NORMAL_BREAKOUT' | 'NORMAL_BREAKDOWN' | 'NONE';
  reason: string;
};

function normalizeGapType(value: string | null | undefined): AttachmentDayType {
  const normalized = (value ?? '').trim().toUpperCase();
  if (normalized === 'GAP UP') return 'GAP_UP';
  if (normalized === 'GAP DOWN') return 'GAP_DOWN';
  return 'NORMAL';
}

function normalizeSignal(value: string | null | undefined): 'BUY' | 'SELL' | 'HOLD' {
  const normalized = (value ?? '').trim().toUpperCase();
  if (normalized === 'BUY') return 'BUY';
  if (normalized === 'SELL') return 'SELL';
  return 'HOLD';
}

export function normalizeExitTimeAttachment(raw: string | undefined): string {
  const fallback = '15:20';
  const value = (raw ?? '').trim().toUpperCase();
  if (!value) return fallback;
  const match = value.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/);
  if (!match) return fallback;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3];
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return fallback;
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return fallback;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function evaluateAttachmentLogic(signalRow: TradingSignalRow, dayParamRow: TradingDayParamRow): AttachmentEvaluation {
  const date = signalRow.signalDate;
  const dayType = normalizeGapType(dayParamRow.gapType);
  const signal = normalizeSignal(signalRow.signal);
  const close = signalRow.currentClose;
  const orbHigh = dayParamRow.orbHigh;
  const orbLow = dayParamRow.orbLow;

  const canCheckHigh = close != null && orbHigh != null;
  const canCheckLow = close != null && orbLow != null;
  const highBreakout = canCheckHigh && close > orbHigh;
  const lowBreakdown = canCheckLow && close < orbLow;

  if (dayType === 'GAP_UP') {
    if (highBreakout && signal === 'BUY') {
      return {
        date,
        dayType,
        decision: 'ENTER_CALL',
        triggerFamily: 'GAP_UP_BREAKOUT',
        reason: 'Gap Up day with 5m close above ORB_HIGH and BUY trend.',
      };
    }
    return { date, dayType, decision: 'HOLD', triggerFamily: 'NONE', reason: 'Gap Up conditions not met.' };
  }

  if (dayType === 'GAP_DOWN') {
    if (lowBreakdown && signal === 'SELL') {
      return {
        date,
        dayType,
        decision: 'ENTER_PUT',
        triggerFamily: 'GAP_DOWN_BREAKDOWN',
        reason: 'Gap Down day with 5m close below ORB_LOW and SELL trend.',
      };
    }
    return { date, dayType, decision: 'HOLD', triggerFamily: 'NONE', reason: 'Gap Down conditions not met.' };
  }

  if (highBreakout && signal === 'BUY') {
    return {
      date,
      dayType,
      decision: 'ENTER_CALL',
      triggerFamily: 'NORMAL_BREAKOUT',
      reason: 'Normal day breakout above ORB_HIGH with BUY trend.',
    };
  }
  if (lowBreakdown && signal === 'SELL') {
    return {
      date,
      dayType,
      decision: 'ENTER_PUT',
      triggerFamily: 'NORMAL_BREAKDOWN',
      reason: 'Normal day breakdown below ORB_LOW with SELL trend.',
    };
  }

  return { date, dayType, decision: 'HOLD', triggerFamily: 'NONE', reason: 'Normal day conditions not met.' };
}

export function buildAttachmentTradingScriptSource(args: {
  strategyName: string;
  tradeDate: string;
  decision: AttachmentDecision;
  instrumentKey: string;
  exitTime: string;
  lots: number;
}): string {
  const optionType = args.decision === 'ENTER_PUT' ? 'PUT' : 'CALL';
  const legId = args.decision === 'ENTER_PUT' ? 'pe-entry' : 'ce-entry';

  return `export default defineScript({
  meta: {
    name: '${args.strategyName}',
    instrumentKey: '${args.instrumentKey}',
    timeframeUnit: 'minutes',
    timeframeInterval: 5,
    strategyType: 'INTRADAY',
    marketSession: 'REGULAR_MARKET',
  },
  inputs: {
    optionLots: {
      label: 'Option Lots',
      type: 'number',
      defaultValue: ${args.lots},
      required: true,
      description: 'Attachment-normalized fixed lot size.',
    },
  },
  notes: ['Generated from attachment logic with deterministic parity mapping.'],
  runtimeHints: {
    source: 'script.txt',
    decision: '${args.decision}',
    liveScope: 'OPTIONS_ONLY',
  },
  compiledStrategy: {
    strategyName: '${args.strategyName}',
    underlyingKey: '${args.instrumentKey}',
    underlyingSource: 'CASH',
    strategyType: 'INTRADAY',
    entryTime: '09:20',
    exitTime: '${args.exitTime}',
    startDate: '${args.tradeDate}',
    endDate: '${args.tradeDate}',
    legs: [
      {
        id: '${legId}',
        segment: 'OPTIONS',
        lots: ${args.lots},
        position: 'BUY',
        optionType: '${optionType}',
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
    if (state.positionOpen) {
      return api.actions.hold({ reason: 'Manage open position until exit-time guard.' });
    }

    return api.actions.enter({
      reason: 'Attachment-normalized decision: ${args.decision}',
      direction: '${args.decision === 'ENTER_PUT' ? 'SHORT' : 'LONG'}',
      legs: ${args.decision === 'ENTER_PUT' ? `api.legs.atmPutBuy(${args.lots})` : `api.legs.atmCallBuy(${args.lots})`},
    });
  },
});\n`;
}
