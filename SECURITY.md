# Security Policy

## Supported Versions

This repository currently supports the `main` branch for security fixes.

## Reporting A Vulnerability

Please report vulnerabilities privately through GitHub Security Advisories when available. If advisories are not enabled for the public repository yet, open a minimal issue that says a private security report is needed without disclosing exploit details.

Include:

- affected component or endpoint
- reproduction steps
- expected and actual behavior
- impact assessment
- whether real broker credentials, tenant data, or order placement could be affected

## Security Boundaries

- `X-Tenant-Id` is required for tenant-scoped APIs and must never be bypassed.
- Admin APIs require a valid session token.
- Upstox and OpenAI tokens must be treated as secrets and configured outside source control.
- Provider responses, browser input, uploaded/imported payloads, and script source are untrusted.
- Live order paths must keep explicit live-trading guardrails and confirmation requirements.

## Local Secret Handling

- Use `.env.production` for deployment secrets and do not commit it.
- Use `.env.production.example` only for non-secret defaults and required variable names.
- Do not commit `upstox.properties`, screenshots with tokens, or real account/order identifiers.

## Verification Baseline

Relevant security checks include:

```bash
cd backend
mvn -Dtest=ApiSecurityRegressionTest,ApiRateLimitFilterTest test

cd ../desktop
npm run test:e2e -- security.spec.ts security-practices.spec.ts
```

Also review `docs/security-measurements.md` before changing auth, tenant isolation, rate limiting, CSP, or secret handling.
