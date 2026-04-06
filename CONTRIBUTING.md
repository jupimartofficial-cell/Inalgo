# Contributing

Thank you for contributing to InAlgo. This repository is a Spring Boot, React, PostgreSQL, and Docker project for Indian market data workflows and trading operations.

## Ground Rules

- Open small, focused pull requests with one bounded objective.
- Preserve existing behavior unless the issue or PR explicitly requires a change.
- Never commit secrets, broker tokens, personal credentials, or real account data.
- Treat `X-Tenant-Id` tenant isolation as a security boundary.
- Keep provider payloads and external market data as untrusted input.
- Use `.github/PULL_REQUEST_TEMPLATE.md` and `docs/PR_CHECKLIST.md` for every PR.
- Follow `AGENTS.md`, `docs/AI_AGENT_DEVELOPMENT.md`, `docs/ENTERPRISE_DELIVERY_STANDARD.md`, and `docs/ENTERPRISE_CODING_STANDARD.md`.

## Local Setup

```bash
git clone <repo-url> Trade
cd Trade

docker compose up -d postgres

cd backend
mvn spring-boot:run

cd ../desktop
npm install
npm run dev:renderer
```

Default local URLs:

- Backend: `http://localhost:8081`
- Frontend: `http://localhost:5173`
- Login tenant: `local-desktop`
- Login username: `admin`
- Login password: seeded by Flyway for local development

## Validation Commands

Run the checks that match your change:

```bash
# Backend
cd backend
mvn test

# Frontend
cd ../desktop
npm run lint
npm run build
npm run test:e2e

# Repo-wide source size guard
cd ..
scripts/check-source-token-budget.sh
```

For a quick command index from the repo root:

```bash
make help
```

## Documentation Expectations

- Update `README.md` for top-level setup, runbook, or feature navigation changes.
- Update `docs/features/<feature>/feature.md` when behavior changes.
- Update `docs/features/<feature>/test-cases.md` when regression or acceptance coverage changes.
- Add a focused note under `docs/changes/` for non-trivial implementation or public-release changes.
- Update `SECURITY.md` if auth, tenant isolation, secret handling, or vulnerability reporting changes.

## PR Checklist

Before requesting review, confirm:

- Build or targeted tests passed for touched areas.
- Tenant scoping and input validation were reviewed for data/API changes.
- Pagination or bounded reads were reviewed for list endpoints.
- Migration order and rollback notes are captured for database changes.
- Docs and feature test cases match the final behavior.
- Risks, rollback, and follow-ups are explicit in the PR body.

## Financial Safety

This project can interact with market data and broker APIs. Do not submit changes that place live orders by default, bypass live-trading confirmations, or store secrets in source control.
