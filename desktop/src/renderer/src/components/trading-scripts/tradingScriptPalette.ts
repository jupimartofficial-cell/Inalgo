export interface TradingScriptSnippet {
  label: string;
  caption: string;
  insert: string;
}

export interface TradingScriptSnippetGroup {
  key: string;
  title: string;
  description: string;
  snippets: TradingScriptSnippet[];
}

export const TRADING_SCRIPT_SNIPPET_GROUPS: TradingScriptSnippetGroup[] = [
  {
    key: 'params',
    title: 'Trading Params',
    description: 'Typed inputs and runtime hints that shape risk and execution.',
    snippets: [
      {
        label: 'Numeric input',
        caption: 'Declare a number input exposed to the editor form.',
        insert: `riskPct: {
  label: 'Risk %',
  type: 'number',
  defaultValue: 1.5,
  required: true,
  description: 'Risk budget per trade.',
},
`,
      },
      {
        label: 'Runtime hint',
        caption: 'Hint the worker about lookback usage.',
        insert: `runtimeHints: {
  lookbackBars: 50,
  liveScope: 'OPTIONS_ONLY',
},
`,
      },
    ],
  },
  {
    key: 'signals',
    title: 'Trading Signals',
    description: 'Reference signal, momentum, and session-derived context.',
    snippets: [
      {
        label: 'Latest signal',
        caption: 'Read the latest named signal emitted by the platform.',
        insert: "const breakout = api.signals.latest('ORB_BREAKOUT');\n",
      },
      {
        label: 'Signal guard',
        caption: 'Gate entries behind an active signal.',
        insert: `if (!api.signals.latest('ORB_BREAKOUT').active) {
  return api.actions.hold({ reason: 'Signal inactive' });
}
`,
      },
    ],
  },
  {
    key: 'trend',
    title: 'Market Trend',
    description: 'Use market bias and trend summaries inside onBar.',
    snippets: [
      {
        label: 'Market bias',
        caption: 'Read current market bias snapshot.',
        insert: 'const bias = api.trends.marketBias();\n',
      },
      {
        label: 'Trend filter',
        caption: 'Only allow longs during bullish conditions.',
        insert: `if (api.trends.marketBias() !== 'BULLISH') {
  return api.actions.hold({ reason: 'Trend filter blocked entry' });
}
`,
      },
    ],
  },
  {
    key: 'instrument',
    title: 'Instrument & Timespan',
    description: 'Reference instrument and bar timing metadata.',
    snippets: [
      {
        label: 'Current bar',
        caption: 'Use completed bar OHLC values.',
        insert: `const currentBar = ctx.bar;
const close = currentBar.close;
`,
      },
      {
        label: 'Session check',
        caption: 'Guard entries near the end of the day.',
        insert: `if (api.clock.minutesToClose() < 20) {
  return api.actions.hold({ reason: 'Entry blocked near session close' });
}
`,
      },
    ],
  },
  {
    key: 'candle',
    title: 'Candle Helpers',
    description: 'Work with completed candle history.',
    snippets: [
      {
        label: 'Previous close',
        caption: 'Read the last completed bar close.',
        insert: 'const previousClose = ctx.series.at(-2)?.close;\n',
      },
      {
        label: 'Range expansion',
        caption: 'Simple range expansion condition.',
        insert: `const barRange = ctx.bar.high - ctx.bar.low;
if (barRange < 40) {
  return api.actions.hold({ reason: 'Range too narrow' });
}
`,
      },
    ],
  },
  {
    key: 'options',
    title: 'Option-chain Helpers',
    description: 'Build option legs from the live option-chain snapshot.',
    snippets: [
      {
        label: 'ATM call leg',
        caption: 'Create one ATM call buy leg.',
        insert: 'const legs = api.legs.atmCallBuy(1);\n',
      },
      {
        label: 'ATM put leg',
        caption: 'Create one ATM put buy leg.',
        insert: 'const legs = api.legs.atmPutBuy(1);\n',
      },
    ],
  },
  {
    key: 'actions',
    title: 'Entry / Exit Actions',
    description: 'Emit normalized ENTER, EXIT, HOLD, and ADJUST_LEGS decisions.',
    snippets: [
      {
        label: 'Hold',
        caption: 'Return a HOLD action with reason.',
        insert: "return api.actions.hold({ reason: 'No action on this bar' });\n",
      },
      {
        label: 'Enter',
        caption: 'Enter with dynamically resolved legs.',
        insert: `return api.actions.enter({
  reason: 'Entry condition satisfied',
  direction: 'LONG',
  legs: api.legs.atmCallBuy(1),
});
`,
      },
      {
        label: 'Exit',
        caption: 'Exit an active position.',
        insert: "return api.actions.exit({ reason: 'Exit condition satisfied' });\n",
      },
      {
        label: 'Adjust legs',
        caption: 'Adjust open legs without closing the strategy.',
        insert: `return api.actions.adjustLegs({
  reason: 'Roll strike after premium decay',
  legs: api.legs.atmCallBuy(1),
});
`,
      },
    ],
  },
  {
    key: 'risk',
    title: 'Risk Helpers',
    description: 'Common stop-loss and target guardrails.',
    snippets: [
      {
        label: 'Stop-loss block',
        caption: 'Exit when live P&L falls below a threshold.',
        insert: `if (state.positionOpen && state.livePnl <= -500) {
  return api.actions.exit({ reason: 'Stop loss hit' });
}
`,
      },
      {
        label: 'Target block',
        caption: 'Exit after reaching profit target.',
        insert: `if (state.positionOpen && state.livePnl >= 1000) {
  return api.actions.exit({ reason: 'Target reached' });
}
`,
      },
    ],
  },
];
