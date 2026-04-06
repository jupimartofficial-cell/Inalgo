package com.inalgo.trade.upstox;

import jakarta.validation.ValidationException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class UpstoxConnectivityService {
    private static final int DEFAULT_MAX_SAMPLES = 3;

    private final UpstoxClient upstoxClient;

    public UpstoxConnectivityService(UpstoxClient upstoxClient) {
        this.upstoxClient = upstoxClient;
    }

    public UpstoxConnectivityTestResponse runConnectivityTest(UpstoxConnectivityTestRequest request) {
        LocalDate toDate = request.historicalToDate() == null ? LocalDate.now() : request.historicalToDate();
        LocalDate fromDate = request.historicalFromDate() == null ? toDate.minusDays(7) : request.historicalFromDate();
        if (fromDate.isAfter(toDate)) {
            throw new ValidationException("historicalFromDate cannot be after historicalToDate");
        }

        int maxSamples = request.maxSamplesPerType() == null ? DEFAULT_MAX_SAMPLES : request.maxSamplesPerType();
        List<String> instruments = request.instrumentKeys().stream().distinct().limit(maxSamples).toList();
        List<String> intervals = request.intervals().stream()
                .map(String::trim)
                .map(String::toLowerCase)
                .distinct()
                .toList();

        ensureSupportedIntervals(intervals);

        List<UpstoxConnectivityResult> results = new ArrayList<>();
        for (String instrument : instruments) {
            for (String interval : intervals) {
                results.add(testIntraday(instrument, interval));
                results.add(testHistorical(instrument, interval, toDate, fromDate));
            }
        }

        int successCount = (int) results.stream().filter(UpstoxConnectivityResult::success).count();
        return new UpstoxConnectivityTestResponse(
                results.size(),
                successCount,
                results.size() - successCount,
                results
        );
    }


    private void ensureSupportedIntervals(List<String> intervals) {
        List<String> unsupported = intervals.stream()
                .filter(interval -> !SupportedTimeframe.all().contains(interval))
                .toList();
        if (!unsupported.isEmpty()) {
            throw new ValidationException("Unsupported intervals: " + unsupported + ". Allowed: " + SupportedTimeframe.all());
        }
    }

    private UpstoxConnectivityResult testIntraday(String instrument, String interval) {
        try {
            UpstoxCandleResponse response = upstoxClient.fetchIntradayCandles(instrument, interval);
            return new UpstoxConnectivityResult("intraday", instrument, interval, true, response.candleCount(), null);
        } catch (RuntimeException ex) {
            return new UpstoxConnectivityResult("intraday", instrument, interval, false, null, ex.getMessage());
        }
    }

    private UpstoxConnectivityResult testHistorical(String instrument, String interval, LocalDate toDate, LocalDate fromDate) {
        try {
            UpstoxCandleResponse response = upstoxClient.fetchHistoricalCandles(instrument, interval, toDate, fromDate);
            return new UpstoxConnectivityResult("historical", instrument, interval, true, response.candleCount(), null);
        } catch (RuntimeException ex) {
            return new UpstoxConnectivityResult("historical", instrument, interval, false, null, ex.getMessage());
        }
    }
}
