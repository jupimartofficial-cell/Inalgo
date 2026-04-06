package com.inalgo.trade.dto;

import com.inalgo.trade.entity.CandleEntity;

import java.math.BigDecimal;
import java.time.Instant;

public record CandleResponse(
        String instrumentKey,
        String timeframeUnit,
        Integer timeframeInterval,
        String candleTs,
        BigDecimal openPrice,
        BigDecimal highPrice,
        BigDecimal lowPrice,
        BigDecimal closePrice,
        Long volume
) {
    public static CandleResponse fromEntity(CandleEntity entity) {
        return new CandleResponse(
                entity.getInstrumentKey(),
                entity.getTimeframeUnit(),
                entity.getTimeframeInterval(),
                entity.getCandleTs().toString(),
                entity.getOpenPrice(),
                entity.getHighPrice(),
                entity.getLowPrice(),
                entity.getClosePrice(),
                entity.getVolume()
        );
    }

    public static CandleResponse fromValues(
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            Instant candleTs,
            BigDecimal openPrice,
            BigDecimal highPrice,
            BigDecimal lowPrice,
            BigDecimal closePrice,
            Long volume
    ) {
        return new CandleResponse(
                instrumentKey,
                timeframeUnit,
                timeframeInterval,
                candleTs.toString(),
                openPrice,
                highPrice,
                lowPrice,
                closePrice,
                volume
        );
    }
}
