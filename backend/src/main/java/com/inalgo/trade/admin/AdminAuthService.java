package com.inalgo.trade.admin;

import com.inalgo.trade.controller.ApiUnauthorizedException;
import com.inalgo.trade.entity.AdminSessionEntity;
import com.inalgo.trade.entity.AdminUserEntity;
import com.inalgo.trade.repository.AdminSessionRepository;
import com.inalgo.trade.repository.AdminUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

@Transactional
@Service
public class AdminAuthService {
    private final AdminProperties adminProperties;
    private final AdminSessionRepository adminSessionRepository;
    private final AdminUserRepository adminUserRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    public AdminAuthService(
            AdminProperties adminProperties,
            AdminSessionRepository adminSessionRepository,
            AdminUserRepository adminUserRepository
    ) {
        this.adminProperties = adminProperties;
        this.adminSessionRepository = adminSessionRepository;
        this.adminUserRepository = adminUserRepository;
    }

    public String login(String tenantId, String username, String password) {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(password)) {
            throw new ApiUnauthorizedException("Username and password are required");
        }
        AdminUserEntity user = adminUserRepository.findByTenantIdAndUsernameAndActiveTrue(tenantId, username.trim())
                .orElseThrow(() -> new ApiUnauthorizedException("Invalid admin credentials"));
        if (!matches(hashText(password), user.getPasswordHash())) {
            throw new ApiUnauthorizedException("Invalid admin credentials");
        }

        cleanupExpiredSessions();
        String token = generateToken();
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(adminProperties.sessionMinutes()));
        adminSessionRepository.save(new AdminSessionEntity(tenantId, hashToken(token), expiresAt));
        return token;
    }

    public void validateToken(String tenantId, String authorizationHeader) {
        if (!StringUtils.hasText(authorizationHeader) || !authorizationHeader.startsWith("Bearer ")) {
            throw new ApiUnauthorizedException("Missing admin authorization token");
        }
        String token = authorizationHeader.substring("Bearer ".length()).trim();
        String tokenHash = hashToken(token);
        Instant now = Instant.now();
        AdminSessionEntity session = adminSessionRepository.findByTenantIdAndTokenHash(tenantId, tokenHash)
                .orElseThrow(() -> new ApiUnauthorizedException("Admin session expired or invalid"));
        if (session.isExpired(now)) {
            adminSessionRepository.delete(session);
            throw new ApiUnauthorizedException("Admin session expired or invalid");
        }
        session.touch(now);
        adminSessionRepository.save(session);
    }

    private void cleanupExpiredSessions() {
        adminSessionRepository.deleteByExpiresAtBefore(Instant.now());
    }

    private boolean matches(String actual, String expected) {
        return MessageDigest.isEqual(
                actual.trim().getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8)
        );
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        return hashText(token);
    }

    private String hashText(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(digest.length * 2);
            for (byte digestByte : digest) {
                builder.append(String.format("%02x", digestByte));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is required for admin token hashing", ex);
        }
    }
}
