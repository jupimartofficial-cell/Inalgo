package com.inalgo.trade.upstox;

import java.util.List;

public record UpstoxCandleResponse(
        String status,
        int candleCount,
        List<List<Object>> candles
) {
}
