package com.inalgo.trade.upstox;

import java.util.List;

record UpstoxApiEnvelope<T>(String status, T data) {
}

record UpstoxCandlePayload(List<List<Object>> candles) {
}
