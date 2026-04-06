# Public Release Checklist

Use this checklist before making the repository public or announcing it.

## Repository Metadata

- [x] `README.md` explains the project, stack, runbook, feature docs, and public-facing value proposition.
- [x] `README.md` includes a sanitized Trading Scripts hero screenshot generated from mocked demo data.
- [x] `README.md` includes maintainer-selected product feature screenshots for Intra Monitor, Advanced Trading Desk, Option Chain, Intra Strategies, Intra P&L, Market Watch, Historical Data, and Manage Triggers.
- [x] `LICENSE` is present.
- [x] `CONTRIBUTING.md` is present.
- [x] `SECURITY.md` is present.
- [x] `CODE_OF_CONDUCT.md` is present.
- [x] `CHANGELOG.md` is present.
- [x] `ROADMAP.md` is present.
- [x] PR template and PR checklist are present.
- [ ] Add `.github/CODEOWNERS` after the maintainer GitHub username or organization team is finalized.

## Secret Safety

- [ ] Search history and working tree for tokens, passwords, broker account identifiers, and production URLs.
- [ ] Publication blocker: current Git history must not be published as-is because older commits contained broker credentials and reusable defaults.
- [ ] Publish from a fresh cleaned repository import or rewrite/squash history before making the repository public.
- [ ] Rotate/revoke any Upstox, OpenAI, provider, or broker token that appears in Git history, even if it is expired or now removed from the working tree.
- [ ] Confirm `.env.production` and `upstox.properties` are not committed.
- [ ] Review screenshots and artifacts for secrets or account data before publishing.
- [ ] Confirm the README hero image was generated from mocked demo data and does not contain account IDs, private URLs, personal emails, tokens, production P&L, or live order identifiers.
- [ ] Rotate any token that may have been used in local testing before public release.

## Build And Run

- [ ] `docker compose config` passes.
- [ ] `docker compose up --build` starts PostgreSQL, backend, and frontend.
- [ ] `cd backend && mvn test` passes or known blockers are documented.
- [ ] `cd desktop && npm run lint && npm run build` passes or known blockers are documented.
- [x] Production-style route certification passed for the running local app: `docs/certification/production-e2e-certification-2026-04-06.md`.
- [ ] `scripts/check-source-token-budget.sh` passes or approved exceptions are documented.

## Feature Documentation

- [x] Feature docs are listed in `docs/features/README.md`.
- [x] Major feature docs link from `README.md`.
- [x] README hero screenshot is sanitized and captured from mocked Trading Scripts demo data.
- [x] Promoted product feature screenshots were scanned for obvious credential/token markers before adding them to public-facing pages.
- [ ] Final maintainer visual review is still required for all screenshots before public launch because the promoted product feature screenshots show local tenant/user labels and market/P&L sample values.
- [ ] Confirm provider-specific limitations are documented for Upstox, OpenAI, and live order flows.

## Public Launch

- [ ] Add GitHub repository topics: `algo-trading`, `spring-boot`, `react`, `postgresql`, `trading-platform`, `backtesting`, `indian-markets`, `upstox`, `paper-trading`, `playwright`, `docker`, `fintech`.
- [ ] Add a concise repository description.
- [ ] Add a GitHub social preview image using the sanitized README hero screenshot or a purpose-built derivative.
- [ ] Enable GitHub Security Advisories.
- [ ] Enable dependency graph, Dependabot/security alerts, and secret scanning or push protection where available for the repository plan.
- [ ] Enable Discussions if maintainers want Q&A and showcase posts.
- [ ] Create beginner-friendly issues from `ROADMAP.md`.
- [ ] Add issue labels such as `good first issue`, `help wanted`, `documentation`, `bug`, and `starter strategy`.
- [ ] Create the first public release, such as `v0.1.0-public-preview`, only after cleaned-history publication and startup validation pass.
