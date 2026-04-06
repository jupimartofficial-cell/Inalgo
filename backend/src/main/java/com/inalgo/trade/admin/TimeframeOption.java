package com.inalgo.trade.admin;

/**
 * A simple timeframe unit/interval pair used for catalog seeding.
 */
final class TimeframeOption {
    final String unit;
    final Integer interval;

    TimeframeOption(String unit, Integer interval) {
        this.unit = unit;
        this.interval = interval;
    }
}
