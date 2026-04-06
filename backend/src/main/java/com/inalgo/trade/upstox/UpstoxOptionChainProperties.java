package com.inalgo.trade.upstox;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.List;

@Validated
@ConfigurationProperties(prefix = "upstox.option-chain")
public record UpstoxOptionChainProperties(
        boolean enabled,
        @NotBlank String tenantId,
        @Min(15) @Max(3600) int refreshSeconds,
        @Min(1) @Max(12) int maxExpiriesPerUnderlying,
        List<@NotBlank String> underlyings
) {
}
