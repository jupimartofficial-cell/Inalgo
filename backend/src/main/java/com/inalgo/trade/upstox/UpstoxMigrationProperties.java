package com.inalgo.trade.upstox;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.LocalDate;
import java.util.List;

@Validated
@ConfigurationProperties(prefix = "upstox.migration")
public record UpstoxMigrationProperties(
        boolean enabled,
        String cron,
        @Min(2) @Max(5) int intradayWindowDays,
        @Min(2) @Max(5) int intradayMinWindowDays,
        @Min(1) @Max(365) int longWindowDays,
        List<@Valid StreamConfig> streams
) {
    public record StreamConfig(
            @NotBlank String tenantId,
            @NotBlank String instrumentKey,
            @NotBlank String interval,
            @NotNull LocalDate bootstrapFromDate
    ) {
    }
}
