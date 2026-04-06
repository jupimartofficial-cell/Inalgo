package com.inalgo.trade.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class TenantHeaderFilter extends OncePerRequestFilter {
    public static final String TENANT_HEADER = "X-Tenant-Id";
    private static final int MAX_TENANT_ID_LENGTH = 64;
    private static final String TENANT_ID_PATTERN = "^[a-zA-Z0-9._:-]+$";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return HttpMethod.OPTIONS.matches(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String tenantId = request.getHeader(TENANT_HEADER);
        if (!StringUtils.hasText(tenantId)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().write("Missing required header: " + TENANT_HEADER);
            return;
        }

        String normalizedTenantId = tenantId.trim();
        if (normalizedTenantId.length() > MAX_TENANT_ID_LENGTH || !normalizedTenantId.matches(TENANT_ID_PATTERN)) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.getWriter().write("Invalid tenant identifier");
            return;
        }

        try {
            TenantContext.setTenantId(normalizedTenantId);
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
