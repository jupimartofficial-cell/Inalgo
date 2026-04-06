package com.inalgo.trade.service;

import com.inalgo.trade.entity.AppPropertyEntity;
import com.inalgo.trade.repository.AppPropertyRepository;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Optional;

@Service
public class OpenAiTokenService {
    public static final String PROPERTY_KEY = "openai.apiKey";

    private final AppPropertyRepository appPropertyRepository;

    public OpenAiTokenService(AppPropertyRepository appPropertyRepository) {
        this.appPropertyRepository = appPropertyRepository;
    }

    public Optional<String> findTokenForTenant(String tenantId) {
        requireTenant(tenantId);
        return appPropertyRepository.findByTenantIdAndPropertyKey(tenantId, PROPERTY_KEY)
                .map(AppPropertyEntity::getPropertyValue)
                .filter(StringUtils::hasText)
                .map(String::trim);
    }

    public String getTokenForTenant(String tenantId) {
        return findTokenForTenant(tenantId)
                .orElseThrow(() -> new ValidationException("OpenAI API key is not configured for tenant: " + tenantId));
    }

    public OpenAiTokenStatus getTokenStatus(String tenantId, OpenAiProperties properties) {
        requireTenant(tenantId);
        Optional<AppPropertyEntity> entity = appPropertyRepository.findByTenantIdAndPropertyKey(tenantId, PROPERTY_KEY);
        boolean configured = entity.isPresent() && StringUtils.hasText(entity.get().getPropertyValue());
        Instant updatedAt = entity.map(AppPropertyEntity::getUpdatedAt).orElse(null);
        return new OpenAiTokenStatus(configured, updatedAt, properties.marketAnalysisModel(), properties.enabled());
    }

    public void updateToken(String tenantId, String token) {
        requireTenant(tenantId);
        if (!StringUtils.hasText(token)) {
            throw new ValidationException("OpenAI API key is required");
        }
        AppPropertyEntity entity = appPropertyRepository
                .findByTenantIdAndPropertyKey(tenantId, PROPERTY_KEY)
                .orElseGet(() -> new AppPropertyEntity(tenantId, PROPERTY_KEY, token.trim()));
        entity.setPropertyValue(token.trim());
        appPropertyRepository.save(entity);
    }

    private void requireTenant(String tenantId) {
        if (!StringUtils.hasText(tenantId)) {
            throw new ValidationException("Tenant context is required for OpenAI API key lookup");
        }
    }

    public record OpenAiTokenStatus(boolean configured, Instant updatedAt, String model, boolean enabled) {
    }
}
