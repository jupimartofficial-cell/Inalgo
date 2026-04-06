package com.inalgo.trade.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security.rate-limit")
public record ApiRateLimitProperties(
        int apiRequestsPerSecond,
        int adminLoginPerMinute,
        int adminLoginPerHour
) {
    public ApiRateLimitProperties {
        apiRequestsPerSecond = apiRequestsPerSecond <= 0 ? 50 : apiRequestsPerSecond;
        adminLoginPerMinute = adminLoginPerMinute <= 0 ? 5 : adminLoginPerMinute;
        adminLoginPerHour = adminLoginPerHour <= 0 ? 25 : adminLoginPerHour;
    }
}
