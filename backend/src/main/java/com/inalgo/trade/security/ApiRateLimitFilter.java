package com.inalgo.trade.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ApiRateLimitFilter extends OncePerRequestFilter {
    private static final long ONE_SECOND_MS = 1000;
    private static final long ONE_MINUTE_MS = 60_000;
    private static final long ONE_HOUR_MS = 3_600_000;

    private final ApiRateLimitProperties properties;
    private final Map<String, Deque<Long>> requestWindows = new ConcurrentHashMap<>();

    public ApiRateLimitFilter(ApiRateLimitProperties properties) {
        this.properties = properties;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return HttpMethod.OPTIONS.matches(request.getMethod()) || path == null || !path.startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        String clientIp = resolveClientIp(request);
        String tenant = request.getHeader(TenantHeaderFilter.TENANT_HEADER);
        long now = Instant.now().toEpochMilli();

        if (!allow("api:" + clientIp, now, ONE_SECOND_MS, properties.apiRequestsPerSecond())) {
            reject(response, "Rate limit exceeded for API requests");
            return;
        }

        if ("/api/v1/admin/login".equals(path)) {
            String loginKey = "login:" + clientIp + ":" + (tenant == null ? "unknown" : tenant.trim());
            if (!allow(loginKey + ":minute", now, ONE_MINUTE_MS, properties.adminLoginPerMinute())
                    || !allow(loginKey + ":hour", now, ONE_HOUR_MS, properties.adminLoginPerHour())) {
                reject(response, "Too many login attempts. Please retry later");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean allow(String key, long nowMs, long windowMs, int maxRequests) {
        Deque<Long> timestamps = requestWindows.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        synchronized (timestamps) {
            long cutoff = nowMs - windowMs;
            while (!timestamps.isEmpty() && timestamps.peekFirst() < cutoff) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= maxRequests) {
                return false;
            }
            timestamps.addLast(nowMs);
            return true;
        }
    }

    private void reject(HttpServletResponse response, String message) throws IOException {
        response.setStatus(429);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }
}
