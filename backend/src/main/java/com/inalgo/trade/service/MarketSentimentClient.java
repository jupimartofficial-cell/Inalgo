package com.inalgo.trade.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ValidationException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class MarketSentimentClient {
    private static final Pattern GIFT_CURRENT_VALUE_PATTERN = Pattern.compile(
            "<p class=\\\"fs-24 fw-700 lh-35 color-black mb-0\\\"[^>]*>\\s*([0-9,]+(?:\\.[0-9]+)?)\\s*</p>",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern GIFT_DATA_AS_OF_PATTERN = Pattern.compile(
            "gift-nifty-day[^>]*>([^<]+)<",
            Pattern.CASE_INSENSITIVE
    );

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public MarketSentimentClient(
            @Qualifier("marketSentimentRestClient") RestClient restClient,
            ObjectMapper objectMapper
    ) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
    }

    public List<NewsArticle> fetchRssFeed(String url, String sourceName) {
        String xml = fetchText(url, MediaType.APPLICATION_XML_VALUE);
        return parseRss(xml, sourceName);
    }

    public TechnicalSeries fetchYahooIndex(String symbol, String marketName) {
        String json = fetchText("https://query1.finance.yahoo.com/v8/finance/chart/" + symbol + "?range=6mo&interval=1d", MediaType.APPLICATION_JSON_VALUE);
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode resultNode = root.path("chart").path("result").get(0);
            if (resultNode == null || resultNode.isMissingNode()) {
                throw new ValidationException("No Yahoo chart data found for " + marketName);
            }
            JsonNode timestamps = resultNode.path("timestamp");
            JsonNode closePrices = resultNode.path("indicators").path("quote").get(0).path("close");
            JsonNode meta = resultNode.path("meta");
            List<PricePoint> points = new ArrayList<>();
            for (int index = 0; index < Math.min(timestamps.size(), closePrices.size()); index++) {
                JsonNode tsNode = timestamps.get(index);
                JsonNode closeNode = closePrices.get(index);
                if (tsNode == null || closeNode == null || closeNode.isNull()) {
                    continue;
                }
                points.add(new PricePoint(
                        Instant.ofEpochSecond(tsNode.asLong()),
                        closeNode.decimalValue()
                ));
            }
            if (points.isEmpty()) {
                throw new ValidationException("No close-price rows returned for " + marketName);
            }
            Instant dataAsOf = meta.path("regularMarketTime").isNumber()
                    ? Instant.ofEpochSecond(meta.path("regularMarketTime").asLong())
                    : points.getLast().asOf();
            BigDecimal currentValue = meta.path("regularMarketPrice").isNumber()
                    ? meta.path("regularMarketPrice").decimalValue()
                    : points.getLast().closeValue();
            return new TechnicalSeries(marketName, currentValue, dataAsOf, points);
        } catch (Exception ex) {
            throw new ValidationException("Unable to parse Yahoo chart data for " + marketName + ": " + ex.getMessage(), ex);
        }
    }

    public TechnicalSeries fetchStooqIndex(String symbol, String marketName) {
        String quoteJson = fetchText("https://stooq.com/q/l/?s=" + symbol + "&f=sd2t2ohlcvn&e=json", MediaType.APPLICATION_JSON_VALUE);
        String historyCsv = fetchText("https://stooq.com/q/d/l/?s=" + symbol + "&i=d", MediaType.TEXT_PLAIN_VALUE);
        try {
            // Parse history first — needed as fallback when the live quote returns N/D (market holiday/weekend)
            List<PricePoint> points = parseStooqHistory(historyCsv);
            if (points.size() < EmaCalculator.EMA_110_PERIOD) {
                throw new ValidationException("Insufficient Stooq history returned for " + marketName);
            }
            JsonNode symbolNode = objectMapper.readTree(quoteJson).path("symbols").get(0);
            if (symbolNode == null || symbolNode.isMissingNode()) {
                throw new ValidationException("No Stooq quote data found for " + marketName);
            }
            // Stooq returns "N/D" for close/date on market holidays and weekends.
            // Fall back to the most-recent CSV point so the sync keeps running.
            BigDecimal currentValue = symbolNode.path("close").decimalValue();
            if (currentValue == null || currentValue.compareTo(BigDecimal.ZERO) <= 0) {
                currentValue = points.getLast().closeValue();
            }
            Instant dataAsOf;
            try {
                String dateText = symbolNode.path("date").asText(null);
                if (dateText == null || dateText.isBlank()
                        || "N/D".equalsIgnoreCase(dateText) || "0000-00-00".equals(dateText)) {
                    dataAsOf = points.getLast().asOf();
                } else {
                    dataAsOf = LocalDate.parse(dateText).plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
                }
            } catch (DateTimeParseException ex) {
                dataAsOf = points.getLast().asOf();
            }
            return new TechnicalSeries(marketName, currentValue, dataAsOf, points);
        } catch (ValidationException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ValidationException("Unable to parse Stooq data for " + marketName + ": " + ex.getMessage(), ex);
        }
    }

    public TechnicalSeries fetchGiftNifty() {
        String html = fetchText("https://www.icicidirect.com/equity/index/gift-nifty", MediaType.TEXT_HTML_VALUE);
        BigDecimal currentValue = extractRequiredDecimal(GIFT_CURRENT_VALUE_PATTERN, html, "GIFT Nifty current value");
        Instant dataAsOf = extractGiftDataAsOf(html);
        String body = "Method=GetWorldIndicesHistoricData&param%5B0%5D%5Bkey%5D=P_TIME_PERIOD&param%5B0%5D%5Bvalue%5D=1Y";
        String json = restClient.post()
                .uri("https://www.icicidirect.com/marketapi/market")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);
        try {
            JsonNode table = objectMapper.readTree(json).path("Data").path("Table");
            List<PricePoint> points = new ArrayList<>();
            for (JsonNode row : table) {
                if (!"GIFT NIFTY".equalsIgnoreCase(row.path("NAME").asText())) {
                    continue;
                }
                String dateText = row.path("WORLDINDICES_DATE").asText(null);
                if (dateText == null || dateText.isBlank()) {
                    continue;
                }
                points.add(new PricePoint(
                        Instant.parse(dateText + "Z"),
                        row.path("INDEX_VALUE").decimalValue()
                ));
            }
            if (points.isEmpty()) {
                throw new ValidationException("No historical rows returned for GIFT Nifty");
            }
            PricePoint latestPoint = points.getLast();
            if (dataAsOf != null && latestPoint.asOf().isBefore(dataAsOf)) {
                points.add(new PricePoint(dataAsOf, currentValue));
            }
            return new TechnicalSeries("Gift Nifty", currentValue, dataAsOf == null ? latestPoint.asOf() : dataAsOf, points);
        } catch (Exception ex) {
            throw new ValidationException("Unable to parse GIFT Nifty history: " + ex.getMessage(), ex);
        }
    }

    private String fetchText(String url, String accept) {
        return restClient.get()
                .uri(URI.create(url))
                .accept(MediaType.parseMediaType(accept))
                .retrieve()
                .body(String.class);
    }

    private List<PricePoint> parseStooqHistory(String csv) {
        List<PricePoint> points = new ArrayList<>();
        String[] rows = csv.split("\\R");
        for (int index = 1; index < rows.length; index++) {
            String row = rows[index].trim();
            if (row.isBlank()) {
                continue;
            }
            String[] columns = row.split(",");
            if (columns.length < 5 || columns[4].isBlank() || "null".equalsIgnoreCase(columns[4])) {
                continue;
            }
            points.add(new PricePoint(
                    LocalDate.parse(columns[0]).plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC),
                    new BigDecimal(columns[4])
            ));
        }
        return points;
    }

    private List<NewsArticle> parseRss(String xml, String defaultSourceName) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setExpandEntityReferences(false);
            var builder = factory.newDocumentBuilder();
            var document = builder.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
            var items = document.getElementsByTagName("item");
            List<NewsArticle> articles = new ArrayList<>();
            for (int index = 0; index < items.getLength(); index++) {
                var item = items.item(index);
                String title = textOf(item, "title");
                if (title == null || title.isBlank()) {
                    continue;
                }
                String link = textOf(item, "link");
                String description = textOf(item, "description");
                Instant publishedAt = parseInstant(textOf(item, "pubDate"));
                String sourceName = deriveSourceName(title, defaultSourceName);
                articles.add(new NewsArticle(sourceName, title.trim(), description == null ? "" : description.trim(), link == null ? "" : link.trim(), publishedAt));
            }
            return articles;
        } catch (Exception ex) {
            throw new ValidationException("Unable to parse RSS feed for " + defaultSourceName + ": " + ex.getMessage(), ex);
        }
    }

    private String textOf(org.w3c.dom.Node item, String tagName) {
        if (!(item instanceof org.w3c.dom.Element element)) {
            return null;
        }
        var nodes = element.getElementsByTagName(tagName);
        if (nodes.getLength() == 0 || nodes.item(0) == null) {
            return null;
        }
        return nodes.item(0).getTextContent();
    }

    private Instant parseInstant(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return ZonedDateTime.parse(value.trim(), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
        } catch (DateTimeParseException ignored) {
            try {
                return Instant.parse(value.trim());
            } catch (DateTimeParseException ex) {
                return null;
            }
        }
    }

    private String deriveSourceName(String title, String defaultSourceName) {
        int separatorIndex = title.lastIndexOf(" - ");
        if (separatorIndex > 0 && separatorIndex < title.length() - 3) {
            return title.substring(separatorIndex + 3).trim();
        }
        return defaultSourceName;
    }

    private BigDecimal extractRequiredDecimal(Pattern pattern, String input, String fieldName) {
        Matcher matcher = pattern.matcher(input);
        if (!matcher.find()) {
            throw new ValidationException("Unable to find " + fieldName);
        }
        return new BigDecimal(matcher.group(1).replace(",", ""));
    }

    private Instant extractGiftDataAsOf(String html) {
        Matcher matcher = GIFT_DATA_AS_OF_PATTERN.matcher(html);
        if (!matcher.find()) {
            return null;
        }
        String raw = matcher.group(1).trim().replace(" ", "");
        try {
            LocalDate date = LocalDate.parse(raw, DateTimeFormatter.ofPattern("dd,MMM uuuu"));
            return date.atStartOfDay().toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    public record NewsArticle(String sourceName, String title, String description, String link, Instant publishedAt) {
    }

    public record PricePoint(Instant asOf, BigDecimal closeValue) {
    }

    public record TechnicalSeries(String marketName, BigDecimal currentValue, Instant dataAsOf, List<PricePoint> points) {
    }
}
