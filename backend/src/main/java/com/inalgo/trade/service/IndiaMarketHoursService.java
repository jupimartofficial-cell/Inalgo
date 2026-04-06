package com.inalgo.trade.service;

import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Set;

@Service
public class IndiaMarketHoursService {
    private static final Set<DayOfWeek> WEEKEND = Set.of(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY);

    private final IndiaMarketHoursProperties properties;

    public IndiaMarketHoursService(IndiaMarketHoursProperties properties) {
        this.properties = properties;
    }

    public boolean isWithinBusinessWindow(Instant instant) {
        ZonedDateTime marketDateTime = instant.atZone(properties.zone());
        LocalDate marketDate = marketDateTime.toLocalDate();
        LocalTime marketTime = marketDateTime.toLocalTime();
        return isBusinessDay(marketDate)
                && !marketTime.isBefore(properties.openTime())
                && marketTime.isBefore(properties.closeTime());
    }

    public Instant alignToNextBusinessWindow(Instant instant) {
        ZonedDateTime marketDateTime = instant.atZone(properties.zone());
        LocalDate marketDate = marketDateTime.toLocalDate();
        LocalTime marketTime = marketDateTime.toLocalTime();

        if (isBusinessDay(marketDate)) {
            if (marketTime.isBefore(properties.openTime())) {
                return marketDate.atTime(properties.openTime()).atZone(properties.zone()).toInstant();
            }
            if (marketTime.isBefore(properties.closeTime())) {
                return instant;
            }
        }

        LocalDate nextBusinessDate = nextBusinessDate(marketDate.plusDays(isBusinessDay(marketDate) ? 1 : 0));
        return nextBusinessDate.atTime(properties.openTime()).atZone(properties.zone()).toInstant();
    }

    public ZoneId marketZone() {
        return properties.zone();
    }

    private LocalDate nextBusinessDate(LocalDate candidate) {
        LocalDate current = candidate;
        while (!isBusinessDay(current)) {
            current = current.plusDays(1);
        }
        return current;
    }

    private boolean isBusinessDay(LocalDate date) {
        return !WEEKEND.contains(date.getDayOfWeek()) && !properties.holidays().contains(date);
    }
}
