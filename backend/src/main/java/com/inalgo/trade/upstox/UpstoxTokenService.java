package com.inalgo.trade.upstox;

import com.inalgo.trade.entity.AppPropertyEntity;
import com.inalgo.trade.repository.AppPropertyRepository;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Optional;

@Service
public class UpstoxTokenService {
    public static final String PROPERTY_KEY = "upstox.accessToken";

    private final AppPropertyRepository appPropertyRepository;

    public UpstoxTokenService(AppPropertyRepository appPropertyRepository) {
        this.appPropertyRepository = appPropertyRepository;
    }

    public String getTokenForTenant(String tenantId) {
        if (!StringUtils.hasText(tenantId)) {
            throw new ValidationException("Tenant context is required for Upstox token lookup");
        }
        Optional<AppPropertyEntity> entity = appPropertyRepository.findByTenantIdAndPropertyKey(tenantId, PROPERTY_KEY);
        if (entity.isEmpty() || !StringUtils.hasText(entity.get().getPropertyValue())) {
            throw new ValidationException("Upstox token is not configured for tenant: " + tenantId);
        }
        return entity.get().getPropertyValue().trim();
    }

    public UpstoxTokenStatus getTokenStatus(String tenantId) {
        if (!StringUtils.hasText(tenantId)) {
            throw new ValidationException("Tenant context is required for Upstox token lookup");
        }
        Optional<AppPropertyEntity> entity = appPropertyRepository.findByTenantIdAndPropertyKey(tenantId, PROPERTY_KEY);
        boolean configured = entity.isPresent() && StringUtils.hasText(entity.get().getPropertyValue());
        Instant updatedAt = entity.map(AppPropertyEntity::getUpdatedAt).orElse(null);
        return new UpstoxTokenStatus(configured, updatedAt);
    }

    public void updateToken(String tenantId, String token) {
        if (!StringUtils.hasText(tenantId)) {
            throw new ValidationException("Tenant context is required for Upstox token update");
        }
        if (!StringUtils.hasText(token)) {
            throw new ValidationException("Upstox token is required");
        }
        AppPropertyEntity entity = appPropertyRepository
                .findByTenantIdAndPropertyKey(tenantId, PROPERTY_KEY)
                .orElseGet(() -> new AppPropertyEntity(tenantId, PROPERTY_KEY, token.trim()));
        entity.setPropertyValue(token.trim());
        appPropertyRepository.save(entity);
    }

    public record UpstoxTokenStatus(boolean configured, Instant updatedAt) {}
}
