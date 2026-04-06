package com.inalgo.trade.upstox;

public record UpstoxConnectivityResult(
        String endpointType,
        String instrumentKey,
        String interval,
        boolean success,
        Integer candleCount,
        String error
) {
}
