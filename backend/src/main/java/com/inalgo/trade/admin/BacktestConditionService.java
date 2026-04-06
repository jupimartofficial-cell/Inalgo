package com.inalgo.trade.admin;
import com.inalgo.trade.entity.TradingDayParamEntity;
import com.inalgo.trade.entity.TradingSignalEntity;
import com.inalgo.trade.repository.TradingDayParamRepository;
import com.inalgo.trade.repository.TradingSignalRepository;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
@Service
public class BacktestConditionService {
private static final Set<String> ALLOWED_GROUP_OPERATORS = Set.of("AND", "OR");
private static final Set<String> ALLOWED_COMPARATORS = Set.of(
"EQUAL_TO",
"HIGHER_THAN",
"HIGHER_THAN_EQUAL_TO",
"LOWER_THAN",
"LOWER_THAN_EQUAL_TO",
"CROSSES_ABOVE",
"CROSSES_BELOW",
"UP_BY",
"DOWN_BY"
);
private static final Set<String> ALLOWED_TIMEFRAME_UNITS = Set.of("minutes", "days", "weeks", "months");
private static final Set<String> ALLOWED_OPERAND_KINDS = Set.of("FIELD", "VALUE");
private static final Set<String> ALLOWED_FIELD_SOURCES = Set.of("TRADING_SIGNAL", "TRADING_DAY_PARAM");
private static final Set<String> ALLOWED_VALUE_TYPES = Set.of("NUMBER", "STRING", "BOOLEAN", "DATE");
private static final int LOOKBACK_PADDING_DAYS = 15;
private static final Map<String, FieldMetadata> FIELD_METADATA = buildFieldMetadata();
private final TradingSignalRepository tradingSignalRepository;
private final TradingDayParamRepository tradingDayParamRepository;
public BacktestConditionService(
TradingSignalRepository tradingSignalRepository,
TradingDayParamRepository tradingDayParamRepository
) {
this.tradingSignalRepository = tradingSignalRepository;
this.tradingDayParamRepository = tradingDayParamRepository;
}
public AdminDtos.BacktestAdvancedConditionsPayload normalizeAdvancedConditions(
AdminDtos.BacktestAdvancedConditionsPayload payload
) {
if (payload == null) {
return new AdminDtos.BacktestAdvancedConditionsPayload(false, null, null);
}
return new AdminDtos.BacktestAdvancedConditionsPayload(
Boolean.TRUE.equals(payload.enabled()),
normalizeGroup(payload.entry()),
normalizeGroup(payload.exit())
);
}
public void validateAdvancedConditions(AdminDtos.BacktestAdvancedConditionsPayload payload) {
if (payload == null || !Boolean.TRUE.equals(payload.enabled())) {
return;
}
if (payload.entry() == null && payload.exit() == null) {
throw new ValidationException("At least one of entry or exit conditions is required when advance conditions are enabled");
}
if (payload.entry() != null) {
validateGroup(payload.entry(), "entry");
}
if (payload.exit() != null) {
validateGroup(payload.exit(), "exit");
}
}
public EvaluationContext prepareEvaluationContext(String tenantId, AdminDtos.BacktestStrategyPayload strategy) {
return prepareEvaluationContext(
tenantId,
strategy.underlyingKey(),
strategy.startDate(),
strategy.endDate(),
strategy.advancedConditions()
);
}
public EvaluationContext prepareEvaluationContext(
String tenantId,
String underlyingKey,
LocalDate startDate,
LocalDate endDate,
AdminDtos.BacktestAdvancedConditionsPayload conditions
) {
if (conditions == null || !Boolean.TRUE.equals(conditions.enabled())) {
return EvaluationContext.disabled();
}
LocalDate fromDate = startDate.minusDays(LOOKBACK_PADDING_DAYS);
LocalDate toDate = endDate.plusDays(1);
List<TradingSignalEntity> signals = tradingSignalRepository.findForBacktestRange(
tenantId,
underlyingKey,
fromDate,
toDate
);
List<TradingDayParamEntity> dayParams = tradingDayParamRepository.findForBacktestRange(
tenantId,
underlyingKey,
fromDate,
toDate
);
Map<LocalDate, Map<String, TradingSignalEntity>> signalsByDate = new HashMap<>();
for (TradingSignalEntity signal : signals) {
signalsByDate
.computeIfAbsent(signal.getSignalDate(), ignored -> new HashMap<>())
.put(timeframeKey(signal.getTimeframeUnit(), signal.getTimeframeInterval()), signal);
}
Map<LocalDate, TradingDayParamEntity> dayParamsByDate = new HashMap<>();
for (TradingDayParamEntity dayParam : dayParams) {
dayParamsByDate.put(dayParam.getTradeDate(), dayParam);
}
return new EvaluationContext(conditions, fromDate, signalsByDate, dayParamsByDate);
}
public boolean shouldEnter(EvaluationContext context, LocalDate tradeDate) {
if (!context.enabled() || context.conditions().entry() == null) {
return true;
}
return evaluateGroup(context, context.conditions().entry(), tradeDate);
}
public boolean shouldExit(EvaluationContext context, LocalDate evaluationDate) {
if (!context.enabled() || context.conditions().exit() == null) {
return false;
}
return evaluateGroup(context, context.conditions().exit(), evaluationDate);
}
private AdminDtos.BacktestConditionGroupPayload normalizeGroup(AdminDtos.BacktestConditionGroupPayload payload) {
if (payload == null) {
return null;
}
List<AdminDtos.BacktestConditionNodePayload> items = payload.items() == null
? List.of()
: payload.items().stream().filter(Objects::nonNull).map(this::normalizeNode).toList();
return new AdminDtos.BacktestConditionGroupPayload(
normalizeUpper(payload.operator()),
items
);
}
private AdminDtos.BacktestConditionNodePayload normalizeNode(AdminDtos.BacktestConditionNodePayload payload) {
if (payload == null) {
throw new ValidationException("Condition node is required");
}
boolean hasRule = payload.rule() != null;
boolean hasGroup = payload.group() != null;
if (hasRule == hasGroup) {
throw new ValidationException("Condition node must contain either a rule or a group");
}
return new AdminDtos.BacktestConditionNodePayload(
hasRule ? normalizeRule(payload.rule()) : null,
hasGroup ? normalizeGroup(payload.group()) : null
);
}
private AdminDtos.BacktestConditionRulePayload normalizeRule(AdminDtos.BacktestConditionRulePayload payload) {
if (payload == null) {
throw new ValidationException("Condition rule is required");
}
return new AdminDtos.BacktestConditionRulePayload(
normalizeLower(payload.timeframeUnit()),
payload.timeframeInterval(),
normalizeOperand(payload.left()),
normalizeUpper(payload.comparator()),
normalizeOperand(payload.right())
);
}
private AdminDtos.BacktestConditionOperandPayload normalizeOperand(AdminDtos.BacktestConditionOperandPayload payload) {
if (payload == null) {
throw new ValidationException("Condition operand is required");
}
String kind = normalizeUpper(payload.kind());
if ("FIELD".equals(kind)) {
return new AdminDtos.BacktestConditionOperandPayload(
kind,
normalizeUpper(payload.source()),
normalizeText(payload.field()),
null,
null
);
}
return new AdminDtos.BacktestConditionOperandPayload(
kind,
null,
null,
normalizeText(payload.value()),
normalizeUpper(payload.valueType())
);
}
private void validateGroup(AdminDtos.BacktestConditionGroupPayload group, String path) {
if (!ALLOWED_GROUP_OPERATORS.contains(group.operator())) {
throw new ValidationException(path + ".operator must be AND or OR");
}
if (group.items() == null || group.items().isEmpty()) {
throw new ValidationException(path + ".items must contain at least one condition");
}
if (group.items().size() > 12) {
throw new ValidationException(path + ".items exceeds the maximum supported nested conditions");
}
for (int index = 0; index < group.items().size(); index += 1) {
AdminDtos.BacktestConditionNodePayload node = group.items().get(index);
if (node.rule() != null) {
validateRule(node.rule(), path + ".items[" + index + "]");
} else if (node.group() != null) {
validateGroup(node.group(), path + ".items[" + index + "]");
} else {
throw new ValidationException(path + ".items[" + index + "] must contain a rule or group");
}
}
}
private void validateRule(AdminDtos.BacktestConditionRulePayload rule, String path) {
if (!ALLOWED_TIMEFRAME_UNITS.contains(rule.timeframeUnit())) {
throw new ValidationException(path + ".timeframeUnit is unsupported");
}
if (rule.timeframeInterval() == null || rule.timeframeInterval() < 1 || rule.timeframeInterval() > 1440) {
throw new ValidationException(path + ".timeframeInterval must be between 1 and 1440");
}
if (!ALLOWED_COMPARATORS.contains(rule.comparator())) {
throw new ValidationException(path + ".comparator is unsupported");
}
ValueKind leftKind = validateOperand(rule.left(), path + ".left");
ValueKind rightKind = validateOperand(rule.right(), path + ".right");
if (rule.comparator().equals("CROSSES_ABOVE") || rule.comparator().equals("CROSSES_BELOW")
|| rule.comparator().equals("UP_BY") || rule.comparator().equals("DOWN_BY")
|| rule.comparator().equals("HIGHER_THAN") || rule.comparator().equals("HIGHER_THAN_EQUAL_TO")
|| rule.comparator().equals("LOWER_THAN") || rule.comparator().equals("LOWER_THAN_EQUAL_TO")) {
if (leftKind != ValueKind.NUMBER || rightKind != ValueKind.NUMBER) {
throw new ValidationException(path + ".comparator requires numeric operands");
}
}
if (rule.comparator().equals("EQUAL_TO") && leftKind != rightKind) {
if (!((leftKind == ValueKind.STRING || leftKind == ValueKind.BOOLEAN) && (rightKind == ValueKind.STRING || rightKind == ValueKind.BOOLEAN))) {
throw new ValidationException(path + ".left and right operands must be comparable");
}
}
}
private ValueKind validateOperand(AdminDtos.BacktestConditionOperandPayload operand, String path) {
if (!ALLOWED_OPERAND_KINDS.contains(operand.kind())) {
throw new ValidationException(path + ".kind must be FIELD or VALUE");
}
if ("FIELD".equals(operand.kind())) {
if (!ALLOWED_FIELD_SOURCES.contains(operand.source())) {
throw new ValidationException(path + ".source must be TRADING_SIGNAL or TRADING_DAY_PARAM");
}
FieldMetadata metadata = metadataForField(operand.source(), operand.field(), path);
return metadata.kind();
}
if (!ALLOWED_VALUE_TYPES.contains(operand.valueType())) {
throw new ValidationException(path + ".valueType is unsupported");
}
if (!StringUtils.hasText(operand.value())) {
throw new ValidationException(path + ".value is required");
}
return ValueKind.valueOf(operand.valueType());
}
private boolean evaluateGroup(EvaluationContext context, AdminDtos.BacktestConditionGroupPayload group, LocalDate tradeDate) {
List<Boolean> results = new ArrayList<>();
for (AdminDtos.BacktestConditionNodePayload node : group.items()) {
boolean result = node.rule() != null
? evaluateRule(context, node.rule(), tradeDate)
: evaluateGroup(context, node.group(), tradeDate);
results.add(result);
}
if (results.isEmpty()) {
return false;
}
if ("OR".equals(group.operator())) {
return results.stream().anyMatch(Boolean::booleanValue);
}
return results.stream().allMatch(Boolean::booleanValue);
}
private boolean evaluateRule(EvaluationContext context, AdminDtos.BacktestConditionRulePayload rule, LocalDate tradeDate) {
ResolvedValue leftCurrent = resolveOperand(context, rule, rule.left(), tradeDate, false);
ResolvedValue rightCurrent = resolveOperand(context, rule, rule.right(), tradeDate, false);
if (leftCurrent == null || rightCurrent == null) {
return false;
}
return switch (rule.comparator()) {
case "EQUAL_TO" -> equalsValue(leftCurrent, rightCurrent);
case "HIGHER_THAN" -> compareNumbers(leftCurrent, rightCurrent) > 0;
case "HIGHER_THAN_EQUAL_TO" -> compareNumbers(leftCurrent, rightCurrent) >= 0;
case "LOWER_THAN" -> compareNumbers(leftCurrent, rightCurrent) < 0;
case "LOWER_THAN_EQUAL_TO" -> compareNumbers(leftCurrent, rightCurrent) <= 0;
case "UP_BY" -> compareNumbers(leftCurrent, rightCurrent) > 0;
case "DOWN_BY" -> compareNumbers(leftCurrent, rightCurrent) < 0;
case "CROSSES_ABOVE" -> crosses(context, rule, tradeDate, true, leftCurrent, rightCurrent);
case "CROSSES_BELOW" -> crosses(context, rule, tradeDate, false, leftCurrent, rightCurrent);
default -> false;
};
}
private boolean crosses(
EvaluationContext context,
AdminDtos.BacktestConditionRulePayload rule,
LocalDate tradeDate,
boolean above,
ResolvedValue leftCurrent,
ResolvedValue rightCurrent
) {
ResolvedValue leftPrevious = resolveOperand(context, rule, rule.left(), tradeDate, true);
ResolvedValue rightPrevious = resolveOperand(context, rule, rule.right(), tradeDate, true);
if (leftPrevious == null || rightPrevious == null) {
return false;
}
int previousCompare = compareNumbers(leftPrevious, rightPrevious);
int currentCompare = compareNumbers(leftCurrent, rightCurrent);
return above ? previousCompare <= 0 && currentCompare > 0 : previousCompare >= 0 && currentCompare < 0;
}
private ResolvedValue resolveOperand(
EvaluationContext context,
AdminDtos.BacktestConditionRulePayload rule,
AdminDtos.BacktestConditionOperandPayload operand,
LocalDate tradeDate,
boolean previous
) {
if ("VALUE".equals(operand.kind())) {
return parseLiteral(operand.valueType(), operand.value());
}
if ("TRADING_SIGNAL".equals(operand.source())) {
TradingSignalEntity signal = previous
? findPreviousSignal(context, tradeDate, timeframeKey(rule.timeframeUnit(), rule.timeframeInterval()))
: findSignal(context, tradeDate, timeframeKey(rule.timeframeUnit(), rule.timeframeInterval()));
return signal == null ? null : extractSignalField(signal, operand.field());
}
TradingDayParamEntity dayParam = previous
? findPreviousDayParam(context, tradeDate)
: context.dayParamsByDate().get(tradeDate);
return dayParam == null ? null : extractDayParamField(dayParam, operand.field());
}
private TradingSignalEntity findSignal(EvaluationContext context, LocalDate tradeDate, String timeframeKey) {
Map<String, TradingSignalEntity> byTimeframe = context.signalsByDate().get(tradeDate);
if (byTimeframe == null) {
return null;
}
return byTimeframe.get(timeframeKey);
}
private TradingSignalEntity findPreviousSignal(EvaluationContext context, LocalDate tradeDate, String timeframeKey) {
for (LocalDate cursor = tradeDate.minusDays(1); !cursor.isBefore(context.minLoadedDate()); cursor = cursor.minusDays(1)) {
TradingSignalEntity signal = findSignal(context, cursor, timeframeKey);
if (signal != null) {
return signal;
}
}
return null;
}
private TradingDayParamEntity findPreviousDayParam(EvaluationContext context, LocalDate tradeDate) {
for (LocalDate cursor = tradeDate.minusDays(1); !cursor.isBefore(context.minLoadedDate()); cursor = cursor.minusDays(1)) {
TradingDayParamEntity value = context.dayParamsByDate().get(cursor);
if (value != null) {
return value;
}
}
return null;
}
private ResolvedValue extractSignalField(TradingSignalEntity entity, String field) {
return switch (field) {
case "instrumentKey" -> ResolvedValue.ofString(entity.getInstrumentKey());
case "timeframeUnit" -> ResolvedValue.ofString(entity.getTimeframeUnit());
case "timeframeInterval" -> ResolvedValue.ofNumber(BigDecimal.valueOf(entity.getTimeframeInterval()));
case "signalDate" -> ResolvedValue.ofDate(entity.getSignalDate());
case "previousClose" -> ResolvedValue.ofNumber(entity.getPreviousClose());
case "currentClose" -> ResolvedValue.ofNumber(entity.getCurrentClose());
case "dma9" -> ResolvedValue.ofNumber(entity.getDma9());
case "dma26" -> ResolvedValue.ofNumber(entity.getDma26());
case "dma110" -> ResolvedValue.ofNumber(entity.getDma110());
case "signal" -> ResolvedValue.ofString(entity.getSignal());
case "firstCandleColor" -> ResolvedValue.ofString(entity.getFirstCandleColor());
default -> null;
};
}
private ResolvedValue extractDayParamField(TradingDayParamEntity entity, String field) {
return switch (field) {
case "tradeDate" -> ResolvedValue.ofDate(entity.getTradeDate());
case "instrumentKey" -> ResolvedValue.ofString(entity.getInstrumentKey());
case "orbHigh" -> ResolvedValue.ofNumber(entity.getOrbHigh());
case "orbLow" -> ResolvedValue.ofNumber(entity.getOrbLow());
case "orbBreakout" -> ResolvedValue.ofBoolean(parseBooleanValue(entity.getOrbBreakout()));
case "orbBreakdown" -> ResolvedValue.ofBoolean(parseBooleanValue(entity.getOrbBreakdown()));
case "todayOpen" -> ResolvedValue.ofNumber(entity.getTodayOpen());
case "todayClose" -> ResolvedValue.ofNumber(entity.getTodayClose());
case "prevHigh" -> ResolvedValue.ofNumber(entity.getPrevHigh());
case "prevLow" -> ResolvedValue.ofNumber(entity.getPrevLow());
case "prevClose" -> ResolvedValue.ofNumber(entity.getPrevClose());
case "gapPct" -> ResolvedValue.ofNumber(entity.getGapPct());
case "gapType" -> ResolvedValue.ofString(entity.getGapType());
case "gapUpPct" -> ResolvedValue.ofNumber(entity.getGapUpPct());
case "gapDownPct" -> ResolvedValue.ofNumber(entity.getGapDownPct());
default -> null;
};
}
private ResolvedValue parseLiteral(String valueType, String rawValue) {
try {
return switch (valueType) {
case "NUMBER" -> ResolvedValue.ofNumber(new BigDecimal(rawValue.trim()));
case "STRING" -> ResolvedValue.ofString(rawValue.trim());
case "BOOLEAN" -> ResolvedValue.ofBoolean(parseBooleanValue(rawValue));
case "DATE" -> ResolvedValue.ofDate(LocalDate.parse(rawValue.trim()));
default -> null;
};
} catch (RuntimeException ex) {
return null;
}
}
private boolean equalsValue(ResolvedValue left, ResolvedValue right) {
if (left.kind() == ValueKind.NUMBER && right.kind() == ValueKind.NUMBER) {
return left.numberValue().compareTo(right.numberValue()) == 0;
}
if (left.kind() == ValueKind.DATE && right.kind() == ValueKind.DATE) {
return left.dateValue().isEqual(right.dateValue());
}
if (left.kind() == ValueKind.BOOLEAN && right.kind() == ValueKind.BOOLEAN) {
return left.booleanValue().equals(right.booleanValue());
}
String leftText = left.stringRepresentation();
String rightText = right.stringRepresentation();
return leftText != null && leftText.equalsIgnoreCase(rightText);
}
private int compareNumbers(ResolvedValue left, ResolvedValue right) {
if (left.numberValue() == null || right.numberValue() == null) {
return Integer.MIN_VALUE;
}
return left.numberValue().compareTo(right.numberValue());
}
private FieldMetadata metadataForField(String source, String field, String path) {
String key = source + "." + normalizeText(field);
FieldMetadata metadata = FIELD_METADATA.get(key);
if (metadata == null) {
throw new ValidationException(path + ".field is unsupported");
}
return metadata;
}
private static Map<String, FieldMetadata> buildFieldMetadata() {
Map<String, FieldMetadata> fields = new LinkedHashMap<>();
addField(fields, "TRADING_SIGNAL", "instrumentKey", ValueKind.STRING);
addField(fields, "TRADING_SIGNAL", "timeframeUnit", ValueKind.STRING);
addField(fields, "TRADING_SIGNAL", "timeframeInterval", ValueKind.NUMBER);
addField(fields, "TRADING_SIGNAL", "signalDate", ValueKind.DATE);
addField(fields, "TRADING_SIGNAL", "previousClose", ValueKind.NUMBER);
addField(fields, "TRADING_SIGNAL", "currentClose", ValueKind.NUMBER);
addField(fields, "TRADING_SIGNAL", "dma9", ValueKind.NUMBER);
addField(fields, "TRADING_SIGNAL", "dma26", ValueKind.NUMBER);
addField(fields, "TRADING_SIGNAL", "dma110", ValueKind.NUMBER);
addField(fields, "TRADING_SIGNAL", "signal", ValueKind.STRING);
addField(fields, "TRADING_SIGNAL", "firstCandleColor", ValueKind.STRING);
addField(fields, "TRADING_DAY_PARAM", "tradeDate", ValueKind.DATE);
addField(fields, "TRADING_DAY_PARAM", "instrumentKey", ValueKind.STRING);
addField(fields, "TRADING_DAY_PARAM", "orbHigh", ValueKind.NUMBER);
addField(fields, "TRADING_DAY_PARAM", "orbLow", ValueKind.NUMBER);
addField(fields, "TRADING_DAY_PARAM", "orbBreakout", ValueKind.BOOLEAN);
addField(fields, "TRADING_DAY_PARAM", "orbBreakdown", ValueKind.BOOLEAN);
addField(fields, "TRADING_DAY_PARAM", "todayOpen", ValueKind.NUMBER);
addField(fields, "TRADING_DAY_PARAM", "todayClose", ValueKind.NUMBER);
addField(fields, "TRADING_DAY_PARAM", "prevHigh", ValueKind.NUMBER);
addField(fields, "TRADING_DAY_PARAM", "prevLow", ValueKind.NUMBER);
addField(fields, "TRADING_DAY_PARAM", "prevClose", ValueKind.NUMBER);
addField(fields, "TRADING_DAY_PARAM", "gapPct", ValueKind.NUMBER);
addField(fields, "TRADING_DAY_PARAM", "gapType", ValueKind.STRING);
addField(fields, "TRADING_DAY_PARAM", "gapUpPct", ValueKind.NUMBER);
addField(fields, "TRADING_DAY_PARAM", "gapDownPct", ValueKind.NUMBER);
return Collections.unmodifiableMap(fields);
}
private static void addField(Map<String, FieldMetadata> fields, String source, String field, ValueKind kind) {
fields.put(source + "." + field, new FieldMetadata(source, field, kind));
}
private static String normalizeText(String value) {
if (!StringUtils.hasText(value)) {
return null;
}
return value.trim();
}
private static String normalizeUpper(String value) {
String normalized = normalizeText(value);
return normalized == null ? "" : normalized.toUpperCase(Locale.ROOT);
}
private static String normalizeLower(String value) {
String normalized = normalizeText(value);
return normalized == null ? "" : normalized.toLowerCase(Locale.ROOT);
}
private static String timeframeKey(String timeframeUnit, Integer timeframeInterval) {
return timeframeUnit + "|" + timeframeInterval;
}
private static Boolean parseBooleanValue(String value) {
if (!StringUtils.hasText(value)) {
return null;
}
String normalized = value.trim().toUpperCase(Locale.ROOT);
return switch (normalized) {
case "TRUE", "YES", "Y", "1", "BUY", "UP" -> Boolean.TRUE;
case "FALSE", "NO", "N", "0", "SELL", "DOWN" -> Boolean.FALSE;
default -> null;
};
}
/**
 * Evaluates entry conditions against an actual intraday candle close price.
 * Fields like currentClose/previousClose are substituted with the real candle price;
 * day-level fields (signal, dma, dayParam) are unchanged.
 * Returns true when no entry conditions are configured.
 */
public boolean evaluateIntradayEntry(EvaluationContext context, LocalDate tradeDate, BigDecimal candleClose, BigDecimal prevCandleClose) {
if (!context.enabled() || context.conditions().entry() == null) {
return true;
}
return evaluateGroupIntraday(context, context.conditions().entry(), tradeDate, candleClose, prevCandleClose);
}
/**
 * Evaluates exit conditions against an actual intraday candle close price.
 * Returns false when no exit conditions are configured.
 */
public boolean evaluateIntradayExit(EvaluationContext context, LocalDate evaluationDate, BigDecimal candleClose, BigDecimal prevCandleClose) {
if (!context.enabled() || context.conditions().exit() == null) {
return false;
}
return evaluateGroupIntraday(context, context.conditions().exit(), evaluationDate, candleClose, prevCandleClose);
}
private boolean evaluateGroupIntraday(EvaluationContext context, AdminDtos.BacktestConditionGroupPayload group, LocalDate tradeDate, BigDecimal candleClose, BigDecimal prevCandleClose) {
List<Boolean> results = new ArrayList<>();
for (AdminDtos.BacktestConditionNodePayload node : group.items()) {
boolean result = node.rule() != null
? evaluateRuleIntraday(context, node.rule(), tradeDate, candleClose, prevCandleClose)
: evaluateGroupIntraday(context, node.group(), tradeDate, candleClose, prevCandleClose);
results.add(result);
}
if (results.isEmpty()) {
return false;
}
if ("OR".equals(group.operator())) {
return results.stream().anyMatch(Boolean::booleanValue);
}
return results.stream().allMatch(Boolean::booleanValue);
}
private boolean evaluateRuleIntraday(EvaluationContext context, AdminDtos.BacktestConditionRulePayload rule, LocalDate tradeDate, BigDecimal candleClose, BigDecimal prevCandleClose) {
ResolvedValue leftCurrent = resolveOperandIntraday(context, rule, rule.left(), tradeDate, candleClose, prevCandleClose);
ResolvedValue rightCurrent = resolveOperandIntraday(context, rule, rule.right(), tradeDate, candleClose, prevCandleClose);
if (leftCurrent == null || rightCurrent == null) {
return false;
}
return switch (rule.comparator()) {
case "EQUAL_TO" -> equalsValue(leftCurrent, rightCurrent);
case "HIGHER_THAN" -> compareNumbers(leftCurrent, rightCurrent) > 0;
case "HIGHER_THAN_EQUAL_TO" -> compareNumbers(leftCurrent, rightCurrent) >= 0;
case "LOWER_THAN" -> compareNumbers(leftCurrent, rightCurrent) < 0;
case "LOWER_THAN_EQUAL_TO" -> compareNumbers(leftCurrent, rightCurrent) <= 0;
case "UP_BY" -> compareNumbers(leftCurrent, rightCurrent) > 0;
case "DOWN_BY" -> compareNumbers(leftCurrent, rightCurrent) < 0;
case "CROSSES_ABOVE" -> crossesIntraday(context, rule, tradeDate, true, leftCurrent, rightCurrent, prevCandleClose);
case "CROSSES_BELOW" -> crossesIntraday(context, rule, tradeDate, false, leftCurrent, rightCurrent, prevCandleClose);
default -> false;
};
}
private boolean crossesIntraday(EvaluationContext context, AdminDtos.BacktestConditionRulePayload rule, LocalDate tradeDate, boolean above, ResolvedValue leftCurrent, ResolvedValue rightCurrent, BigDecimal prevCandleClose) {
if (prevCandleClose == null) {
return false;
}
ResolvedValue leftPrevious = resolveOperandIntraday(context, rule, rule.left(), tradeDate, prevCandleClose, null);
ResolvedValue rightPrevious = resolveOperandIntraday(context, rule, rule.right(), tradeDate, prevCandleClose, null);
if (leftPrevious == null || rightPrevious == null) {
return false;
}
int previousCompare = compareNumbers(leftPrevious, rightPrevious);
int currentCompare = compareNumbers(leftCurrent, rightCurrent);
return above ? previousCompare <= 0 && currentCompare > 0 : previousCompare >= 0 && currentCompare < 0;
}
/**
 * Resolves an operand in intraday context: TRADING_SIGNAL.currentClose and .previousClose
 * are replaced with the actual intraday candle close; all other fields use day-level data.
 * TRADING_DAY_PARAM fields always use the current day's values (ORB, etc. don't change intraday).
 */
private ResolvedValue resolveOperandIntraday(
EvaluationContext context,
AdminDtos.BacktestConditionRulePayload rule,
AdminDtos.BacktestConditionOperandPayload operand,
LocalDate tradeDate,
BigDecimal intradayClose,
BigDecimal previousIntradayClose
) {
if ("VALUE".equals(operand.kind())) {
return parseLiteral(operand.valueType(), operand.value());
}
if ("TRADING_SIGNAL".equals(operand.source())) {
if ("currentClose".equals(operand.field())) {
return intradayClose == null ? null : ResolvedValue.ofNumber(intradayClose);
}
if ("previousClose".equals(operand.field())) {
return previousIntradayClose == null ? null : ResolvedValue.ofNumber(previousIntradayClose);
}
TradingSignalEntity signal = findSignal(context, tradeDate, timeframeKey(rule.timeframeUnit(), rule.timeframeInterval()));
return signal == null ? null : extractSignalField(signal, operand.field());
}
TradingDayParamEntity dayParam = context.dayParamsByDate().get(tradeDate);
return dayParam == null ? null : extractDayParamField(dayParam, operand.field());
}
public record EvaluationContext(
AdminDtos.BacktestAdvancedConditionsPayload conditions,
LocalDate minLoadedDate,
Map<LocalDate, Map<String, TradingSignalEntity>> signalsByDate,
Map<LocalDate, TradingDayParamEntity> dayParamsByDate
) {
static EvaluationContext disabled() {
return new EvaluationContext(
new AdminDtos.BacktestAdvancedConditionsPayload(false, null, null),
LocalDate.MIN,
Map.of(),
Map.of()
);
}
boolean enabled() {
return Boolean.TRUE.equals(conditions.enabled());
}
}
private record FieldMetadata(String source, String field, ValueKind kind) {
}
private enum ValueKind {
NUMBER,
STRING,
BOOLEAN,
DATE
}
private record ResolvedValue(
ValueKind kind,
BigDecimal numberValue,
String stringValue,
Boolean booleanValue,
LocalDate dateValue
) {
private static ResolvedValue ofNumber(BigDecimal value) {
return value == null ? null : new ResolvedValue(ValueKind.NUMBER, value, null, null, null);
}
private static ResolvedValue ofString(String value) {
return StringUtils.hasText(value) ? new ResolvedValue(ValueKind.STRING, null, value.trim(), null, null) : null;
}
private static ResolvedValue ofBoolean(Boolean value) {
return value == null ? null : new ResolvedValue(ValueKind.BOOLEAN, null, null, value, null);
}
private static ResolvedValue ofDate(LocalDate value) {
return value == null ? null : new ResolvedValue(ValueKind.DATE, null, null, null, value);
}
private String stringRepresentation() {
return switch (kind) {
case STRING -> stringValue;
case BOOLEAN -> booleanValue == null ? null : booleanValue.toString();
case DATE -> dateValue == null ? null : dateValue.toString();
case NUMBER -> numberValue == null ? null : numberValue.stripTrailingZeros().toPlainString();
};
}
}
}
