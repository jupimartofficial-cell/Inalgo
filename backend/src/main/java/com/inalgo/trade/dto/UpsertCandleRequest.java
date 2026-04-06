package com.inalgo.trade.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;

public record UpsertCandleRequest(
        @NotBlank @Size(max = 64) String instrumentKey,
        @NotBlank @Size(max = 16) String timeframeUnit,
        @NotNull @Min(1) @Max(1440) Integer timeframeInterval,
        @NotNull Instant candleTs,
        @NotNull @DecimalMin("0.0") BigDecimal openPrice,
        @NotNull @DecimalMin("0.0") BigDecimal highPrice,
        @NotNull @DecimalMin("0.0") BigDecimal lowPrice,
        @NotNull @DecimalMin("0.0") BigDecimal closePrice,
        @PositiveOrZero Long volume
) {
}
