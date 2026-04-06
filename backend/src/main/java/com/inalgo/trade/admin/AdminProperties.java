package com.inalgo.trade.admin;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "admin")
public record AdminProperties(
        long sessionMinutes
) {
    public AdminProperties {
        if (sessionMinutes <= 0) {
            sessionMinutes = 360;
        }
    }
}
