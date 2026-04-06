package com.inalgo.trade.upstox;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

record UpstoxOptionChainResponse(
        String status,
        int rowCount,
        List<UpstoxOptionChainRow> rows
) {
}

record UpstoxOptionContractResponse(
        String status,
        int contractCount,
        List<UpstoxOptionContract> contracts
) {
}

record UpstoxOptionChainRow(
        @JsonProperty("expiry") @JsonFormat(pattern = "yyyy-MM-dd") LocalDate expiryDate,
        @JsonProperty("strike_price") BigDecimal strikePrice,
        @JsonProperty("underlying_spot_price") BigDecimal underlyingSpotPrice,
        @JsonProperty("pcr") BigDecimal pcr,
        @JsonProperty("call_options") UpstoxOptionSide callOptions,
        @JsonProperty("put_options") UpstoxOptionSide putOptions
) {
}

record UpstoxOptionSide(
        @JsonProperty("instrument_key") String instrumentKey,
        @JsonProperty("market_data") UpstoxOptionMarketData marketData,
        @JsonProperty("option_greeks") UpstoxOptionGreeks optionGreeks
) {
}

record UpstoxOptionMarketData(
        @JsonProperty("ltp") BigDecimal ltp,
        @JsonProperty("close_price") BigDecimal closePrice,
        @JsonProperty("volume") Long volume,
        @JsonProperty("oi") Long oi,
        @JsonProperty("prev_oi") Long prevOi,
        @JsonProperty("bid_price") BigDecimal bidPrice,
        @JsonProperty("bid_qty") Long bidQty,
        @JsonProperty("ask_price") BigDecimal askPrice,
        @JsonProperty("ask_qty") Long askQty
) {
}

record UpstoxOptionGreeks(
        @JsonProperty("vega") BigDecimal vega,
        @JsonProperty("theta") BigDecimal theta,
        @JsonProperty("gamma") BigDecimal gamma,
        @JsonProperty("delta") BigDecimal delta,
        @JsonProperty("iv") BigDecimal iv,
        @JsonProperty("pop") BigDecimal pop
) {
}

record UpstoxOptionContract(
        @JsonProperty("instrument_key") String instrumentKey,
        @JsonProperty("underlying_key") String underlyingKey,
        @JsonProperty("underlying_type") String underlyingType,
        @JsonProperty("exchange") String exchange,
        @JsonProperty("segment") String segment,
        @JsonProperty("name") String name,
        @JsonProperty("expiry") @JsonFormat(pattern = "yyyy-MM-dd") LocalDate expiry,
        @JsonProperty("strike_price") BigDecimal strikePrice,
        @JsonProperty("lot_size") Integer lotSize,
        @JsonProperty("instrument_type") String instrumentType,
        @JsonProperty("weekly") Boolean weekly
) {
}
