# Public Release Readiness

## Change Summary

- **Date:** 2026-04-06
- **Status:** Complete for documentation, script readiness, and README hero-image scope
- **Scope:** Public repository publishing, contributor onboarding, feature documentation discovery, license and governance files

## Problem And Goal

- The repository needed public-facing documentation so external contributors can understand, run, validate, and safely contribute to the codebase.
- The goal was to add durable public-release artifacts without changing trading runtime behavior.

## Implementation Summary

- Added public governance files:
  - `LICENSE`
  - `CONTRIBUTING.md`
  - `SECURITY.md`
  - `CODE_OF_CONDUCT.md`
  - `CHANGELOG.md`
  - `ROADMAP.md`
- Added release and feature navigation docs:
  - `docs/PUBLIC_RELEASE_CHECKLIST.md`
  - `docs/features/README.md`
- Added contributor command shortcuts:
  - `Makefile`
- Refreshed public runbook and operational docs:
  - `README.md`
  - `.env.production.example`
  - `docker-compose.yml`
  - `.github/PULL_REQUEST_TEMPLATE.md`
  - `docs/PR_CHECKLIST.md`
- Added a sanitized public README hero capture flow:
  - `desktop/e2e/readme-hero.spec.ts`
  - `desktop/e2e/readme-gallery.spec.ts`
  - `docs/assets/inalgo-trading-scripts-hero.png`
- Added production-style route certification:
  - `docs/certification/production-e2e-certification-2026-04-06.md`
- Promoted maintainer-selected production-certification screenshots into the README feature gallery:
  - `docs/assets/product-features/inalgo-intra-monitor.png`
  - `docs/assets/product-features/inalgo-trading-desk.png`
  - `docs/assets/product-features/inalgo-option-chain-live.png`
  - `docs/assets/product-features/inalgo-intra-strategies.png`
  - `docs/assets/product-features/inalgo-intra-pnl.png`
  - `docs/assets/product-features/inalgo-market-watch-live.png`
  - `docs/assets/product-features/inalgo-historical-data.png`
  - `docs/assets/product-features/inalgo-manage-triggers.png`
- Updated `docs/PUBLIC_RELEASE_CHECKLIST.md` to distinguish automated credential/token-marker scanning from the remaining maintainer visual-review gate for screenshots that show local tenant/user labels and market/P&L sample values.

## Feature Impact

- No backend, frontend, database, or API behavior changed.
- Public contributors now have a clearer feature catalog, validation command map, and PR expectations.
- The README now opens with a public-facing value proposition and a mocked Trading Scripts screenshot to help visitors understand the product quickly.
- README now includes a public product preview gallery with Trading Scripts, Intra Monitor, Advanced Trading Desk, Option Chain, Intra Strategies, Intra P&L, Market Watch, Historical Data, and Manage Triggers screenshots.
- Maintainers now have a checklist for secret review, build verification, and GitHub launch metadata before publishing.

## API And Contract Impact

- None.

## Database Impact

- None.

## Validation Performed

- Documentation reference scan:
  - verify public-release files are present
  - verify feature docs are cataloged
- Script/config validation:
  - `make help`
  - `make docker-config`
  - `bash -n scripts/deploy-oracle-cloud.sh`
  - `git diff --check`
- README hero screenshot validation:
  - `cd desktop && npm run test:e2e -- e2e/readme-hero.spec.ts --project=chromium`
  - `cd desktop && npm run test:e2e -- e2e/readme-gallery.spec.ts --project=chromium`
  - manual inspection of `docs/assets/inalgo-trading-scripts-hero.png` for secrets, account data, private URLs, personal emails, and live trading identifiers
- Attached feature screenshot promotion validation:
  - copied selected production-certification screenshots into `docs/assets/product-features/`
  - confirmed each promoted PNG is `1440 x 950`
  - scanned promoted PNG strings for obvious credential/token markers before adding them to the README
- Production-style E2E certification:
  - 16 major routes rendered against running `localhost:5173` and `localhost:8081` without route mocks
  - Result: 16 passed, 0 failed, 0 console errors, 0 page errors, 0 failed API responses
- Frontend static gate:
  - `cd desktop && npm run lint`
  - Result: passed after Monaco type and worker fixes
- Note: `docker compose config` was blocked locally because the Docker CLI plugin was unavailable, but the legacy `docker-compose` binary was available. The Makefile and deploy helper now support both command forms.
- Token-budget gate:
  - `scripts/check-source-token-budget.sh`
  - Result: failed on 34 existing oversized backend/frontend source files. This pass did not refactor unrelated active code; maintainers should address the listed source-file budget violations in focused follow-up PRs.
- Full backend/frontend test execution was not part of this documentation-only release readiness pass.

## Risks And Follow-Ups

- License assumption: MIT was added as the default public open-source license. Maintainers should replace it before publishing if they prefer Apache-2.0, GPL, AGPL, or a private/commercial license.
- Before going public, maintainers must run a final secret scan across Git history, local artifacts, screenshots, and reports. The README hero image was generated from mocked demo data, but all other artifacts still require separate review before public use.
- Runtime credentials are now environment-provided instead of using a reusable checked-in admin password. The tracked `backend/src/main/resources/upstox.properties` placeholder was removed so broker tokens stay out of source control.
- Publication blocker: Git history still contains the previous reusable admin password default and an Upstox token in older commits. Rotate/revoke the token, then publish from a fresh cleaned repository import or rewrite/squash history before making the repository public.
- CI workflows are still a recommended next step and are tracked in `ROADMAP.md`.
- `CODEOWNERS`, GitHub social preview, repository topics, issue labels, and first public release creation remain launch tasks because they depend on final GitHub owner/repository settings.
- The production-style certificate covers local route rendering only; live broker order placement and provider-backed data flows still require private-environment certification with valid credentials.
- Repository URL placeholders must be updated after the public GitHub repository slug is finalized.

## Agent Handoff Note

- Start with `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `docs/PUBLIC_RELEASE_CHECKLIST.md` for public-release context.
- Re-run `desktop/e2e/readme-hero.spec.ts` whenever the README hero screenshot needs to be refreshed; keep the mocked demo data sanitized and do not replace it with real-data artifacts.
- Do not weaken tenant isolation, live-order confirmations, or secret-handling guidance while improving contributor friendliness.
- If maintainers choose a different license, update `LICENSE`, `README.md`, and any GitHub repository metadata together.
