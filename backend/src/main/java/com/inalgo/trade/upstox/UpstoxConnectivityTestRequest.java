package com.inalgo.trade.upstox;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.time.LocalDate;
import java.util.List;

public record UpstoxConnectivityTestRequest(
        @NotEmpty List<@NotBlank String> instrumentKeys,
        @NotEmpty List<@NotBlank String> intervals,
        LocalDate historicalFromDate,
        LocalDate historicalToDate,
        @Min(1) @Max(50) Integer maxSamplesPerType
) {
}
