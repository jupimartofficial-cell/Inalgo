package com.inalgo.trade.controller;

import com.inalgo.trade.dto.CandleResponse;
import com.inalgo.trade.dto.UpsertCandleRequest;
import com.inalgo.trade.service.CandleService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

/**
 * Candle APIs exposed to tenant-scoped clients.
 * <p>
 * Controller responsibilities are intentionally kept small so that AI agents can
 * reason about the flow quickly:
 * validate/collect HTTP input, delegate business logic to {@link CandleService},
 * and return DTOs.
 */
@Validated
@RestController
@RequestMapping("/api/v1/candles")
public class CandleController {
    private final CandleService candleService;

    public CandleController(CandleService candleService) {
        this.candleService = candleService;
    }

    /**
     * Idempotently creates or updates a candle for the active tenant.
     */
    @PostMapping
    public CandleResponse upsert(@Valid @RequestBody UpsertCandleRequest request) {
        return candleService.upsertCandle(request);
    }

    /**
     * Returns candle data in ascending timestamp order for a strict time range.
     */
    @GetMapping
    public Page<CandleResponse> list(
            @RequestParam @NotBlank String instrumentKey,
            @RequestParam @NotBlank String timeframeUnit,
            @RequestParam @Min(1) @Max(1440) Integer timeframeInterval,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "200") @Min(1) @Max(500) Integer size
    ) {
        return candleService.fetchCandles(instrumentKey, timeframeUnit, timeframeInterval, from, to, page, size);
    }

    /**
     * Returns historical candles with optional filters, ordered by newest first.
     */
    @GetMapping("/history")
    public Page<CandleResponse> history(
            @RequestParam(required = false) String instrumentKey,
            @RequestParam(required = false) String timeframeUnit,
            @RequestParam(required = false) @Min(1) @Max(1440) Integer timeframeInterval,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "candleTs") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "200") @Min(1) @Max(500) Integer size
    ) {
        return candleService.fetchHistoricalData(instrumentKey, timeframeUnit, timeframeInterval, from, to, sortBy, sortDirection, page, size);
    }
}
