package com.inalgo.trade.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

@ConfigurationProperties(prefix = "market.hours")
public record IndiaMarketHoursProperties(
        String zoneId,
        LocalTime openTime,
        LocalTime closeTime,
        List<LocalDate> holidays
) {
    public IndiaMarketHoursProperties {
        zoneId = (zoneId == null || zoneId.isBlank()) ? "Asia/Kolkata" : zoneId.trim();
        openTime = openTime == null ? LocalTime.of(9, 15) : openTime;
        closeTime = closeTime == null ? LocalTime.of(16, 0) : closeTime;
        holidays = holidays == null ? List.of() : List.copyOf(holidays);
        if (!openTime.isBefore(closeTime)) {
            throw new IllegalArgumentException("market.hours.open-time must be earlier than market.hours.close-time");
        }
    }

    public ZoneId zone() {
        return ZoneId.of(zoneId);
    }
}
