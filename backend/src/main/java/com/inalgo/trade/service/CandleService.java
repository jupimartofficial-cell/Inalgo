package com.inalgo.trade.service;

import com.inalgo.trade.dto.CandleResponse;
import com.inalgo.trade.dto.UpsertCandleRequest;
import com.inalgo.trade.entity.CandleEntity;
import com.inalgo.trade.repository.CandleRepository;
import com.inalgo.trade.security.TenantContext;
import jakarta.validation.ValidationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Domain service for tenant-scoped candle operations.
 * <p>
 * Design note for multi-agent development: all domain rules (validation, pagination
 * bounds, tenant enforcement) are centralized here so different AI agents can reuse
 * one canonical workflow instead of duplicating logic in controllers/jobs.
 */
@Service
public class CandleService {
    private final CandleRepository candleRepository;

    public CandleService(CandleRepository candleRepository) {
        this.candleRepository = candleRepository;
    }

    /**
     * Validates and idempotently upserts one candle row for the active tenant.
     */
    @Transactional
    public CandleResponse upsertCandle(UpsertCandleRequest request) {
        validateCandle(request);

        String tenantId = requireTenantId();
        try {
            candleRepository.upsert(
                    tenantId,
                    request.instrumentKey(),
                    request.timeframeUnit(),
                    request.timeframeInterval(),
                    request.candleTs(),
                    request.openPrice(),
                    request.highPrice(),
                    request.lowPrice(),
                    request.closePrice(),
                    request.volume()
            );
        } catch (DataIntegrityViolationException ex) {
            throw new ValidationException("Candle data violates database constraints");
        }

        return CandleResponse.fromValues(
                request.instrumentKey(),
                request.timeframeUnit(),
                request.timeframeInterval(),
                request.candleTs(),
                request.openPrice(),
                request.highPrice(),
                request.lowPrice(),
                request.closePrice(),
                request.volume()
        );
    }

    /**
     * Fetches candles for an exact stream key within a required [from, to) window.
     */
    @Transactional(readOnly = true)
    public Page<CandleResponse> fetchCandles(
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            Instant from,
            Instant to,
            Integer page,
            Integer size
    ) {
        int boundedSize = Math.min(Math.max(size, 1), 500);
        if (!from.isBefore(to)) {
            throw new ValidationException("from must be earlier than to");
        }
        PageRequest pageable = PageRequest.of(Math.max(page, 0), boundedSize, Sort.by("candleTs").ascending());
        return candleRepository.findByTenantIdAndInstrumentKeyAndTimeframeUnitAndTimeframeIntervalAndCandleTsBetween(
                requireTenantId(),
                instrumentKey,
                timeframeUnit,
                timeframeInterval,
                from,
                to,
                pageable
        ).map(CandleResponse::fromEntity);
    }

    /**
     * Fetches historical candles with optional filters for admin exploration.
     */
    @Transactional(readOnly = true)
    public Page<CandleResponse> fetchHistoricalData(
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            Instant from,
            Instant to,
            String sortBy,
            String sortDirection,
            Integer page,
            Integer size
    ) {
        int boundedSize = Math.min(Math.max(size, 1), 500);
        validateTimeRange(from, to);
        Sort sort = resolveSort(sortBy, sortDirection);
        PageRequest pageable = PageRequest.of(Math.max(page, 0), boundedSize, sort);
        String tenantId = requireTenantId();
        String normalizedInstrumentKey = normalizeFilter(instrumentKey);
        String normalizedTimeframeUnit = normalizeFilter(timeframeUnit);

        Specification<CandleEntity> specification = (root, query, cb) -> {
            var predicate = cb.equal(root.get("tenantId"), tenantId);
            if (normalizedInstrumentKey != null) {
                predicate = cb.and(predicate, cb.equal(root.get("instrumentKey"), normalizedInstrumentKey));
            }
            if (normalizedTimeframeUnit != null) {
                predicate = cb.and(predicate, cb.equal(root.get("timeframeUnit"), normalizedTimeframeUnit));
            }
            if (timeframeInterval != null) {
                predicate = cb.and(predicate, cb.equal(root.get("timeframeInterval"), timeframeInterval));
            }
            if (from != null) {
                predicate = cb.and(predicate, cb.greaterThanOrEqualTo(root.get("candleTs"), from));
            }
            if (to != null) {
                predicate = cb.and(predicate, cb.lessThanOrEqualTo(root.get("candleTs"), to));
            }
            return predicate;
        };

        return candleRepository.findAll(specification, pageable).map(CandleResponse::fromEntity);
    }


    private Sort resolveSort(String sortBy, String sortDirection) {
        String normalizedSortBy = normalizeFilter(sortBy);
        String field = switch (normalizedSortBy == null ? "candlets" : normalizedSortBy.toLowerCase()) {
            case "candlets" -> "candleTs";
            case "openprice" -> "openPrice";
            case "highprice" -> "highPrice";
            case "lowprice" -> "lowPrice";
            case "closeprice" -> "closePrice";
            case "volume" -> "volume";
            default -> throw new ValidationException("Unsupported sortBy value");
        };
        String dir = normalizeFilter(sortDirection);
        Sort.Direction direction = (dir == null || dir.equalsIgnoreCase("desc"))
                ? Sort.Direction.DESC
                : dir.equalsIgnoreCase("asc")
                ? Sort.Direction.ASC
                : null;
        if (direction == null) {
            throw new ValidationException("Unsupported sortDirection value");
        }
        return Sort.by(direction, field);
    }

    /**
     * Protects the backend from expensive, unbounded historical scans.
     */
    private void validateTimeRange(Instant from, Instant to) {
        if (from == null || to == null) {
            return;
        }
        if (!from.isBefore(to)) {
            throw new ValidationException("from must be earlier than to");
        }
        if (ChronoUnit.DAYS.between(from, to) > 3660) {
            throw new ValidationException("Requested time range is too large");
        }
    }

    /**
     * Normalizes optional query filters so blank strings behave like no filter.
     */
    private String normalizeFilter(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    /**
     * Reads tenant context set by {@code TenantHeaderFilter}; fails fast if missing.
     */
    private String requireTenantId() {
        String tenantId = TenantContext.getTenantId();
        if (!StringUtils.hasText(tenantId)) {
            throw new ValidationException("Missing tenant context");
        }
        return tenantId;
    }

    /**
     * Applies OHLC integrity rules before data reaches the persistence layer.
     */
    private void validateCandle(UpsertCandleRequest request) {
        BigDecimal high = request.highPrice();
        BigDecimal low = request.lowPrice();
        if (low.compareTo(high) > 0) {
            throw new ValidationException("lowPrice cannot be greater than highPrice");
        }
        if (request.openPrice().compareTo(low) < 0 || request.openPrice().compareTo(high) > 0) {
            throw new ValidationException("openPrice must be within [lowPrice, highPrice]");
        }
        if (request.closePrice().compareTo(low) < 0 || request.closePrice().compareTo(high) > 0) {
            throw new ValidationException("closePrice must be within [lowPrice, highPrice]");
        }
    }
}
