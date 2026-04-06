package com.inalgo.trade.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.TradingPreferenceEntity;
import com.inalgo.trade.repository.TradingPreferenceRepository;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.HashSet;
import java.util.Set;

/**
 * Persists trading-window layouts per tenant and username.
 * The service normalizes payloads on both read and write so older saved layouts still respect current UI limits.
 */
@Service
public class TradingPreferenceService {
    private static final Set<String> ALLOWED_LAYOUTS = Set.of("split", "wide", "full");
    private final TradingPreferenceRepository tradingPreferenceRepository;
    private final ObjectMapper objectMapper;

    public TradingPreferenceService(
            TradingPreferenceRepository tradingPreferenceRepository,
            ObjectMapper objectMapper
    ) {
        this.tradingPreferenceRepository = tradingPreferenceRepository;
        this.objectMapper = objectMapper;
    }

    public AdminDtos.TradingPreferencesResponse getPreferences(String tenantId, String username) {
        String normalizedUsername = requireUsername(username);
        return tradingPreferenceRepository.findByTenantIdAndUsername(tenantId, normalizedUsername)
                .map(entity -> buildPreferencesResponse(normalizedUsername, entity))
                .orElse(new AdminDtos.TradingPreferencesResponse(normalizedUsername, null, null));
    }

    /**
     * Saves the normalized payload so the stored JSON always reflects the same shape that the UI consumes.
     */
    public AdminDtos.TradingPreferencesResponse savePreferences(
            String tenantId,
            AdminDtos.TradingPreferencesSaveRequest request
    ) {
        String normalizedUsername = requireUsername(request.username());
        AdminDtos.TradingPreferencesPayload normalizedPayload = normalizePreferencesPayload(request.preferences());
        validatePreferencesPayload(normalizedPayload);

        String jsonPayload = serializePreferencesPayload(normalizedPayload);
        TradingPreferenceEntity entity = tradingPreferenceRepository.findByTenantIdAndUsername(tenantId, normalizedUsername)
                .orElse(new TradingPreferenceEntity(tenantId, normalizedUsername, jsonPayload));
        entity.setPreferencesJson(jsonPayload);

        TradingPreferenceEntity saved = tradingPreferenceRepository.save(entity);
        return new AdminDtos.TradingPreferencesResponse(normalizedUsername, normalizedPayload, saved.getUpdatedAt());
    }

    private AdminDtos.TradingPreferencesResponse buildPreferencesResponse(String username, TradingPreferenceEntity entity) {
        try {
            AdminDtos.TradingPreferencesPayload payload = objectMapper.readValue(
                    entity.getPreferencesJson(),
                    AdminDtos.TradingPreferencesPayload.class
            );
            AdminDtos.TradingPreferencesPayload normalizedPayload = normalizePreferencesPayload(payload);
            validatePreferencesPayload(normalizedPayload);
            return new AdminDtos.TradingPreferencesResponse(username, normalizedPayload, entity.getUpdatedAt());
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Stored trading preferences are invalid");
        }
    }

    private String serializePreferencesPayload(AdminDtos.TradingPreferencesPayload payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new ValidationException("Unable to serialize trading preferences");
        }
    }

    private String requireUsername(String username) {
        if (!StringUtils.hasText(username)) {
            throw new ValidationException("username is required");
        }
        return username.trim();
    }

    private AdminDtos.TradingPreferencesPayload normalizePreferencesPayload(AdminDtos.TradingPreferencesPayload payload) {
        if (payload == null) {
            throw new ValidationException("preferences are required");
        }
        if (payload.tabs() == null) {
            throw new ValidationException("tabs are required");
        }
        return new AdminDtos.TradingPreferencesPayload(
                payload.activeTabIndex(),
                payload.tabs().stream().map(this::normalizeTabPreference).toList()
        );
    }

    private AdminDtos.TradingTabPreference normalizeTabPreference(AdminDtos.TradingTabPreference tab) {
        if (tab == null) {
            throw new ValidationException("tab is required");
        }
        if (tab.charts() == null) {
            throw new ValidationException("charts are required");
        }
        String normalizedName = tab.name() == null ? "" : tab.name().trim();
        return new AdminDtos.TradingTabPreference(
                normalizedName,
                tab.charts().stream().map(this::normalizeChartPreference).toList()
        );
    }

    private AdminDtos.TradingChartPreference normalizeChartPreference(AdminDtos.TradingChartPreference chart) {
        if (chart == null) {
            throw new ValidationException("chart is required");
        }
        String instrumentKey = chart.instrumentKey() == null ? "" : chart.instrumentKey().trim();
        String unit = chart.timeframeUnit() == null ? "" : chart.timeframeUnit().trim().toLowerCase();
        String layout = chart.layout() == null ? "" : chart.layout().trim().toLowerCase();
        String id = chart.id() == null ? "" : chart.id().trim();
        return new AdminDtos.TradingChartPreference(
                id,
                instrumentKey,
                unit,
                chart.timeframeInterval(),
                chart.lookbackDays(),
                chart.height(),
                layout
        );
    }

    /**
     * Mirrors the Trading Window feature contract so invalid layouts never make it into persistence.
     */
    private void validatePreferencesPayload(AdminDtos.TradingPreferencesPayload payload) {
        if (payload.tabs() == null || payload.tabs().isEmpty()) {
            throw new ValidationException("At least one tab is required");
        }
        if (payload.tabs().size() > 5) {
            throw new ValidationException("A maximum of 5 tabs is allowed");
        }
        if (payload.activeTabIndex() == null || payload.activeTabIndex() < 0 || payload.activeTabIndex() >= payload.tabs().size()) {
            throw new ValidationException("activeTabIndex must point to an existing tab");
        }

        for (int i = 0; i < payload.tabs().size(); i += 1) {
            AdminDtos.TradingTabPreference tab = payload.tabs().get(i);
            if (!StringUtils.hasText(tab.name())) {
                throw new ValidationException("Tab name is required");
            }
            if (tab.charts() == null || tab.charts().size() < 2 || tab.charts().size() > 10) {
                throw new ValidationException("Each tab must contain between 2 and 10 charts");
            }

            Set<String> chartIds = new HashSet<>();
            for (AdminDtos.TradingChartPreference chart : tab.charts()) {
                if (!StringUtils.hasText(chart.id())) {
                    throw new ValidationException("Chart id is required");
                }
                if (!chartIds.add(chart.id())) {
                    throw new ValidationException("Duplicate chart id detected in tab " + (i + 1));
                }
                if (!ALLOWED_LAYOUTS.contains(chart.layout())) {
                    throw new ValidationException("Chart layout must be one of: split, wide, full");
                }
                if (!StringUtils.hasText(chart.instrumentKey())) {
                    throw new ValidationException("Chart instrumentKey is required");
                }
                if (!StringUtils.hasText(chart.timeframeUnit())) {
                    throw new ValidationException("Chart timeframeUnit is required");
                }
            }
        }
    }
}
