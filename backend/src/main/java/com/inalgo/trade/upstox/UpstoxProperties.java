package com.inalgo.trade.upstox;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "upstox")
public record UpstoxProperties(
        @NotBlank String baseUrl,
        @NotBlank String orderBaseUrl
) {
}
