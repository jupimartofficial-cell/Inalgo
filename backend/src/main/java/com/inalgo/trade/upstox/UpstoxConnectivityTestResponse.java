package com.inalgo.trade.upstox;

import java.util.List;

public record UpstoxConnectivityTestResponse(
        int totalChecks,
        int successCount,
        int failureCount,
        List<UpstoxConnectivityResult> results
) {
}
