package com.inalgo.trade.upstox;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@Validated
@RestController
@RequestMapping("/api/v1/upstox")
public class UpstoxController {
    private final UpstoxClient upstoxClient;
    private final UpstoxConnectivityService connectivityService;

    public UpstoxController(UpstoxClient upstoxClient, UpstoxConnectivityService connectivityService) {
        this.upstoxClient = upstoxClient;
        this.connectivityService = connectivityService;
    }

    @GetMapping("/intraday")
    public UpstoxCandleResponse getIntraday(
            @RequestParam @NotBlank String instrumentKey,
            @RequestParam @NotBlank String interval
    ) {
        return upstoxClient.fetchIntradayCandles(instrumentKey, interval);
    }

    @GetMapping("/historical")
    public UpstoxCandleResponse getHistorical(
            @RequestParam @NotBlank String instrumentKey,
            @RequestParam @NotBlank String interval,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate
    ) {
        return upstoxClient.fetchHistoricalCandles(instrumentKey, interval, toDate, fromDate);
    }

    @GetMapping("/option-chain")
    public UpstoxOptionChainResponse getOptionChain(
            @RequestParam @NotBlank String instrumentKey,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiryDate
    ) {
        return upstoxClient.fetchOptionChain(instrumentKey, expiryDate);
    }

    @GetMapping("/option-contracts")
    public UpstoxOptionContractResponse getOptionContracts(
            @RequestParam @NotBlank String instrumentKey,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiryDate
    ) {
        if (expiryDate == null) {
            return upstoxClient.fetchOptionContracts(instrumentKey);
        }
        return upstoxClient.fetchOptionContracts(instrumentKey, expiryDate);
    }

    @PostMapping("/connectivity-test")
    public UpstoxConnectivityTestResponse runConnectivityTest(@Valid @RequestBody UpstoxConnectivityTestRequest request) {
        return connectivityService.runConnectivityTest(request);
    }
}
