package com.inalgo.trade.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.BacktestStrategyEntity;
import com.inalgo.trade.repository.BacktestStrategyRepository;
import jakarta.validation.ValidationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

/**
 * Owns CRUD plus validation for saved backtest strategies.
 * The stored JSON is normalized before persistence so the run engine always receives a predictable contract.
 */
@Service
public class BacktestStrategyService {
    private static final Set<String> ALLOWED_UNDERLYING_SOURCES = Set.of("CASH", "FUTURES");
    private static final Set<String> ALLOWED_STRATEGY_TYPES = Set.of("INTRADAY", "BTST", "POSITIONAL");
    private static final Set<String> ALLOWED_SEGMENTS = Set.of("OPTIONS", "FUTURES");
    private static final Set<String> ALLOWED_POSITIONS = Set.of("BUY", "SELL");
    private static final Set<String> ALLOWED_OPTION_TYPES = Set.of("CALL", "PUT");
    private static final Set<String> ALLOWED_EXPIRY_TYPES = Set.of("WEEKLY", "MONTHLY");
    private static final Set<String> ALLOWED_STRIKE_TYPES = Set.of("ATM", "ITM", "OTM");
    private static final Set<String> ALLOWED_SQUARE_OFF_MODES = Set.of("PARTIAL", "COMPLETE");
    private static final Set<String> ALLOWED_TRAIL_SCOPES = Set.of("ALL_LEGS", "SL_LEGS");

    private final BacktestStrategyRepository backtestStrategyRepository;
    private final BacktestConditionService backtestConditionService;
    private final ObjectMapper objectMapper;

    public BacktestStrategyService(
            BacktestStrategyRepository backtestStrategyRepository,
            BacktestConditionService backtestConditionService,
            ObjectMapper objectMapper
    ) {
        this.backtestStrategyRepository = backtestStrategyRepository;
        this.backtestConditionService = backtestConditionService;
        this.objectMapper = objectMapper;
    }

    public Page<AdminDtos.BacktestStrategyResponse> listStrategies(
            String tenantId,
            String username,
            Integer page,
            Integer size
    ) {
        String normalizedUsername = requireUsername(username);
        int boundedSize = Math.min(Math.max(size == null ? 10 : size, 1), 500);
        int boundedPage = Math.max(page == null ? 0 : page, 0);
        return backtestStrategyRepository
                .findAllByTenantIdAndUsernameOrderByUpdatedAtDesc(
                        tenantId,
                        normalizedUsername,
                        PageRequest.of(boundedPage, boundedSize)
                )
                .map(this::toResponse);
    }

    public AdminDtos.BacktestStrategyResponse createStrategy(
            String tenantId,
            AdminDtos.BacktestStrategySaveRequest request
    ) {
        String normalizedUsername = requireUsername(request.username());
        AdminDtos.BacktestStrategyPayload normalizedStrategy = normalizeStrategyPayload(request.strategy());
        validateStrategyPayload(normalizedStrategy);

        BacktestStrategyEntity entity = new BacktestStrategyEntity(
                tenantId,
                normalizedUsername,
                normalizedStrategy.strategyName(),
                normalizedStrategy.underlyingKey(),
                normalizedStrategy.underlyingSource(),
                normalizedStrategy.strategyType(),
                normalizedStrategy.startDate(),
                normalizedStrategy.endDate(),
                normalizedStrategy.entryTime(),
                normalizedStrategy.exitTime(),
                normalizedStrategy.legs().size(),
                serializePayload(normalizedStrategy)
        );

        try {
            return toResponse(backtestStrategyRepository.save(entity));
        } catch (DataIntegrityViolationException ex) {
            throw new ValidationException("Strategy name already exists for this user");
        }
    }

    public AdminDtos.BacktestStrategyResponse updateStrategy(
            String tenantId,
            Long strategyId,
            AdminDtos.BacktestStrategySaveRequest request
    ) {
        String normalizedUsername = requireUsername(request.username());
        AdminDtos.BacktestStrategyPayload normalizedStrategy = normalizeStrategyPayload(request.strategy());
        validateStrategyPayload(normalizedStrategy);

        BacktestStrategyEntity entity = backtestStrategyRepository.findByIdAndTenantId(strategyId, tenantId)
                .orElseThrow(() -> new ValidationException("Backtest strategy was not found"));

        if (!normalizedUsername.equals(entity.getUsername())) {
            throw new ValidationException("Strategy belongs to another user");
        }

        entity.setStrategyName(normalizedStrategy.strategyName());
        entity.setUnderlyingKey(normalizedStrategy.underlyingKey());
        entity.setUnderlyingSource(normalizedStrategy.underlyingSource());
        entity.setStrategyType(normalizedStrategy.strategyType());
        entity.setStartDate(normalizedStrategy.startDate());
        entity.setEndDate(normalizedStrategy.endDate());
        entity.setEntryTime(normalizedStrategy.entryTime());
        entity.setExitTime(normalizedStrategy.exitTime());
        entity.setLegsCount(normalizedStrategy.legs().size());
        entity.setStrategyJson(serializePayload(normalizedStrategy));

        try {
            return toResponse(backtestStrategyRepository.save(entity));
        } catch (DataIntegrityViolationException ex) {
            throw new ValidationException("Strategy name already exists for this user");
        }
    }

    public AdminDtos.BacktestStrategyDeleteResponse deleteStrategy(String tenantId, Long strategyId, String username) {
        String normalizedUsername = requireUsername(username);
        BacktestStrategyEntity entity = backtestStrategyRepository.findByIdAndTenantId(strategyId, tenantId)
                .orElseThrow(() -> new ValidationException("Backtest strategy was not found"));
        if (!normalizedUsername.equals(entity.getUsername())) {
            throw new ValidationException("Strategy belongs to another user");
        }
        backtestStrategyRepository.delete(entity);
        return new AdminDtos.BacktestStrategyDeleteResponse("DELETED", strategyId);
    }

    /**
     * Normalizes user input into the exact shape expected by persistence and by the run engine.
     */
    public AdminDtos.BacktestStrategyPayload normalizeStrategyPayload(AdminDtos.BacktestStrategyPayload payload) {
        if (payload == null) {
            throw new ValidationException("strategy is required");
        }
        return new AdminDtos.BacktestStrategyPayload(
                requireText(payload.strategyName(), "strategyName", 120),
                requireText(payload.underlyingKey(), "underlyingKey", 128),
                normalizeUpper(payload.underlyingSource()),
                normalizeUpper(payload.strategyType()),
                payload.entryTime(),
                payload.exitTime(),
                payload.startDate(),
                payload.endDate(),
                normalizeLegs(payload.legs()),
                normalizeLegwiseSettings(payload.legwiseSettings()),
                normalizeOverallSettings(payload.overallSettings()),
                backtestConditionService.normalizeAdvancedConditions(payload.advancedConditions())
        );
    }

    private List<AdminDtos.BacktestLegPayload> normalizeLegs(List<AdminDtos.BacktestLegPayload> legs) {
        if (legs == null || legs.isEmpty()) {
            throw new ValidationException("At least one leg is required");
        }
        return legs.stream().map(this::normalizeLeg).toList();
    }

    private AdminDtos.BacktestLegPayload normalizeLeg(AdminDtos.BacktestLegPayload leg) {
        if (leg == null) {
            throw new ValidationException("leg is required");
        }
        return new AdminDtos.BacktestLegPayload(
                requireText(leg.id(), "leg.id", 64),
                normalizeUpper(leg.segment()),
                leg.lots(),
                normalizeUpper(leg.position()),
                leg.optionType() == null ? null : normalizeUpper(leg.optionType()),
                normalizeUpper(leg.expiryType()),
                normalizeUpper(leg.strikeType()),
                leg.strikeSteps() == null ? 0 : leg.strikeSteps(),
                leg.legConditions()
        );
    }

    private AdminDtos.BacktestLegwiseSettingsPayload normalizeLegwiseSettings(
            AdminDtos.BacktestLegwiseSettingsPayload payload
    ) {
        if (payload == null) {
            throw new ValidationException("legwiseSettings are required");
        }
        return new AdminDtos.BacktestLegwiseSettingsPayload(
                normalizeUpper(payload.squareOffMode()),
                payload.trailSlToBreakEven(),
                normalizeUpper(payload.trailScope()),
                payload.noReEntryAfterEnabled(),
                payload.noReEntryAfterTime(),
                payload.overallMomentumEnabled(),
                payload.overallMomentumMode() == null ? null : payload.overallMomentumMode().trim(),
                normalizeDecimal(payload.overallMomentumValue())
        );
    }

    private AdminDtos.BacktestOverallSettingsPayload normalizeOverallSettings(
            AdminDtos.BacktestOverallSettingsPayload payload
    ) {
        if (payload == null) {
            throw new ValidationException("overallSettings are required");
        }
        return new AdminDtos.BacktestOverallSettingsPayload(
                payload.stopLossEnabled(),
                payload.stopLossMode() == null ? null : payload.stopLossMode().trim(),
                normalizeDecimal(payload.stopLossValue()),
                payload.targetEnabled(),
                payload.targetMode() == null ? null : payload.targetMode().trim(),
                normalizeDecimal(payload.targetValue()),
                payload.trailingEnabled(),
                payload.trailingMode() == null ? null : payload.trailingMode().trim(),
                normalizeDecimal(payload.trailingTrigger()),
                normalizeDecimal(payload.trailingLockProfit())
        );
    }

    /**
     * Enforces the current backtest feature contract before the strategy is stored or executed.
     */
    public void validateStrategyPayload(AdminDtos.BacktestStrategyPayload payload) {
        if (!ALLOWED_UNDERLYING_SOURCES.contains(payload.underlyingSource())) {
            throw new ValidationException("underlyingSource must be CASH or FUTURES");
        }
        if (!ALLOWED_STRATEGY_TYPES.contains(payload.strategyType())) {
            throw new ValidationException("strategyType must be INTRADAY, BTST, or POSITIONAL");
        }
        if (payload.startDate().isAfter(payload.endDate())) {
            throw new ValidationException("startDate must be on or before endDate");
        }
        if (!"POSITIONAL".equals(payload.strategyType()) && !payload.exitTime().isAfter(payload.entryTime())) {
            throw new ValidationException("exitTime must be later than entryTime for intraday and BTST strategies");
        }
        if (payload.legs().size() > 10) {
            throw new ValidationException("A maximum of 10 legs is allowed");
        }
        for (AdminDtos.BacktestLegPayload leg : payload.legs()) {
            if (!ALLOWED_SEGMENTS.contains(leg.segment())) {
                throw new ValidationException("leg.segment must be OPTIONS or FUTURES");
            }
            if (!ALLOWED_POSITIONS.contains(leg.position())) {
                throw new ValidationException("leg.position must be BUY or SELL");
            }
            if (!ALLOWED_EXPIRY_TYPES.contains(leg.expiryType())) {
                throw new ValidationException("leg.expiryType must be WEEKLY or MONTHLY");
            }
            if (!ALLOWED_STRIKE_TYPES.contains(leg.strikeType())) {
                throw new ValidationException("leg.strikeType must be ATM, ITM, or OTM");
            }
            if ("OPTIONS".equals(leg.segment()) && !ALLOWED_OPTION_TYPES.contains(leg.optionType())) {
                throw new ValidationException("Options legs require optionType CALL or PUT");
            }
            if ("FUTURES".equals(leg.segment()) && StringUtils.hasText(leg.optionType())) {
                throw new ValidationException("Futures legs must not set optionType");
            }
        }
        if (!ALLOWED_SQUARE_OFF_MODES.contains(payload.legwiseSettings().squareOffMode())) {
            throw new ValidationException("squareOffMode must be PARTIAL or COMPLETE");
        }
        if (!ALLOWED_TRAIL_SCOPES.contains(payload.legwiseSettings().trailScope())) {
            throw new ValidationException("trailScope must be ALL_LEGS or SL_LEGS");
        }
        if (Boolean.TRUE.equals(payload.overallSettings().stopLossEnabled())) {
            if (payload.overallSettings().stopLossValue() == null
                    || payload.overallSettings().stopLossValue().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ValidationException("stopLossValue must be greater than zero when stop loss is enabled");
            }
        }
        if (Boolean.TRUE.equals(payload.overallSettings().targetEnabled())) {
            if (payload.overallSettings().targetValue() == null
                    || payload.overallSettings().targetValue().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ValidationException("targetValue must be greater than zero when target is enabled");
            }
        }
        if (Boolean.TRUE.equals(payload.overallSettings().trailingEnabled())) {
            if (payload.overallSettings().trailingTrigger() == null
                    || payload.overallSettings().trailingTrigger().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ValidationException("trailingTrigger must be greater than zero when trailing stop loss is enabled");
            }
        }
        backtestConditionService.validateAdvancedConditions(payload.advancedConditions());
    }

    private AdminDtos.BacktestStrategyResponse toResponse(BacktestStrategyEntity entity) {
        try {
            AdminDtos.BacktestStrategyPayload payload = objectMapper.readValue(
                    entity.getStrategyJson(),
                    AdminDtos.BacktestStrategyPayload.class
            );
            AdminDtos.BacktestStrategyPayload normalizedPayload = normalizeStrategyPayload(payload);
            validateStrategyPayload(normalizedPayload);
            return new AdminDtos.BacktestStrategyResponse(
                    entity.getId(),
                    entity.getUsername(),
                    entity.getStrategyName(),
                    entity.getUnderlyingKey(),
                    entity.getUnderlyingSource(),
                    entity.getStrategyType(),
                    entity.getStartDate(),
                    entity.getEndDate(),
                    entity.getEntryTime(),
                    entity.getExitTime(),
                    entity.getLegsCount(),
                    normalizedPayload,
                    entity.getCreatedAt(),
                    entity.getUpdatedAt()
            );
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Stored backtest strategy is invalid");
        }
    }

    private String serializePayload(AdminDtos.BacktestStrategyPayload payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Unable to serialize backtest strategy");
        }
    }

    private String requireUsername(String username) {
        return requireText(username, "username", 64);
    }

    private String requireText(String value, String fieldName, int maxLength) {
        if (!StringUtils.hasText(value)) {
            throw new ValidationException(fieldName + " is required");
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new ValidationException(fieldName + " exceeds max length");
        }
        return normalized;
    }

    private String normalizeUpper(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.trim().toUpperCase();
    }

    private BigDecimal normalizeDecimal(BigDecimal value) {
        return value == null ? null : value.stripTrailingZeros();
    }
}
