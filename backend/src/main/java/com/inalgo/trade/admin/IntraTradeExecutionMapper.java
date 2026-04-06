package com.inalgo.trade.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.IntraTradeExecutionEntity;
import jakarta.validation.ValidationException;

final class IntraTradeExecutionMapper {

    private final ObjectMapper objectMapper;

    IntraTradeExecutionMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Unable to serialize Intra Trade payload");
        }
    }

    <T> T deserialize(String json, Class<T> type, String message) {
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException ex) {
            throw new ValidationException(message);
        }
    }

    IntraTradeDtos.IntraTradeExecutionSummary toSummary(IntraTradeExecutionEntity entity) {
        return new IntraTradeDtos.IntraTradeExecutionSummary(
                entity.getId(),
                entity.getUsername(),
                entity.getStrategyId(),
                entity.getMode(),
                entity.getStatus(),
                entity.getStrategyName(),
                entity.getScanInstrumentKey(),
                entity.getScanTimeframeUnit(),
                entity.getScanTimeframeInterval(),
                entity.getTotalPnl(),
                entity.getExecutedTrades(),
                entity.getEvaluatedAt(),
                entity.getStatusMessage(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    IntraTradeDtos.IntraTradeExecutionResponse toResponse(
            IntraTradeExecutionEntity entity,
            AdminDtos.BacktestStrategyPayload strategy,
            AdminDtos.BacktestRunResponse result
    ) {
        return new IntraTradeDtos.IntraTradeExecutionResponse(
                entity.getId(),
                entity.getUsername(),
                entity.getStrategyId(),
                entity.getMode(),
                entity.getStatus(),
                entity.getStrategyName(),
                entity.getScanInstrumentKey(),
                entity.getScanTimeframeUnit(),
                entity.getScanTimeframeInterval(),
                entity.getStatusMessage(),
                entity.getEvaluatedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                strategy,
                result
        );
    }
}
