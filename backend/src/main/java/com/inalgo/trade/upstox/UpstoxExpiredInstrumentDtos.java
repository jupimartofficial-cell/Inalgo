package com.inalgo.trade.upstox;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

record UpstoxExpiredExpiriesResponse(
        String status,
        int expiryCount,
        List<LocalDate> expiries
) {
}

record UpstoxExpiredDerivativeContractResponse(
        String status,
        int contractCount,
        List<UpstoxExpiredDerivativeContract> contracts
) {
}

record UpstoxExpiredDerivativeContract(
        @JsonProperty("name") String name,
        @JsonProperty("segment") String segment,
        @JsonProperty("exchange") String exchange,
        @JsonProperty("expiry") @JsonFormat(pattern = "yyyy-MM-dd") LocalDate expiry,
        @JsonProperty("instrument_key") String instrumentKey,
        @JsonProperty("exchange_token") String exchangeToken,
        @JsonProperty("trading_symbol") String tradingSymbol,
        @JsonProperty("tick_size") BigDecimal tickSize,
        @JsonProperty("lot_size") Integer lotSize,
        @JsonProperty("instrument_type") String instrumentType,
        @JsonProperty("freeze_quantity") BigDecimal freezeQuantity,
        @JsonProperty("underlying_key") String underlyingKey,
        @JsonProperty("underlying_type") String underlyingType,
        @JsonProperty("underlying_symbol") String underlyingSymbol,
        @JsonProperty("strike_price") BigDecimal strikePrice,
        @JsonProperty("minimum_lot") Integer minimumLot,
        @JsonProperty("weekly") Boolean weekly,
        @JsonProperty("option_type") String optionType
) {
}
