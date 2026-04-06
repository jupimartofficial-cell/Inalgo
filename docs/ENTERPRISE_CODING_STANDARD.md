# Enterprise Coding Standard

## Purpose

This document defines the repository's implementation standard for architecture, design patterns, API contracts, protocols, security, scalability, performance, and coding conventions.
It is the repo-specific interpretation of the default `enterprise-coding-standards` skill and should be applied alongside `AGENTS.md`, `docs/AI_AGENT_DEVELOPMENT.md`, and `docs/ENTERPRISE_DELIVERY_STANDARD.md`.

## Default Skill Policy

For meaningful engineering tasks, apply these skills in order:

1. `$enterprise-delivery-defaults`
2. `$enterprise-coding-standards`
3. `$structured-change-documentation`
4. `$spring-boot-react-postgresql-production-gate` when backend, frontend, database, API, auth, migration, or release validation work is involved

Documentation-only edits may skip the coding-standards and production-gate skills when no code, contract, or operational behavior is affected.

## Standards Basis

This repo's coding standard is informed by current primary guidance. Inference: the sections below apply those external standards to this specific stack rather than reproducing them verbatim.

- [OpenAI Codex guidance](https://openai.com/index/introducing-codex/) for executable repo instructions and explicit validation
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final) for secure development workflow
- [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/) and [OWASP Top 10 2025](https://owasp.org/Top10/2025/) for application security expectations
- [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) for API risk modeling
- [OpenAPI latest published version](https://spec.openapis.org/oas/latest.html) for API descriptions
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110), [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111), [RFC 9457](https://www.rfc-editor.org/info/rfc9457), and [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446.html) for HTTP semantics, caching, API errors, and TLS
- [The Twelve-Factor App](https://www.12factor.net/) and [Google SRE error-budget guidance](https://sre.google/workbook/error-budget-policy/) for operability, deployment, and reliability

## 1. Architecture Standards

### Backend

- Keep strict separation between controller, service, and repository layers.
- Controllers must handle transport concerns only:
  - request binding
  - validation
  - response mapping
- Services must contain:
  - business rules
  - tenant and auth checks
  - transaction boundaries
  - orchestration across repositories and providers
- Repositories must contain persistence concerns only.
- Provider integrations must isolate external API translation from business workflows.

### Frontend

- API client modules own HTTP calls and DTO typing.
- UI components own rendering, local interaction state, and user flow.
- Avoid burying transport or business rules inside presentational components.
- Preserve existing navigation, tenant, and session boundaries unless the task explicitly changes them.

### Database

- Schema changes must be migration-driven and ordered.
- Entities and indexes must reflect actual access patterns, not speculative future shape.
- Multi-record writes must remain transaction-safe.
- Retryable writes must be idempotent where applicable.

## 2. Design Pattern Standards

- Prefer explicit DTOs for backend and frontend contract boundaries.
- Prefer service-orchestrated use cases over controller-side branching.
- Prefer repository query methods or focused SQL over ad hoc persistence spread across services.
- Use upsert patterns for retryable ingest and synchronization flows.
- Use pagination objects and filter DTOs for large listings.
- Add code comments only where the design intent would otherwise be hard to recover.

Avoid:

- cross-layer shortcuts
- hidden side effects
- duplicate validation logic in multiple layers
- speculative abstractions that are not paying for themselves

## 3. API Contract Standards

- Treat HTTP semantics as part of the contract:
  - safe methods must stay safe
  - unsafe state changes must not be hidden behind `GET`
- Use explicit request and response DTOs.
- Keep versioning and backward-compatibility implications visible in docs and reviews.
- Prefer OpenAPI-compatible contract shapes for user-facing APIs.
- List endpoints must document:
  - filter behavior
  - sort behavior
  - pagination limits
  - cache expectations where relevant
- Prefer consistent machine-readable error responses and align future work toward RFC 9457 problem details.

## 4. Protocol And Integration Standards

- Use TLS-protected transport for external and sensitive integrations.
- Treat upstream API data as untrusted input.
- Validate provider payloads before persistence or downstream use.
- Record timeout, retry, and idempotency assumptions for provider integrations.
- Be explicit about cache behavior for HTTP responses and data refresh paths.

## 5. Security Standards

- Tenant isolation is a hard boundary.
- Every data path must enforce tenant or principal scope at the correct layer.
- Validate all external or user-controlled inputs.
- Review changes against:
  - broken access control
  - authentication failures
  - injection
  - security misconfiguration
  - SSRF
  - unsafe consumption of third-party APIs
- Do not leak secrets, tokens, credentials, or sensitive payloads into source, fixtures, logs, docs, or screenshots.
- Document new auth, audit, abuse-control, or rate-limit implications.

## 6. Scalability And Reliability Standards

- Prefer stateless app behavior and environment-driven config.
- Design list and query paths for bounded reads.
- Avoid N+1 patterns and review index coverage for new filters or orderings.
- Separate latency-sensitive user flows from heavy sync or background work.
- Use batching, pagination, and targeted refresh scopes instead of full reload patterns when scale matters.
- Record reliability or rollout risks when a change can affect availability or error budgets.

## 7. Performance Standards

- Consider query cost, payload size, render cost, and polling frequency on every hot path.
- Avoid overfetching in APIs and excessive prop drilling or duplicated state in the UI.
- Add indexes for new high-selectivity query patterns when justified.
- Review auto-refresh, scheduled jobs, and migration loops for provider pressure and DB load.
- Capture known performance assumptions or hotspots in docs or handoff notes when they influenced the design.

## 8. Coding Convention Standards

- Follow the existing repository style before introducing new idioms.
- Keep functions focused and names descriptive.
- Prefer clarity over abstraction density.
- Use comments sparingly and only for non-obvious constraints or logic.
- Keep validation close to boundaries and business decisions inside services.
- Preserve testability by keeping side effects explicit and dependencies discoverable.
- Keep source files within the repository token budget when possible (default `<=500` lines and `<=20,000` bytes per file); split oversized files by cohesive responsibility rather than adding more branching to monolith files.

## 9. Definition Of Done For Code Quality

The coding-standard gate is satisfied only when:

- architecture boundaries still hold
- design-pattern choices are coherent
- API and protocol semantics are explicit
- security review was performed for relevant changes
- scalability and performance risks were reviewed
- code remains aligned with repo conventions
- standards-impacting changes are reflected in canonical docs or handoff notes
- touched source files satisfy `scripts/check-source-token-budget.sh` or include an explicit exception and follow-up split plan
