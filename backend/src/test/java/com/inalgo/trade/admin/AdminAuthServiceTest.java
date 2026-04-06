package com.inalgo.trade.admin;

import com.inalgo.trade.controller.ApiUnauthorizedException;
import com.inalgo.trade.entity.AdminSessionEntity;
import com.inalgo.trade.entity.AdminUserEntity;
import com.inalgo.trade.repository.AdminSessionRepository;
import com.inalgo.trade.repository.AdminUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminAuthServiceTest {
    private static final String TEST_PASSWORD_HASH = "2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b";

    @Test
    void validateToken_survivesServiceRecreationBecauseSessionsAreDatabaseBacked() throws Exception {
        AdminSessionRepository repository = mock(AdminSessionRepository.class);
        AdminUserRepository adminUserRepository = mockAdminUserRepository();
        Map<String, AdminSessionEntity> sessions = new ConcurrentHashMap<>();
        wireRepository(repository, sessions);

        AdminProperties properties = new AdminProperties(30);
        AdminAuthService firstService = new AdminAuthService(properties, repository, adminUserRepository);
        String token = firstService.login("tenant-a", "admin", "secret");

        AdminAuthService secondService = new AdminAuthService(properties, repository, adminUserRepository);

        assertDoesNotThrow(() -> secondService.validateToken("tenant-a", "Bearer " + token));
    }

    @Test
    void validateToken_rejectsWrongTenant() {
        AdminSessionRepository repository = mock(AdminSessionRepository.class);
        AdminUserRepository adminUserRepository = mockAdminUserRepository();
        Map<String, AdminSessionEntity> sessions = new ConcurrentHashMap<>();
        wireRepository(repository, sessions);

        AdminAuthService service = new AdminAuthService(new AdminProperties(30), repository, adminUserRepository);
        String token = service.login("tenant-a", "admin", "secret");

        assertThrows(ApiUnauthorizedException.class, () -> service.validateToken("tenant-b", "Bearer " + token));
    }

    @Test
    void validateToken_rejectsExpiredToken() throws Exception {
        AdminSessionRepository repository = mock(AdminSessionRepository.class);
        AdminUserRepository adminUserRepository = mockAdminUserRepository();
        Map<String, AdminSessionEntity> sessions = new ConcurrentHashMap<>();
        wireRepository(repository, sessions);

        AdminAuthService service = new AdminAuthService(new AdminProperties(30), repository, adminUserRepository);
        String token = service.login("tenant-a", "admin", "secret");
        AdminSessionEntity entity = sessions.values().iterator().next();
        setField(entity, "expiresAt", Instant.now().minusSeconds(60));

        assertThrows(ApiUnauthorizedException.class, () -> service.validateToken("tenant-a", "Bearer " + token));
    }

    @Test
    void login_usesConfiguredSixHourSessionWindow() {
        AdminSessionRepository repository = mock(AdminSessionRepository.class);
        AdminUserRepository adminUserRepository = mockAdminUserRepository();
        Map<String, AdminSessionEntity> sessions = new ConcurrentHashMap<>();
        wireRepository(repository, sessions);

        AdminAuthService service = new AdminAuthService(new AdminProperties(360), repository, adminUserRepository);
        Instant beforeLogin = Instant.now();
        service.login("tenant-a", "admin", "secret");
        Instant afterLogin = Instant.now();

        AdminSessionEntity entity = sessions.values().iterator().next();
        Instant expiresAt = (Instant) readField(entity, "expiresAt");
        assertTrue(!expiresAt.isBefore(beforeLogin.plus(Duration.ofMinutes(359))));
        assertTrue(!expiresAt.isAfter(afterLogin.plus(Duration.ofMinutes(361))));
    }

    private AdminUserRepository mockAdminUserRepository() {
        AdminUserRepository repository = mock(AdminUserRepository.class);
        lenient().when(repository.findByTenantIdAndUsernameAndActiveTrue("tenant-a", "admin"))
                .thenReturn(Optional.of(new AdminUserEntity("tenant-a", "admin", TEST_PASSWORD_HASH, true)));
        return repository;
    }

    private void wireRepository(AdminSessionRepository repository, Map<String, AdminSessionEntity> sessions) {
        lenient().when(repository.save(any(AdminSessionEntity.class))).thenAnswer(invocation -> {
            AdminSessionEntity entity = invocation.getArgument(0);
            sessions.put(readField(entity, "tenantId") + "|" + readField(entity, "tokenHash"), entity);
            return entity;
        });
        lenient().when(repository.findByTenantIdAndTokenHash(anyString(), anyString())).thenAnswer(invocation ->
                Optional.ofNullable(sessions.get(invocation.getArgument(0) + "|" + invocation.getArgument(1))));
        lenient().doAnswer(invocation -> {
            Instant expiresAt = invocation.getArgument(0);
            sessions.entrySet().removeIf(entry -> {
                Instant storedExpiresAt = (Instant) readField(entry.getValue(), "expiresAt");
                return storedExpiresAt.isBefore(expiresAt);
            });
            return null;
        }).when(repository).deleteByExpiresAtBefore(any(Instant.class));
        lenient().doAnswer(invocation -> {
            AdminSessionEntity entity = invocation.getArgument(0);
            sessions.entrySet().removeIf(entry -> entry.getValue() == entity);
            return null;
        }).when(repository).delete(any(AdminSessionEntity.class));
    }

    private Object readField(Object target, String fieldName) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            return field.get(target);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
