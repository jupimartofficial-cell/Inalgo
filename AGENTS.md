# AGENTS.md

This document defines how humans and AI agents collaborate safely and efficiently in this repository.

## 1) Collaboration Model

### Roles
- **Human Maintainers**
  - Define product requirements, approve architecture changes, and own production releases.
  - Review AI-authored changes for business intent and edge-case coverage.
- **AI Agents (Codex, Claude, and any other AI assistants)**
  - Execute scoped tasks, keep changes minimal, and document assumptions.
  - Run local checks and provide clear handoff notes.

### Ground Rules
- Prefer **small, independent PRs** over large mixed changes.
- One PR should target **one bounded objective**.
- Preserve existing behavior unless the task explicitly requires change.
- **Claude must follow the same standards and default skill policy defined in this document and in `docs/AI_AGENT_DEVELOPMENT.md`.**

### Mandatory Skill Defaults
- For every meaningful engineering task, architecture change, validation pass, release-readiness check, or repo-standard update, always apply `$enterprise-delivery-defaults` even when the user does not explicitly mention it.
- For every meaningful engineering task, code review, architecture decision, API change, security fix, performance change, or scalability-sensitive implementation, always apply `$enterprise-coding-standards` even when the user does not explicitly mention it.
- For every meaningful engineering task, always apply `$structured-change-documentation` even when the user does not explicitly mention it.
- For every new feature, code change, bug fix, validation task, or release-readiness task that touches Spring Boot, React, PostgreSQL, APIs, auth, or migrations, always apply `$spring-boot-react-postgresql-production-gate` even when the user does not explicitly mention it.
- Execute the default skills in this order: `$enterprise-delivery-defaults` -> `$enterprise-coding-standards` -> `$structured-change-documentation` -> `$spring-boot-react-postgresql-production-gate` when the task scope requires all four.
- Documentation-only edits may skip the coding-standards and production-gate skills, but they must still follow `$enterprise-delivery-defaults` and `$structured-change-documentation`.

## 2) Parallel Work Protocol

### Task Decomposition
Break work into independent tracks:
1. **API/Backend track** (contracts, services, storage)
2. **UI/Desktop track** (views, state, interactions)
3. **Docs/Operations track** (runbooks, architecture notes, scripts)

Each track should have:
- A named owner (`human` or `ai`)
- A clear output artifact
- Explicit dependencies (if any)

### Branching Convention
- Branch name: `<type>/<scope>/<short-description>`
  - Examples: `feat/backend/order-sync`, `fix/desktop/login-timeout`, `docs/ops/deploy-notes`
- Avoid multiple tracks in a single branch unless required for a single atomic change.

### Ownership Boundaries
- Avoid editing files owned by another active track unless:
  - the dependency is declared, or
  - a coordinated handoff is documented in the PR.

## 3) Interface-First Development

When two tracks can run in parallel, agree on contracts first:
- API shape (request/response, errors)
- Data schema changes and migration plan
- Event names/payloads (if applicable)

Record contract decisions in:
- `docs/` for architecture and decisions
- Inline code comments only when needed for non-obvious constraints

## 4) Change Quality Checklist (Human + AI)

Before opening PRs, verify:

### Correctness
- Null/None safety handled on all new code paths.
- Writes are transaction-safe when multiple records must change atomically.
- Retry paths are idempotent.

### Security
- Tenant scoping/authZ validated (e.g., enforce `tenant_id` boundaries).
- Inputs validated/sanitized; reject malformed user input.
- Avoid OWASP basics regressions (injection, broken access control, sensitive data exposure).

### Performance
- Avoid N+1 query patterns.
- Confirm suitable indexes for newly queried fields.
- Use pagination for list endpoints and large result sets.

### Maintainability
- Small focused functions with clear names.
- Keep modules cohesive; avoid cross-layer leakage.
- Add comments where logic is non-obvious (especially AI-generated code).

## 5) PR Requirements

Every PR (human or AI) should include:
1. **What changed** (concise summary)
2. **Why** (problem statement)
3. **How validated** (commands/tests run + outcomes)
4. **Risks & rollback** notes
5. **Follow-ups** (explicitly out-of-scope work)
6. **Default skills applied** (or justification when a default skill is skipped)

Prefer including:
- Before/after behavior notes
- Contract impact (if API/schema changed)
- Which default skills were applied for the task and any reason a normally-required skill was not applicable.

**Enforcement:** Use `.github/PULL_REQUEST_TEMPLATE.md` and `docs/PR_CHECKLIST.md` for every PR.

## 6) Handoff Template

Use this template in PR description or handoff comment:

```md
## Handoff
- Scope completed:
- Decisions made:
- Assumptions:
- Validation run:
- Known limitations:
- Next owner / next step:
```

## 7) Conflict Resolution

If human and AI work collide:
1. Keep the human-authored intent as source of truth for product behavior.
2. Rebase AI changes and preserve contract compatibility.
3. Split conflicting concerns into separate PRs if review becomes unclear.

## 8) Operational Notes

- Keep local tooling reproducible; prefer scripted setup over ad-hoc commands.
- If Docker-based workflows are required, ensure Docker CLI/engine prerequisites are documented and installed in developer environments.
- Do not commit secrets or machine-specific credentials.

## 9) Source File Token Budget Standard

To keep files workable for low-token AI models and human reviewers:

- Source files should stay within `500` lines and `20,000` bytes.
- If a touched file is above the limit, refactor by extracting cohesive modules before or alongside feature edits.
- Validate with:
  - `scripts/check-source-token-budget.sh`
- A PR is not considered maintainability-ready if changed files violate this budget.

## 10) Rapid Project Understanding Playbook (Codex + Claude)

All AI agents must do this lightweight read sequence before coding so parallel contributors share the same context.

### Step-by-step MD read order (follow sequentially)
1. `README.md`
   - Extract project purpose, runtime topology (`backend`, `desktop`, `docker-compose.yml`), and local runbook.
   - Follow the feature-doc links listed there.
2. `docs/AI_AGENT_DEVELOPMENT.md`
   - Apply architecture boundaries, tenant rules, idempotency constraints, and PR readiness gates.
3. `docs/ENTERPRISE_DELIVERY_STANDARD.md`
   - Apply the default skill order, canonical documentation structure, validation matrix, and release-readiness standards.
4. `docs/ENTERPRISE_CODING_STANDARD.md`
   - Apply architecture, design-pattern, API, protocol, security, scalability, performance, and coding rules for this stack.
5. `CLAUDE.md`
   - Confirm detailed stack versions, conventions, environment variables, and endpoint expectations.
6. Feature docs referenced by `README.md` (in this exact order):
   - `docs/features/manage-triggers/feature.md`
   - `docs/features/manage-triggers/test-cases.md`
   - `docs/features/trading-window/feature.md`
   - `docs/features/option-chain/feature.md`
   - `docs/features/option-chain/test-cases.md`
7. Supporting controls (when relevant to the task):
   - `docs/security-measurements.md`
   - `UPSTOX_HISTORICAL_CANDLE_DATA_SYNC_PLAN.md`

If the task touches active in-flight work, also read the matching note in `docs/changes/` after the feature docs.

### Required onboarding output (add to PR or handoff)
Before implementation, summarize these four items in 4-8 bullets:
- **Project purpose**: what user/business workflow the repo serves.
- **Tech stack**: backend, frontend, database, migration, and runtime tooling.
- **Testing procedure**: exact commands for touched areas (backend/frontend/e2e/manual).
- **Certification rules**: merge-readiness gates from `docs/AI_AGENT_DEVELOPMENT.md`:
  - feature tracking,
  - test requirements,
  - verification requirements,
  - security and performance gates.
  Also include release-readiness and rollback requirements from `docs/ENTERPRISE_DELIVERY_STANDARD.md`, plus architecture and coding-standard requirements from `docs/ENTERPRISE_CODING_STANDARD.md`.

### Fast-fail rule
- If any required document is missing, outdated, or contradictory, stop implementation and record a short "doc gap" note in the PR/handoff before coding.
