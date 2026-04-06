# Enterprise Delivery Standard

## Purpose

This document defines the minimum delivery standard for enterprise-grade work in this repository.
It complements `AGENTS.md`, `docs/AI_AGENT_DEVELOPMENT.md`, and `CLAUDE.md` by making the default Codex and Claude execution model explicit: every meaningful task must establish context, classify risk, validate the affected stack, and leave behind durable release and handoff artifacts.

## Default Skill Execution Policy

Apply these skills in this order unless the task is explicitly exempted by the user:

1. `$enterprise-delivery-defaults`
   - required for every meaningful engineering task, repo-standards update, validation pass, release-readiness check, or multi-agent handoff
2. `$enterprise-coding-standards`
   - required for meaningful engineering tasks, code reviews, API work, architecture decisions, security hardening, scalability work, performance work, and any code change that should follow the repo's technical quality bar
3. `$structured-change-documentation`
   - required for every meaningful engineering task so durable documentation and handoff notes remain in the repo
4. `$spring-boot-react-postgresql-production-gate`
   - required whenever work touches Spring Boot, React, PostgreSQL, APIs, auth, migrations, or release validation
   - documentation-only edits may skip the coding-standards and production-gate skills, but they still must follow the first two

## Canonical Markdown Set

The repository is considered properly structured only when these document roles remain clear:

- `README.md`
  - project purpose, runtime topology, local runbook, and links to stable feature docs
- `AGENTS.md`
  - collaboration rules, mandatory skills, onboarding order, and PR/handoff expectations
- `docs/AI_AGENT_DEVELOPMENT.md`
  - architecture boundaries, tenant/idempotency rules, PR readiness, and validation gates
- `docs/ENTERPRISE_DELIVERY_STANDARD.md`
  - enterprise default-skill policy, artifact expectations, release-readiness, and operations gates
- `docs/ENTERPRISE_CODING_STANDARD.md`
  - repo-specific coding and architecture standards for implementation work
- `CLAUDE.md`
  - stack versions, environment variables, conventions, and endpoint expectations
- `docs/features/<feature>/feature.md`
  - stable feature behavior, contracts, validations, and handoff notes
- `docs/features/<feature>/test-cases.md`
  - durable regression and acceptance coverage for that feature
- `docs/changes/<change>.md`
  - scoped or in-flight change note when a task needs an implementation-specific document
- domain-specific controls such as `docs/security-measurements.md` and `UPSTOX_HISTORICAL_CANDLE_DATA_SYNC_PLAN.md`
  - only when the task materially affects those areas

## Delivery Workflow

### 1. Onboarding

Before coding, the agent must read the repo onboarding docs in the order defined by `AGENTS.md` and summarize:

- project purpose
- touched stack and runtime
- exact validation commands for the affected area
- certification rules and release gates

If a required doc is missing, outdated, or contradictory, stop and record a doc gap before implementing.

### 2. Scope And Risk Classification

Every task must classify:

- delivery scope:
  - docs-only
  - backend/API
  - frontend/UI
  - database/migration
  - infra/operations
  - cross-layer
- contract impact:
  - none
  - internal-only
  - external/user-visible
- risk level:
  - low
  - medium
  - high
- operational impact:
  - config
  - migration
  - rollout
  - rollback
  - observability
  - support/runbook

### 3. Contract-First Rules

When multiple tracks can work in parallel, define and document the contract before implementation:

- backend request/response shape and failure modes
- schema changes and migration ordering
- event names and payloads
- UI assumptions about loading, empty, and error states

Record stable contracts in feature docs or other durable `docs/` files.

### 4. Validation Matrix

Choose the real commands and checks that match the changed area. At minimum:

- docs-only
  - reference consistency, path accuracy, and policy alignment
- backend/API
  - compile/build
  - targeted tests
  - validation and auth failure paths
  - tenant scoping and idempotency where relevant
- frontend/UI
  - lint/type/build where configured
  - targeted UI or E2E coverage
  - manual flow checks when automation is insufficient
- database/migration
  - migration ordering and safety review
  - compatibility and index review
  - rollback or mitigation notes when destructive risk exists
- cross-layer
  - frontend-backend contract alignment
  - one end-to-end flow through UI/API/DB when relevant

For UI-visible changes, keep a screenshot artifact or equivalent visual proof when practical.

Token-budget maintainability check (required for code changes):

- run `scripts/check-source-token-budget.sh`
- default budget: `500` lines and `20,000` bytes per source file
- if a touched file exceeds limits, split/refactor before merge

### 5. Security, Performance, And Data Safety

Every task must review these gates when relevant:

- tenant isolation and authorization
- input validation and malformed input handling
- secret handling and sensitive data exposure
- N+1 and indexing risks
- pagination or bounded reads for large datasets
- transactional safety for multi-record writes
- retry and replay idempotency

### 6. Operability And Release Readiness

When a task changes runtime behavior, also document:

- new or changed env vars and defaults
- migration order and backfill assumptions
- deployment sequencing or feature-flag dependencies
- logging, metrics, alerting, or dashboard changes
- rollback or mitigation path
- known support or runbook implications

### 7. Documentation And Handoff

Every meaningful task must leave behind:

- a concise implementation summary
- exact validation commands and results
- explicit risks and rollback notes
- follow-up items that are out of scope
- the default skills applied
- a next-step note for another engineer or agent

## Definition Of Merge Readiness

The work is merge-ready only when:

- required default skills were applied
- canonical docs reflect the final behavior
- affected validations passed or blockers are explicitly recorded
- contract changes are documented
- release and rollback implications are captured
- no known security, data-integrity, or regression risk is left unstated
- touched source files pass the token-budget gate or have an explicit approved exception
