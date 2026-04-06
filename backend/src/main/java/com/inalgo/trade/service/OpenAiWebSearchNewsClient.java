package com.inalgo.trade.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.validation.ValidationException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Uses OpenAI's built-in {@code web_search_preview} tool (same technology ChatGPT uses)
 * to fetch real-time market news and produce a structured sentiment analysis in a single call.
 * This replaces static RSS feeds for news scopes when an OpenAI key is configured.
 */
@Component
public class OpenAiWebSearchNewsClient {

    private static final String SCHEMA_NAME = "market_web_search_analysis";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final OpenAiTokenService tokenService;
    private final OpenAiProperties properties;

    public OpenAiWebSearchNewsClient(
            @Qualifier("openAiWebSearchRestClient") RestClient restClient,
            ObjectMapper objectMapper,
            OpenAiTokenService tokenService,
            OpenAiProperties properties
    ) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.tokenService = tokenService;
        this.properties = properties;
    }

    /**
     * Searches the web for current market news and returns a structured sentiment result.
     *
     * @param tenantId  tenant whose OpenAI key to use
     * @param scope     GLOBAL_NEWS or INDIA_NEWS
     * @param marketName human-readable market name for logging
     */
    public WebSearchNewsResult searchAndAnalyze(String tenantId, String scope, String marketName) {
        String apiKey = tokenService.getTokenForTenant(tenantId);
        String today = LocalDate.now().toString();
        String input = buildSearchPrompt(scope, today);

        ObjectNode request = objectMapper.createObjectNode();
        String model = properties.webSearchModel();
        request.put("model", model);
        request.put("store", false);
        if (isReasoningModel(model)) {
            ObjectNode reasoning = request.putObject("reasoning");
            reasoning.put("effort", properties.reasoningEffort());
        }

        // Enable the built-in web_search_preview tool — the model searches the web autonomously
        ArrayNode tools = request.putArray("tools");
        tools.addObject().put("type", "web_search_preview");

        request.put("instructions",
                "You are a financial market analyst. Today is " + today + ". " +
                "Search the web for the latest market news, then return your analysis in the required JSON format. " +
                "Be objective and cite only facts you found. For trendStatus: " +
                "BULL = markets rising or positive macro outlook, " +
                "BEAR = markets falling or negative macro outlook, " +
                "NEUTRAL = mixed or insufficient evidence to call direction."
        );
        request.put("input", input);

        // Structured output schema
        ObjectNode text = request.putObject("text");
        ObjectNode format = text.putObject("format");
        format.put("type", "json_schema");
        format.put("name", SCHEMA_NAME);
        format.put("strict", true);
        ObjectNode schema = format.putObject("schema");
        schema.put("type", "object");
        ObjectNode props = schema.putObject("properties");

        ObjectNode trendStatus = props.putObject("trendStatus");
        trendStatus.put("type", "string");
        trendStatus.putArray("enum").add("BULL").add("BEAR").add("NEUTRAL");

        ObjectNode reason = props.putObject("reason");
        reason.put("type", "string");
        reason.put("description", "2-4 sentence explanation citing specific news found");

        ObjectNode confidence = props.putObject("confidence");
        confidence.put("type", "integer");
        confidence.put("minimum", 0);
        confidence.put("maximum", 100);
        confidence.put("description", "0-100 confidence score based on evidence consistency");

        ObjectNode headlines = props.putObject("headlines");
        headlines.put("type", "array");
        headlines.put("description", "3-6 specific news headlines found during the search");
        ObjectNode headlineItem = headlines.putObject("items");
        headlineItem.put("type", "string");

        ArrayNode required = schema.putArray("required");
        required.add("trendStatus").add("reason").add("confidence").add("headlines");
        schema.put("additionalProperties", false);

        String responseBody = restClient.post()
                .uri("/v1/responses")
                .contentType(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .body(request)
                .retrieve()
                .body(String.class);

        return parseResponse(responseBody, marketName);
    }

    private boolean isReasoningModel(String model) {
        return model != null &&
                (model.startsWith("o1") || model.startsWith("o3") ||
                 model.startsWith("o4") || model.startsWith("o-"));
    }

    private String buildSearchPrompt(String scope, String today) {
        if ("INDIA_NEWS".equals(scope)) {
            return "Search for the latest Indian stock market news today (" + today + ")." +
                    " Look for: NIFTY 50 performance, BANKNIFTY trend, SENSEX levels, RBI monetary policy," +
                    " FII/DII flows, India GDP outlook, major corporate earnings, and any macro events" +
                    " affecting Indian equities." +
                    " Based on the news you find, what is the current Indian equity market sentiment?";
        }
        // GLOBAL_NEWS (default)
        return "Search for the latest global stock market news today (" + today + ")." +
                " Look for: S&P 500 and NASDAQ performance, Federal Reserve rate decisions," +
                " US economic data (jobs, inflation, GDP), China/Asia market moves," +
                " geopolitical events affecting markets, energy prices, and major corporate news." +
                " Based on the news you find, what is the current global equity market sentiment?";
    }

    private WebSearchNewsResult parseResponse(String responseBody, String marketName) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);

            // Try output_text first (convenience field populated when response is complete)
            String outputText = root.path("output_text").asText(null);
            if (outputText == null || outputText.isBlank()) {
                outputText = extractOutputText(root.path("output"));
            }
            if (outputText == null || outputText.isBlank()) {
                throw new ValidationException("OpenAI web search response contained no output text");
            }

            JsonNode payload = objectMapper.readTree(outputText);
            String trendStatus = payload.path("trendStatus").asText("NEUTRAL");
            String reason = payload.path("reason").asText("");
            int confidence = payload.path("confidence").asInt(50);

            List<String> headlines = new ArrayList<>();
            JsonNode headlinesNode = payload.path("headlines");
            if (headlinesNode.isArray()) {
                for (JsonNode h : headlinesNode) {
                    if (h.isTextual() && !h.asText().isBlank()) {
                        headlines.add(h.asText().trim());
                    }
                }
            }

            return new WebSearchNewsResult(trendStatus, reason, confidence, headlines, properties.webSearchModel());
        } catch (Exception ex) {
            throw new ValidationException("Unable to parse OpenAI web search response for " + marketName + ": " + ex.getMessage(), ex);
        }
    }

    private String extractOutputText(JsonNode outputNode) {
        if (!outputNode.isArray()) {
            return null;
        }
        for (JsonNode item : outputNode) {
            // Skip web_search_call items; look for message items with text content
            if ("web_search_call".equals(item.path("type").asText())) {
                continue;
            }
            JsonNode content = item.path("content");
            if (!content.isArray()) {
                continue;
            }
            for (JsonNode contentItem : content) {
                JsonNode textNode = contentItem.path("text");
                if (textNode.isTextual() && !textNode.asText().isBlank()) {
                    return textNode.asText();
                }
            }
        }
        return null;
    }

    public record WebSearchNewsResult(
            String trendStatus,
            String reason,
            int confidence,
            List<String> headlines,
            String model
    ) {}
}
