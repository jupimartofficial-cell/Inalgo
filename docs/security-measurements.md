# Security Measurements & Implementation Matrix

This file tracks security controls aligned with  security practices and how they are implemented in this repository.

## Implemented Controls

| Practice | Implementation in this app | Status |
|---|---|---|
| Tenant-based authorization isolation | `TenantHeaderFilter` enforces `X-Tenant-Id` and validates allowed pattern before processing requests. Tenant context is cleared after each request. | ✅ Implemented |
| Input validation | DTO-level `jakarta.validation` annotations guard admin request payloads and query parameters. | ✅ Implemented |
| SQL injection prevention | Spring Data repositories + JPA parameterized queries only; no string-concatenated SQL in request flow. | ✅ Implemented |
| XSS / clickjacking hardening | Frontend ships a CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`) and backend adds defensive response headers (`X-Frame-Options`, `X-Content-Type-Options`, etc.). | ✅ Implemented |
| Session token protection | Admin session tokens are random 256-bit values and persisted as SHA-256 hashes only. | ✅ Implemented |
| Rate limiting | `ApiRateLimitFilter` enforces burst API limits and stricter login limits. | ✅ Implemented |
| Threat detection (login abuse) | Login endpoint rate limits per IP + tenant to reduce brute force exposure. | ✅ Implemented |
| Pagination defaults | Historical APIs enforce page/size boundaries to avoid unbounded reads. | ✅ Implemented |

## Verification

- Backend security headers and tenant validation are covered by `ApiSecurityRegressionTest`.
- Rate-limiting behavior is covered by `ApiRateLimitFilterTest`.
- Frontend security behavior is covered by Playwright suites `security.spec.ts` and `security-practices.spec.ts`.
