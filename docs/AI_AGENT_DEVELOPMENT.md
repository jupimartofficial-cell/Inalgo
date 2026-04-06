# Multi-AI Agent Architecture & Delivery Rules

## Purpose
This document defines how human developers and AI agents collaborate safely in this repository.
It is intentionally explicit so independent agents can work on backend, frontend, and migration features
without drifting from shared quality standards.

**Claude must follow the same rules, onboarding order, default skill policy, and PR readiness gates defined here and in `AGENTS.md`.**

## Project architecture for agent collaboration

### 1) Layer ownership model
- **Controller layer** (`backend/.../controller`, `backend/.../admin`, `backend/.../upstox`):
  - HTTP mapping, request validation, response mapping only.
  - No direct persistence or complex business rules.
- **Service layer** (`backend/.../service`, `backend/.../upstox`):
  - Single source of truth for business rules, tenant constraints, retry and migration workflows.
- **Repository/entity layer**:
  - Persistence only.
  - Idempotency and indexing assumptions must be documented in migrations/entities.
- **Frontend API modules** (`desktop/src/renderer/src/api`):
  - Remote-call boundaries and DTO typing.
- **Frontend components**:
  - UI/state orchestration only.

### 2) Tenant safety boundary
- Every backend request path must preserve tenant isolation.
- `X-Tenant-Id` is mandatory for tenant-scoped APIs.
- Any new feature touching data must prove tenant authorization at service/repository boundaries.

### 3) Idempotent data ingestion boundary
- Candle ingestion must remain idempotent on stream identity + candle timestamp.
- Migration jobs must tolerate retries and process restarts.
- New import/sync code should use existing upsert contracts rather than ad-hoc inserts.

### 4) Agent-safe change strategy
- Prefer **small, focused PRs**: one feature family per PR.
- Avoid cross-layer rewrites unless required by correctness/security.
- Add comments where behavior is non-obvious for future AI agents.
- Default skill policy:
  - Always use `$enterprise-delivery-defaults` for every meaningful engineering task, standards update, validation pass, release-readiness check, or multi-agent handoff so scope, contracts, operations impact, and release artifacts are handled consistently.
  - Always use `$enterprise-coding-standards` for meaningful engineering tasks and code reviews so architecture, design-pattern, API, protocol, security, scalability, performance, and coding-standard checks are applied consistently.
  - Always use `$structured-change-documentation` for meaningful engineering work so implementation notes, validation, and handoff details are left behind.
  - Always use `$spring-boot-react-postgresql-production-gate` for any backend, frontend, database, auth, migration, or release-validation change in this repository.
  - Run them in that order when all four apply.
  - Documentation-only edits may skip the coding-standards and production-gate skills.

## Mandatory PR readiness checklist
All features must satisfy the checks below before PR submission.

**Enforcement:** Every PR must use `.github/PULL_REQUEST_TEMPLATE.md` and the checklist in `docs/PR_CHECKLIST.md`.

### A. Feature tracking
- [ ] A short implementation note is added in `README.md` (or relevant feature document).
- [ ] API/interface changes are documented (request params, headers, behavior, failure modes).
- [ ] Any new config/env var is documented with default and override behavior.
- [ ] Required default skills were applied and their outputs are reflected in the docs/handoff.

### B. Test requirements
- [ ] Unit/integration tests added or updated for changed behavior.
- [ ] Existing test suite passes locally for touched modules.
- [ ] Error paths are tested (validation failures, auth failures, provider failures).
- [ ] Idempotency path is tested when data writes are involved.

### C. Verification requirements
- [ ] Static and formatting checks run for touched stack.
- [ ] Manual verification steps are recorded when automated checks are insufficient.
- [ ] For UI-visible changes: screenshot artifact captured.

### D. Security and performance gates
- [ ] Tenant authorization checks validated.
- [ ] Input validation added for external/user-controlled inputs.
- [ ] Query pagination limits enforced for list endpoints.
- [ ] Potential N+1/index issues reviewed for new queries.

### E. Architecture and coding-standard gates
- [ ] Layer boundaries remain intact across controller, service, repository, API-client, and UI responsibilities.
- [ ] Design-pattern choices are explicit and consistent with nearby code.
- [ ] API contracts and protocol behavior are documented for changed endpoints or integrations.
- [ ] Scalability and performance implications are reviewed for hot paths, polling, sync jobs, and large datasets.
- [ ] Source-file token budget gate passes for touched backend/frontend files (`scripts/check-source-token-budget.sh`, default: max 500 lines and 20,000 bytes per file).

### F. Operational readiness gates
- [ ] New or changed env vars are documented with defaults and deployment notes.
- [ ] Migration ordering, backfill assumptions, and rollback or mitigation are documented when relevant.
- [ ] Logging, metrics, alerts, dashboards, or support runbook impact is reviewed for runtime-behavior changes.
- [ ] Residual risks and follow-up work are captured in docs or handoff notes.

## Suggested command baseline (adjust per change)
```bash
# backend
cd backend
mvn test

# frontend
cd desktop
npm run build
```

## Definition of done
A PR is ready only when documentation, tests, and verification artifacts are all present,
and reviewers can reproduce the behavior with the commands listed in the PR description.
