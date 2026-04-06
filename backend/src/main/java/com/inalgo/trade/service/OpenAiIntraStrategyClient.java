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

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class OpenAiIntraStrategyClient {

    private static final String OUTPUT_SCHEMA_NAME = "intra_strategy_candidates";
    private static final List<String> ALLOWED_TEMPLATES = List.of("EMA_PULLBACK", "ORB_BREAKOUT", "GAP_CONTINUATION");
    private static final List<String> ALLOWED_DIRECTIONS = List.of("BULLISH", "BEARISH");

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final OpenAiTokenService tokenService;
    private final OpenAiProperties properties;

    public OpenAiIntraStrategyClient(
            @Qualifier("openAiRestClient") RestClient restClient,
            ObjectMapper objectMapper,
            OpenAiTokenService tokenService,
            OpenAiProperties properties
    ) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.tokenService = tokenService;
        this.properties = properties;
    }

    public List<GeneratedPlan> generatePlans(String tenantId, String analyticsSummary, int candidateCount) {
        String apiKey = tokenService.getTokenForTenant(tenantId);
        ObjectNode request = objectMapper.createObjectNode();
        String model = properties.marketAnalysisModel();
        request.put("model", model);
        request.put("store", false);
        if (isReasoningModel(model)) {
            ObjectNode reasoning = request.putObject("reasoning");
            reasoning.put("effort", properties.reasoningEffort());
        }
        request.put("instructions",
                "You are an intraday options strategy designer for Indian indices. " +
                        "Generate exactly the requested number of strategy plans for BANKNIFTY using the provided analytics summary. " +
                        "Use only realistic, risk-aware parameter values.");
        request.put("input", analyticsSummary);

        ObjectNode text = request.putObject("text");
        ObjectNode format = text.putObject("format");
        format.put("type", "json_schema");
        format.put("name", OUTPUT_SCHEMA_NAME);
        format.put("strict", true);
        ObjectNode schema = format.putObject("schema");
        schema.put("type", "object");

        ObjectNode props = schema.putObject("properties");
        ObjectNode strategies = props.putObject("strategies");
        strategies.put("type", "array");
        strategies.put("minItems", candidateCount);
        strategies.put("maxItems", candidateCount);
        ObjectNode strategyItem = strategies.putObject("items");
        strategyItem.put("type", "object");
        ObjectNode strategyProps = strategyItem.putObject("properties");
        strategyProps.putObject("name").put("type", "string").put("minLength", 6).put("maxLength", 120);
        ObjectNode template = strategyProps.putObject("template");
        template.put("type", "string");
        ArrayNode templateEnum = template.putArray("enum");
        ALLOWED_TEMPLATES.forEach(templateEnum::add);
        ObjectNode direction = strategyProps.putObject("direction");
        direction.put("type", "string");
        ArrayNode directionEnum = direction.putArray("enum");
        ALLOWED_DIRECTIONS.forEach(directionEnum::add);
        strategyProps.putObject("entryHour").put("type", "integer").put("minimum", 9).put("maximum", 14);
        strategyProps.putObject("entryMinute").put("type", "integer").put("minimum", 15).put("maximum", 59);
        strategyProps.putObject("exitHour").put("type", "integer").put("minimum", 10).put("maximum", 15);
        strategyProps.putObject("exitMinute").put("type", "integer").put("minimum", 0).put("maximum", 30);
        strategyProps.putObject("lots").put("type", "integer").put("minimum", 1).put("maximum", 5);
        strategyProps.putObject("strikeSteps").put("type", "integer").put("minimum", 0).put("maximum", 2);
        strategyProps.putObject("stopLossPoints").put("type", "number").put("exclusiveMinimum", 0);
        strategyProps.putObject("targetPoints").put("type", "number").put("exclusiveMinimum", 0);
        strategyProps.putObject("trailingTriggerPoints").put("type", "number").put("exclusiveMinimum", 0);
        strategyProps.putObject("trailingLockPoints").put("type", "number").put("exclusiveMinimum", 0);
        strategyProps.putObject("rationale").put("type", "string").put("minLength", 20).put("maxLength", 500);
        ArrayNode strategyRequired = strategyItem.putArray("required");
        strategyRequired.add("name");
        strategyRequired.add("template");
        strategyRequired.add("direction");
        strategyRequired.add("entryHour");
        strategyRequired.add("entryMinute");
        strategyRequired.add("exitHour");
        strategyRequired.add("exitMinute");
        strategyRequired.add("lots");
        strategyRequired.add("strikeSteps");
        strategyRequired.add("stopLossPoints");
        strategyRequired.add("targetPoints");
        strategyRequired.add("trailingTriggerPoints");
        strategyRequired.add("trailingLockPoints");
        strategyRequired.add("rationale");
        strategyItem.put("additionalProperties", false);

        ArrayNode required = schema.putArray("required");
        required.add("strategies");
        schema.put("additionalProperties", false);

        String responseBody = restClient.post()
                .uri("/v1/responses")
                .contentType(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .body(request)
                .retrieve()
                .body(String.class);
        return parsePlans(responseBody, candidateCount);
    }

    private List<GeneratedPlan> parsePlans(String responseBody, int expectedCount) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String outputText = root.path("output_text").asText(null);
            if (outputText == null || outputText.isBlank()) {
                outputText = extractOutputText(root.path("output"));
            }
            if (outputText == null || outputText.isBlank()) {
                throw new ValidationException("OpenAI strategy response did not include output text");
            }
            JsonNode payload = objectMapper.readTree(outputText);
            JsonNode strategyNode = payload.path("strategies");
            if (!strategyNode.isArray() || strategyNode.size() != expectedCount) {
                throw new ValidationException("OpenAI strategy response did not return expected candidates");
            }
            List<GeneratedPlan> plans = new ArrayList<>();
            for (JsonNode row : strategyNode) {
                String template = normalizeUpper(row.path("template").asText());
                String direction = normalizeUpper(row.path("direction").asText());
                if (!ALLOWED_TEMPLATES.contains(template) || !ALLOWED_DIRECTIONS.contains(direction)) {
                    throw new ValidationException("OpenAI strategy response contains unsupported template or direction");
                }
                plans.add(new GeneratedPlan(
                        row.path("name").asText(),
                        template,
                        direction,
                        row.path("entryHour").asInt(),
                        row.path("entryMinute").asInt(),
                        row.path("exitHour").asInt(),
                        row.path("exitMinute").asInt(),
                        row.path("lots").asInt(),
                        row.path("strikeSteps").asInt(),
                        row.path("stopLossPoints").decimalValue(),
                        row.path("targetPoints").decimalValue(),
                        row.path("trailingTriggerPoints").decimalValue(),
                        row.path("trailingLockPoints").decimalValue(),
                        row.path("rationale").asText()
                ));
            }
            return plans;
        } catch (Exception ex) {
            throw new ValidationException("Unable to parse OpenAI intraday strategy response: " + ex.getMessage(), ex);
        }
    }

    private boolean isReasoningModel(String model) {
        return model != null &&
                (model.startsWith("o1") || model.startsWith("o3")
                        || model.startsWith("o4") || model.startsWith("o-"));
    }

    private String extractOutputText(JsonNode outputNode) {
        if (!outputNode.isArray()) {
            return null;
        }
        for (JsonNode item : outputNode) {
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

    private String normalizeUpper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ENGLISH);
    }

    public record GeneratedPlan(
            String name,
            String template,
            String direction,
            Integer entryHour,
            Integer entryMinute,
            Integer exitHour,
            Integer exitMinute,
            Integer lots,
            Integer strikeSteps,
            java.math.BigDecimal stopLossPoints,
            java.math.BigDecimal targetPoints,
            java.math.BigDecimal trailingTriggerPoints,
            java.math.BigDecimal trailingLockPoints,
            String rationale
    ) {
    }
}
