import type {
  BacktestAdvancedConditionsPayload,
  BacktestConditionComparator,
  BacktestConditionGroupPayload,
  BacktestConditionNodePayload,
  BacktestConditionOperandPayload,
  BacktestConditionRulePayload,
} from '../api/admin';

export interface TimeframeOption {
  unit: string;
  interval: number;
  label: string;
}

export type FieldKind = 'NUMBER' | 'STRING' | 'BOOLEAN' | 'DATE';

export const NUMERIC_COMPARATORS: ReadonlySet<BacktestConditionComparator> = new Set([
  'CROSSES_ABOVE', 'CROSSES_BELOW', 'UP_BY', 'DOWN_BY',
  'HIGHER_THAN', 'HIGHER_THAN_EQUAL_TO', 'LOWER_THAN', 'LOWER_THAN_EQUAL_TO',
]);

export const ADVANCED_CONDITION_COMPARATORS: Array<{ value: BacktestConditionComparator; label: string }> = [
  { value: 'UP_BY', label: 'up by' },
  { value: 'EQUAL_TO', label: 'equal to' },
  { value: 'CROSSES_ABOVE', label: 'crosses above' },
  { value: 'CROSSES_BELOW', label: 'crosses below' },
  { value: 'LOWER_THAN', label: 'lower than' },
  { value: 'HIGHER_THAN_EQUAL_TO', label: 'higher than or equal to' },
  { value: 'LOWER_THAN_EQUAL_TO', label: 'lower than or equal to' },
  { value: 'HIGHER_THAN', label: 'higher than' },
  { value: 'DOWN_BY', label: 'down by' },
];

export const ADVANCED_CONDITION_FIELDS: Array<{
  source: 'TRADING_SIGNAL' | 'TRADING_DAY_PARAM';
  label: string;
  fields: Array<{ value: string; label: string; kind: FieldKind }>;
}> = [
  {
    source: 'TRADING_SIGNAL',
    label: 'Trading Signal',
    fields: [
      { value: 'instrumentKey', label: 'Instrument Key', kind: 'STRING' },
      { value: 'timeframeUnit', label: 'Timeframe Unit', kind: 'STRING' },
      { value: 'timeframeInterval', label: 'Timeframe Interval', kind: 'NUMBER' },
      { value: 'signalDate', label: 'Signal Date', kind: 'DATE' },
      { value: 'previousClose', label: 'Previous Close', kind: 'NUMBER' },
      { value: 'currentClose', label: 'Current Close', kind: 'NUMBER' },
      { value: 'dma9', label: 'DMA 9', kind: 'NUMBER' },
      { value: 'dma26', label: 'DMA 26', kind: 'NUMBER' },
      { value: 'dma110', label: 'DMA 110', kind: 'NUMBER' },
      { value: 'signal', label: 'Signal', kind: 'STRING' },
      { value: 'firstCandleColor', label: 'First Candle Clr', kind: 'STRING' },
    ],
  },
  {
    source: 'TRADING_DAY_PARAM',
    label: 'Trading Param',
    fields: [
      { value: 'tradeDate', label: 'Trade Date', kind: 'DATE' },
      { value: 'instrumentKey', label: 'Instrument Key', kind: 'STRING' },
      { value: 'orbHigh', label: 'ORB High', kind: 'NUMBER' },
      { value: 'orbLow', label: 'ORB Low', kind: 'NUMBER' },
      { value: 'orbBreakout', label: 'ORB Breakout', kind: 'BOOLEAN' },
      { value: 'orbBreakdown', label: 'ORB Breakdown', kind: 'BOOLEAN' },
      { value: 'todayOpen', label: 'Today Open', kind: 'NUMBER' },
      { value: 'todayClose', label: 'Today Close', kind: 'NUMBER' },
      { value: 'prevHigh', label: 'Prev High', kind: 'NUMBER' },
      { value: 'prevLow', label: 'Prev Low', kind: 'NUMBER' },
      { value: 'prevClose', label: 'Prev Close', kind: 'NUMBER' },
      { value: 'gapPct', label: 'Gap %', kind: 'NUMBER' },
      { value: 'gapType', label: 'Gap Type', kind: 'STRING' },
      { value: 'gapUpPct', label: 'Gap Up %', kind: 'NUMBER' },
      { value: 'gapDownPct', label: 'Gap Down %', kind: 'NUMBER' },
    ],
  },
];

export const ADVANCED_CONDITION_VALUE_TYPES = [
  { value: 'NUMBER', label: 'Number' },
  { value: 'STRING', label: 'Text' },
  { value: 'BOOLEAN', label: 'Boolean' },
  { value: 'DATE', label: 'Date' },
] as const;

export const createDefaultFieldOperand = (): BacktestConditionOperandPayload => ({
  kind: 'FIELD',
  source: 'TRADING_SIGNAL',
  field: 'signal',
});

export const createDefaultValueOperand = (): BacktestConditionOperandPayload => ({
  kind: 'VALUE',
  valueType: 'STRING',
  value: 'BUY',
});

export const createDefaultRule = (timeframeOptions: TimeframeOption[]): BacktestConditionRulePayload => ({
  timeframeUnit: timeframeOptions[0]?.unit ?? 'minutes',
  timeframeInterval: timeframeOptions[0]?.interval ?? 1,
  left: createDefaultFieldOperand(),
  comparator: 'EQUAL_TO',
  right: createDefaultValueOperand(),
});

export const createDefaultGroup = (timeframeOptions: TimeframeOption[]): BacktestConditionGroupPayload => ({
  operator: 'AND',
  items: [{ rule: createDefaultRule(timeframeOptions) }],
});

export const fieldOptionsForSource = (source: 'TRADING_SIGNAL' | 'TRADING_DAY_PARAM') =>
  ADVANCED_CONDITION_FIELDS.find((option) => option.source === source)?.fields ?? [];

export const getFieldKind = (source: 'TRADING_SIGNAL' | 'TRADING_DAY_PARAM', field: string): FieldKind | null =>
  fieldOptionsForSource(source).find((f) => f.value === field)?.kind ?? null;

export const getOperandKind = (operand: BacktestConditionOperandPayload): FieldKind | null => {
  if (operand.kind === 'FIELD') {
    return getFieldKind(operand.source, operand.field);
  }
  return operand.valueType as FieldKind;
};

export const getComparatorsForKind = (kind: FieldKind | null) => {
  if (kind === 'NUMBER') return ADVANCED_CONDITION_COMPARATORS;
  return ADVANCED_CONDITION_COMPARATORS.filter((c) => !NUMERIC_COMPARATORS.has(c.value));
};

/** Returns true when the comparator requires both operands to be numeric. */
export const isNumericComparator = (comparator: BacktestConditionComparator) =>
  NUMERIC_COMPARATORS.has(comparator);

/**
 * When the left operand's kind changes (or comparator changes), ensure the rule
 * is still valid. Returns a patched rule if adjustments are needed, or the same
 * reference if nothing changed.
 */
export const reconcileRule = (
  rule: BacktestConditionRulePayload,
  timeframeOptions: TimeframeOption[]
): BacktestConditionRulePayload => {
  const leftKind = getOperandKind(rule.left);
  const needsNumeric = isNumericComparator(rule.comparator);

  // If comparator needs numeric but left is not numeric, reset comparator to EQUAL_TO
  if (needsNumeric && leftKind !== 'NUMBER') {
    return { ...rule, comparator: 'EQUAL_TO', right: createDefaultValueOperand() };
  }

  // If comparator needs numeric, ensure right operand is numeric
  if (needsNumeric) {
    const rightKind = getOperandKind(rule.right);
    if (rightKind !== 'NUMBER') {
      // Replace right with a numeric field default
      const firstNumericField = fieldOptionsForSource('TRADING_SIGNAL').find((f) => f.kind === 'NUMBER');
      const newRight: BacktestConditionOperandPayload = firstNumericField
        ? { kind: 'FIELD', source: 'TRADING_SIGNAL', field: firstNumericField.value }
        : { kind: 'VALUE', valueType: 'NUMBER', value: '0' };
      return { ...rule, right: newRight };
    }
  }

  return rule;
};

export const comparatorLabel = (value: BacktestConditionComparator) =>
  ADVANCED_CONDITION_COMPARATORS.find((option) => option.value === value)?.label ?? value.toLowerCase().replaceAll('_', ' ');

export const sourceLabel = (source: 'TRADING_SIGNAL' | 'TRADING_DAY_PARAM') =>
  ADVANCED_CONDITION_FIELDS.find((option) => option.source === source)?.label ?? source;

export const fieldLabel = (source: 'TRADING_SIGNAL' | 'TRADING_DAY_PARAM', field?: string) =>
  fieldOptionsForSource(source).find((option) => option.value === field)?.label ?? field ?? 'Field';

export const operandFieldLabel = (operand: BacktestConditionOperandPayload) => {
  if (operand.kind === 'VALUE') {
    return 'Value';
  }
  return fieldLabel(operand.source, operand.field);
};

const formatLiteral = (operand: Extract<BacktestConditionOperandPayload, { kind: 'VALUE' }>) => {
  if (operand.valueType === 'STRING') {
    return `"${operand.value}"`;
  }
  if (operand.valueType === 'BOOLEAN') {
    return operand.value?.toLowerCase() === 'true' ? 'TRUE' : 'FALSE';
  }
  return operand.value ?? '';
};

export const formatOperandText = (operand: BacktestConditionOperandPayload) => {
  if (operand.kind === 'VALUE') {
    return formatLiteral(operand);
  }
  return `${sourceLabel(operand.source)} ${fieldLabel(operand.source, operand.field)}`;
};

export const formatTimeframeLabel = (
  timeframeUnit: string,
  timeframeInterval: number,
  timeframeOptions: TimeframeOption[]
) => timeframeOptions.find((option) => option.unit === timeframeUnit && option.interval === timeframeInterval)?.label
  ?? `${timeframeInterval} ${timeframeUnit}`;

export const formatRuleText = (rule: BacktestConditionRulePayload, timeframeOptions: TimeframeOption[]) =>
  `[${formatTimeframeLabel(rule.timeframeUnit, rule.timeframeInterval, timeframeOptions)}] ${formatOperandText(rule.left)} ${comparatorLabel(rule.comparator)} ${formatOperandText(rule.right)}`;

const formatNodeText = (node: BacktestConditionNodePayload, timeframeOptions: TimeframeOption[]): string => {
  if (node.rule) {
    return formatRuleText(node.rule, timeframeOptions);
  }
  if (node.group) {
    return `(${formatGroupText(node.group, timeframeOptions)})`;
  }
  return '';
};

export const formatGroupText = (group: BacktestConditionGroupPayload, timeframeOptions: TimeframeOption[]): string =>
  group.items
    .map((node) => formatNodeText(node, timeframeOptions))
    .filter(Boolean)
    .join(` ${group.operator.toLowerCase()} `);

export const formatAdvancedConditionsSummary = (
  advancedConditions: BacktestAdvancedConditionsPayload | undefined,
  timeframeOptions: TimeframeOption[]
) => {
  if (!advancedConditions?.enabled) {
    return {
      entryText: 'Entry uses the scheduled Backtest entry time.',
      exitText: 'Exit uses the scheduled Backtest exit time and configured SL/Target/Trailing SL.',
      fullText: 'Basic mode only. Trades follow the configured entry time, exit time, and risk controls without additional Trading Signal or Trading Param conditions.',
    };
  }

  const entryQuery = advancedConditions.entry ? formatGroupText(advancedConditions.entry, timeframeOptions) : 'No entry condition configured';
  const exitQuery = advancedConditions.exit ? formatGroupText(advancedConditions.exit, timeframeOptions) : 'No exit condition configured';

  return {
    entryText: entryQuery,
    exitText: exitQuery,
    fullText: `Enter when ${entryQuery}. Exit early when ${exitQuery}; otherwise the strategy follows the scheduled exit time and configured risk controls.`,
  };
};
