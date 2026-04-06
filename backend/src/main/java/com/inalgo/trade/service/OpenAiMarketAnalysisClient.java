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

@Component
public class OpenAiMarketAnalysisClient {
    private static final String OUTPUT_SCHEMA_NAME = "market_trend_analysis";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final OpenAiTokenService tokenService;
    private final OpenAiProperties properties;

    public OpenAiMarketAnalysisClient(
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

    public MarketAiAnalysis analyze(String tenantId, String input) {
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
                "Return exactly one of BULL, BEAR, or NEUTRAL from only the supplied evidence. " +
                        "Use NEUTRAL when evidence is mixed. Keep the reason concise.");
        request.put("input", input);
        ObjectNode text = request.putObject("text");
        ObjectNode format = text.putObject("format");
        format.put("type", "json_schema");
        format.put("name", OUTPUT_SCHEMA_NAME);
        format.put("strict", true);
        ObjectNode schema = format.putObject("schema");
        schema.put("type", "object");
        ObjectNode propertiesNode = schema.putObject("properties");
        ObjectNode trendStatus = propertiesNode.putObject("trendStatus");
        trendStatus.put("type", "string");
        ArrayNode trendEnum = trendStatus.putArray("enum");
        trendEnum.add("BULL");
        trendEnum.add("BEAR");
        trendEnum.add("NEUTRAL");
        ObjectNode reason = propertiesNode.putObject("reason");
        reason.put("type", "string");
        reason.put("minLength", 1);
        reason.put("maxLength", 280);
        ObjectNode confidence = propertiesNode.putObject("confidence");
        confidence.put("type", "integer");
        confidence.put("minimum", 0);
        confidence.put("maximum", 100);
        ArrayNode required = schema.putArray("required");
        required.add("trendStatus");
        required.add("reason");
        required.add("confidence");
        schema.put("additionalProperties", false);

        String responseBody = restClient.post()
                .uri("/v1/responses")
                .contentType(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .body(request)
                .retrieve()
                .body(String.class);
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String outputText = root.path("output_text").asText(null);
            if (outputText == null || outputText.isBlank()) {
                outputText = extractOutputText(root.path("output"));
            }
            if (outputText == null || outputText.isBlank()) {
                throw new ValidationException("OpenAI response did not include output text");
            }
            JsonNode payload = objectMapper.readTree(outputText);
            return new MarketAiAnalysis(
                    payload.path("trendStatus").asText(),
                    payload.path("reason").asText(),
                    payload.path("confidence").asInt(),
                    properties.marketAnalysisModel()
            );
        } catch (Exception ex) {
            throw new ValidationException("Unable to parse OpenAI market analysis response: " + ex.getMessage(), ex);
        }
    }

    private boolean isReasoningModel(String model) {
        return model != null &&
                (model.startsWith("o1") || model.startsWith("o3") ||
                 model.startsWith("o4") || model.startsWith("o-"));
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

    public record MarketAiAnalysis(String trendStatus, String reason, Integer confidence, String model) {
    }
}
