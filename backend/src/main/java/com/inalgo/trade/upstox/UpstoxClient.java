package com.inalgo.trade.upstox;

import jakarta.validation.ValidationException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;

@Component
public class UpstoxClient {
    private static final ParameterizedTypeReference<UpstoxApiEnvelope<UpstoxCandlePayload>> CANDLE_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<UpstoxApiEnvelope<List<UpstoxOptionChainRow>>> OPTION_CHAIN_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<UpstoxApiEnvelope<List<UpstoxOptionContract>>> OPTION_CONTRACT_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<UpstoxApiEnvelope<List<String>>> EXPIRED_EXPIRIES_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<UpstoxApiEnvelope<List<UpstoxExpiredDerivativeContract>>> EXPIRED_DERIVATIVE_CONTRACT_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {};
    private static final DateTimeFormatter EXPIRED_INSTRUMENT_DATE_FORMAT = DateTimeFormatter.ofPattern("dd-MM-uuuu");

    private final RestClient upstoxRestClient;

    public UpstoxClient(@Qualifier("upstoxRestClient") RestClient upstoxRestClient) {
        this.upstoxRestClient = upstoxRestClient;
    }

    public UpstoxCandleResponse fetchIntradayCandles(String instrumentKey, String interval) {
        SupportedTimeframe.ParsedInterval parsedInterval = SupportedTimeframe.parse(interval);
        return fetchIntradayCandles(instrumentKey, parsedInterval.unit(), parsedInterval.value());
    }

    public UpstoxCandleResponse fetchIntradayCandles(String instrumentKey, String unit, int interval) {
        validateInputs(instrumentKey, unit, interval);
        UpstoxApiEnvelope<UpstoxCandlePayload> envelope = executeCandleRequest(
                "/v3/historical-candle/intraday/{instrumentKey}/{unit}/{interval}",
                instrumentKey,
                unit,
                interval
        );
        List<List<Object>> candles = normalizeCandles(envelope);
        return new UpstoxCandleResponse(Objects.toString(envelope.status(), "unknown"), candles.size(), candles);
    }

    public UpstoxCandleResponse fetchHistoricalCandles(
            String instrumentKey,
            String interval,
            LocalDate toDate,
            LocalDate fromDate
    ) {
        SupportedTimeframe.ParsedInterval parsedInterval = SupportedTimeframe.parse(interval);
        return fetchHistoricalCandles(instrumentKey, parsedInterval.unit(), parsedInterval.value(), toDate, fromDate);
    }

    public UpstoxCandleResponse fetchHistoricalCandles(
            String instrumentKey,
            String unit,
            int interval,
            LocalDate toDate,
            LocalDate fromDate
    ) {
        validateInputs(instrumentKey, unit, interval);
        if (toDate == null || fromDate == null || fromDate.isAfter(toDate)) {
            throw new ValidationException("Historical date range is invalid");
        }

        UpstoxApiEnvelope<UpstoxCandlePayload> envelope = executeCandleRequest(
                "/v3/historical-candle/{instrumentKey}/{unit}/{interval}/{toDate}/{fromDate}",
                instrumentKey,
                unit,
                interval,
                toDate,
                fromDate
        );
        List<List<Object>> candles = normalizeCandles(envelope);
        return new UpstoxCandleResponse(Objects.toString(envelope.status(), "unknown"), candles.size(), candles);
    }

    public UpstoxOptionChainResponse fetchOptionChain(String instrumentKey, LocalDate expiryDate) {
        if (instrumentKey == null || instrumentKey.isBlank()) {
            throw new ValidationException("instrumentKey is required");
        }
        if (expiryDate == null) {
            throw new ValidationException("expiryDate is required");
        }

        UpstoxApiEnvelope<List<UpstoxOptionChainRow>> envelope;
        try {
            envelope = upstoxRestClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/v2/option/chain")
                            .queryParam("instrument_key", instrumentKey)
                            .queryParam("expiry_date", expiryDate)
                            .build())
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (request, response) -> {
                        String errorBody;
                        try {
                            errorBody = StreamUtils.copyToString(response.getBody(), StandardCharsets.UTF_8);
                        } catch (Exception ex) {
                            errorBody = "unable to read response body";
                        }
                        throw new ValidationException("Upstox request failed with status: " + response.getStatusCode() + ", body=" + errorBody);
                    })
                    .body(OPTION_CHAIN_RESPONSE_TYPE);
        } catch (RestClientException ex) {
            String message = ex.getMessage() == null ? "Failed to call Upstox API" : "Failed to call Upstox API: " + ex.getMessage();
            throw new ValidationException(message, ex);
        }

        List<UpstoxOptionChainRow> rows = normalizeOptionRows(envelope);
        return new UpstoxOptionChainResponse(Objects.toString(envelope.status(), "unknown"), rows.size(), rows);
    }

    public UpstoxOptionContractResponse fetchOptionContracts(String instrumentKey) {
        return fetchOptionContracts(instrumentKey, null);
    }

    public UpstoxOptionContractResponse fetchOptionContracts(String instrumentKey, LocalDate expiryDate) {
        if (instrumentKey == null || instrumentKey.isBlank()) {
            throw new ValidationException("instrumentKey is required");
        }

        UpstoxApiEnvelope<List<UpstoxOptionContract>> envelope;
        try {
            envelope = upstoxRestClient.get()
                    .uri(uriBuilder -> {
                        uriBuilder.path("/v2/option/contract")
                                .queryParam("instrument_key", instrumentKey);
                        if (expiryDate != null) {
                            uriBuilder.queryParam("expiry_date", expiryDate);
                        }
                        return uriBuilder.build();
                    })
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (request, response) -> {
                        String errorBody;
                        try {
                            errorBody = StreamUtils.copyToString(response.getBody(), StandardCharsets.UTF_8);
                        } catch (Exception ex) {
                            errorBody = "unable to read response body";
                        }
                        throw new ValidationException("Upstox request failed with status: " + response.getStatusCode() + ", body=" + errorBody);
                    })
                    .body(OPTION_CONTRACT_RESPONSE_TYPE);
        } catch (RestClientException ex) {
            String message = ex.getMessage() == null ? "Failed to call Upstox API" : "Failed to call Upstox API: " + ex.getMessage();
            throw new ValidationException(message, ex);
        }

        List<UpstoxOptionContract> contracts = normalizeOptionContracts(envelope);
        return new UpstoxOptionContractResponse(Objects.toString(envelope.status(), "unknown"), contracts.size(), contracts);
    }

    /**
     * Returns active monthly index-futures contracts for the given underlying.
     * Queries the same /v2/option/contract endpoint and filters for FUTIDX instrument type.
     * Falls back to an empty list if the API is unavailable or returns no futures.
     */
    public List<UpstoxOptionContract> fetchActiveFuturesContracts(String underlyingKey) {
        if (underlyingKey == null || underlyingKey.isBlank()) {
            throw new ValidationException("underlyingKey is required");
        }
        try {
            UpstoxOptionContractResponse response = fetchOptionContracts(underlyingKey);
            return response.contracts().stream()
                    .filter(Objects::nonNull)
                    .filter(c -> "FUTIDX".equalsIgnoreCase(c.instrumentType())
                            || (c.strikePrice() == null && c.name() != null && c.name().toUpperCase().contains("FUT")))
                    .filter(c -> Boolean.FALSE.equals(c.weekly()) || c.weekly() == null)
                    .toList();
        } catch (Exception ex) {
            return List.of();
        }
    }

    public List<LocalDate> fetchExpiredExpiries(String instrumentKey) {
        if (instrumentKey == null || instrumentKey.isBlank()) {
            throw new ValidationException("instrumentKey is required");
        }

        UpstoxApiEnvelope<List<String>> envelope = executeListRequest(
                uriBuilder -> uriBuilder.path("/v2/expired-instruments/expiries")
                        .queryParam("instrument_key", instrumentKey)
                        .build(),
                EXPIRED_EXPIRIES_RESPONSE_TYPE
        );

        List<LocalDate> expiries = (envelope == null || envelope.data() == null ? List.<String>of() : envelope.data())
                .stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(this::parseLocalDate)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
        return expiries;
    }

    public List<ExpiredDerivativeContractView> fetchExpiredFutureContracts(String instrumentKey, LocalDate expiryDate) {
        return fetchExpiredDerivativeContracts("/v2/expired-instruments/future/contract", instrumentKey, expiryDate);
    }

    public List<ExpiredDerivativeContractView> fetchExpiredOptionContracts(String instrumentKey, LocalDate expiryDate) {
        return fetchExpiredDerivativeContracts("/v2/expired-instruments/option/contract", instrumentKey, expiryDate);
    }

    public UpstoxCandleResponse fetchExpiredHistoricalCandles(
            String expiredInstrumentKey,
            String timeframe,
            LocalDate toDate,
            LocalDate fromDate
    ) {
        if (expiredInstrumentKey == null || expiredInstrumentKey.isBlank()) {
            throw new ValidationException("expiredInstrumentKey is required");
        }
        if (timeframe == null || timeframe.isBlank()) {
            throw new ValidationException("timeframe is required");
        }
        if (toDate == null || fromDate == null || fromDate.isAfter(toDate)) {
            throw new ValidationException("Historical date range is invalid");
        }

        UpstoxApiEnvelope<UpstoxCandlePayload> envelope = executeCandleRequest(
                "/v2/expired-instruments/historical-candle/{instrumentKey}/{timeframe}/{toDate}/{fromDate}",
                expiredInstrumentKey,
                timeframe,
                toDate,
                fromDate
        );
        List<List<Object>> candles = normalizeCandles(envelope);
        return new UpstoxCandleResponse(Objects.toString(envelope.status(), "unknown"), candles.size(), candles);
    }

    private UpstoxApiEnvelope<UpstoxCandlePayload> executeCandleRequest(String pathTemplate, Object... uriVariables) {
        try {
            return upstoxRestClient.get()
                    .uri(pathTemplate, uriVariables)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (request, response) -> {
                        String errorBody;
                        try {
                            errorBody = StreamUtils.copyToString(response.getBody(), StandardCharsets.UTF_8);
                        } catch (Exception ex) {
                            errorBody = "unable to read response body";
                        }
                        throw new ValidationException("Upstox request failed with status: " + response.getStatusCode() + ", body=" + errorBody);
                    })
                    .body(CANDLE_RESPONSE_TYPE);
        } catch (RestClientException ex) {
            throw new ValidationException(buildRestClientMessage(ex), ex);
        }
    }

    private List<ExpiredDerivativeContractView> fetchExpiredDerivativeContracts(
            String path,
            String instrumentKey,
            LocalDate expiryDate
    ) {
        if (instrumentKey == null || instrumentKey.isBlank()) {
            throw new ValidationException("instrumentKey is required");
        }
        if (expiryDate == null) {
            throw new ValidationException("expiryDate is required");
        }

        UpstoxApiEnvelope<List<UpstoxExpiredDerivativeContract>> envelope = executeListRequest(
                uriBuilder -> uriBuilder.path(path)
                        .queryParam("instrument_key", instrumentKey)
                        .queryParam("expiry_date", expiryDate)
                        .build(),
                EXPIRED_DERIVATIVE_CONTRACT_RESPONSE_TYPE
        );
        List<UpstoxExpiredDerivativeContract> contracts = normalizeExpiredContracts(envelope);
        return contracts.stream()
                .map(contract -> new ExpiredDerivativeContractView(
                        contract.name(),
                        contract.segment(),
                        contract.exchange(),
                        contract.expiry(),
                        contract.instrumentKey(),
                        contract.exchangeToken(),
                        contract.tradingSymbol(),
                        contract.lotSize(),
                        contract.instrumentType(),
                        contract.underlyingKey(),
                        contract.strikePrice(),
                        contract.weekly(),
                        contract.optionType()
                ))
                .toList();
    }

    private <T> UpstoxApiEnvelope<T> executeListRequest(
            java.util.function.Function<org.springframework.web.util.UriBuilder, java.net.URI> uriFunction,
            ParameterizedTypeReference<UpstoxApiEnvelope<T>> responseType
    ) {
        try {
            return upstoxRestClient.get()
                    .uri(uriFunction)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (request, response) -> {
                        String errorBody;
                        try {
                            errorBody = StreamUtils.copyToString(response.getBody(), StandardCharsets.UTF_8);
                        } catch (Exception ex) {
                            errorBody = "unable to read response body";
                        }
                        throw new ValidationException("Upstox request failed with status: " + response.getStatusCode() + ", body=" + errorBody);
                    })
                    .body(responseType);
        } catch (RestClientException ex) {
            throw new ValidationException(buildRestClientMessage(ex), ex);
        }
    }

    private List<List<Object>> normalizeCandles(UpstoxApiEnvelope<UpstoxCandlePayload> envelope) {
        if (envelope == null || envelope.data() == null || envelope.data().candles() == null) {
            return List.of();
        }
        return envelope.data().candles();
    }

    private List<UpstoxOptionChainRow> normalizeOptionRows(UpstoxApiEnvelope<List<UpstoxOptionChainRow>> envelope) {
        if (envelope == null || envelope.data() == null) {
            return List.of();
        }
        return envelope.data();
    }

    private List<UpstoxOptionContract> normalizeOptionContracts(UpstoxApiEnvelope<List<UpstoxOptionContract>> envelope) {
        if (envelope == null || envelope.data() == null) {
            return List.of();
        }
        return envelope.data();
    }

    private List<UpstoxExpiredDerivativeContract> normalizeExpiredContracts(
            UpstoxApiEnvelope<List<UpstoxExpiredDerivativeContract>> envelope
    ) {
        if (envelope == null || envelope.data() == null) {
            return List.of();
        }
        return envelope.data();
    }

    private void validateInputs(String instrumentKey, String unit, int interval) {
        if (instrumentKey == null || instrumentKey.isBlank()) {
            throw new ValidationException("instrumentKey is required");
        }
        if (unit == null || unit.isBlank()) {
            throw new ValidationException("unit is required");
        }
        if (interval < 1) {
            throw new ValidationException("interval must be >= 1");
        }
    }

    private String buildRestClientMessage(RestClientException ex) {
        return ex.getMessage() == null ? "Failed to call Upstox API" : "Failed to call Upstox API: " + ex.getMessage();
    }

    private LocalDate parseLocalDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (Exception ignored) {
            try {
                return LocalDate.parse(value, EXPIRED_INSTRUMENT_DATE_FORMAT);
            } catch (Exception ignoredAgain) {
                return null;
            }
        }
    }

    public record ExpiredDerivativeContractView(
            String name,
            String segment,
            String exchange,
            LocalDate expiry,
            String instrumentKey,
            String exchangeToken,
            String tradingSymbol,
            Integer lotSize,
            String instrumentType,
            String underlyingKey,
            java.math.BigDecimal strikePrice,
            Boolean weekly,
            String optionType
    ) {
    }

}
