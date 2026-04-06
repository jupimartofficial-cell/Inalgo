package com.inalgo.trade.admin;

import com.inalgo.trade.service.IndiaMarketHoursProperties;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;

final class IntraTradeScanWindowResolver {

    private final IndiaMarketHoursProperties marketHoursProperties;

    IntraTradeScanWindowResolver(IndiaMarketHoursProperties marketHoursProperties) {
        this.marketHoursProperties = marketHoursProperties;
    }

    LiveScanWindow resolve(LocalDateTime marketNow, LocalTime strategyEntryTime, LocalTime strategyExitTime, int scanIntervalMinutes) {
        LocalDate tradeDate = marketNow.toLocalDate();
        if (!isBusinessDay(tradeDate)) {
            return LiveScanWindow.waitingForNextTradingDay(tradeDate);
        }

        LocalTime currentTime = marketNow.toLocalTime();
        LocalTime marketOpen = marketHoursProperties.openTime();
        LocalTime marketClose = marketHoursProperties.closeTime();
        LocalTime effectiveEntryTime = strategyEntryTime.isBefore(marketOpen)
                ? marketOpen
                : strategyEntryTime.truncatedTo(ChronoUnit.MINUTES);
        if (currentTime.isBefore(effectiveEntryTime)) {
            return LiveScanWindow.waitingForEntryWindow(tradeDate);
        }

        LocalTime alignedEntryTime = alignEntryTime(effectiveEntryTime, scanIntervalMinutes);
        LocalTime effectiveExitTime = strategyExitTime.isAfter(marketClose)
                ? marketClose
                : strategyExitTime.truncatedTo(ChronoUnit.MINUTES);
        LocalTime alignedExitTime = alignExitTime(currentTime, effectiveExitTime, scanIntervalMinutes);
        if (alignedExitTime == null || !alignedExitTime.isAfter(alignedEntryTime)) {
            return LiveScanWindow.waitingForScanCandle(tradeDate, alignedEntryTime);
        }

        return LiveScanWindow.ready(tradeDate, alignedEntryTime, alignedExitTime);
    }

    private LocalTime alignEntryTime(LocalTime entryTime, int scanIntervalMinutes) {
        LocalTime marketOpen = marketHoursProperties.openTime();
        if (!entryTime.isAfter(marketOpen)) {
            return marketOpen;
        }
        int minutesFromOpen = (int) java.time.Duration.between(marketOpen, entryTime).toMinutes();
        int remainder = minutesFromOpen % scanIntervalMinutes;
        if (remainder == 0) {
            return entryTime;
        }
        return entryTime.plusMinutes(scanIntervalMinutes - remainder).withSecond(0).withNano(0);
    }

    private LocalTime alignExitTime(LocalTime currentTime, LocalTime strategyExitTime, int scanIntervalMinutes) {
        LocalTime marketOpen = marketHoursProperties.openTime();
        LocalTime cappedTime = currentTime.isAfter(strategyExitTime) ? strategyExitTime : currentTime;
        if (!cappedTime.isAfter(marketOpen)) {
            return null;
        }
        int minutesFromOpen = (int) java.time.Duration.between(marketOpen, cappedTime).toMinutes();
        int completedBuckets = minutesFromOpen / scanIntervalMinutes;
        if (completedBuckets <= 0) {
            return null;
        }
        return marketOpen.plusMinutes((long) completedBuckets * scanIntervalMinutes).withSecond(0).withNano(0);
    }

    record LiveScanWindow(
            LocalDate tradeDate,
            LocalTime alignedEntryTime,
            LocalTime alignedExitTime,
            WaitingReason waitingReason
    ) {
        static LiveScanWindow waitingForNextTradingDay(LocalDate tradeDate) {
            return new LiveScanWindow(tradeDate, null, null, WaitingReason.NEXT_TRADING_DAY);
        }

        static LiveScanWindow waitingForEntryWindow(LocalDate tradeDate) {
            return new LiveScanWindow(tradeDate, null, null, WaitingReason.ENTRY_WINDOW);
        }

        static LiveScanWindow waitingForScanCandle(LocalDate tradeDate, LocalTime alignedEntryTime) {
            return new LiveScanWindow(tradeDate, alignedEntryTime, null, WaitingReason.SCAN_CANDLE);
        }

        static LiveScanWindow ready(LocalDate tradeDate, LocalTime alignedEntryTime, LocalTime alignedExitTime) {
            return new LiveScanWindow(tradeDate, alignedEntryTime, alignedExitTime, null);
        }

        boolean ready() {
            return waitingReason == null;
        }
    }

    /**
     * Returns the next candle boundary strictly after {@code afterTime}, aligned to the
     * candle grid rooted at market open.  Use this to find the earliest re-entry slot
     * after an intraday stop-loss or target exit.
     */
    LocalTime nextCandleBoundaryAfter(LocalTime afterTime, int intervalMinutes) {
        LocalTime marketOpen = marketHoursProperties.openTime();
        if (!afterTime.isAfter(marketOpen)) {
            return marketOpen;
        }
        int minutesFromOpen = (int) java.time.Duration.between(marketOpen, afterTime).toMinutes();
        int nextBucket = (minutesFromOpen / intervalMinutes) + 1;
        return marketOpen.plusMinutes((long) nextBucket * intervalMinutes).withSecond(0).withNano(0);
    }

    private boolean isBusinessDay(LocalDate tradeDate) {
        DayOfWeek day = tradeDate.getDayOfWeek();
        return day != DayOfWeek.SATURDAY
                && day != DayOfWeek.SUNDAY
                && !marketHoursProperties.holidays().contains(tradeDate);
    }

    enum WaitingReason {
        NEXT_TRADING_DAY,
        ENTRY_WINDOW,
        SCAN_CANDLE
    }
}
