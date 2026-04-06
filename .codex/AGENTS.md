# Multi-AI Agent Architecture & Delivery Rules

## Purpose
This document defines how human developers and AI agents collaborate safely in this repository.
It is intentionally explicit so independent agents can work on backend, frontend, and migration features
without drifting from shared quality standards.

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

## Mandatory PR readiness checklist
All features must satisfy the checks below before PR submission.

### A. Feature tracking
- [ ] A short implementation note is added in `README.md` (or relevant feature document).
- [ ] API/interface changes are documented (request params, headers, behavior, failure modes).
- [ ] Any new config/env var is documented with default and override behavior.

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

# InAlgo — Web Admin Console + Trade Backend

A desktop app for Indian traders to sync multi-timeframe candles (2020 → today) for spot indices (NIFTY 50, BANKNIFTY, SENSEX) and index futures, run backtests, and execute index F&O trades via Upstox.

## Implemented project setup

```text
.
├── backend/                  # Spring Boot 3 + Java 21 local API service
├── desktop/                  # React + Vite web admin frontend (desktop folder retained)
├── docker-compose.yml        # Optional local containerized setup
├── scripts/install-docker.sh # Docker installation helper (Ubuntu/Debian)
└── .codex/install.sh         # One-command fast container build + startup
```

## Backend stack (implemented)
- Java 21 + Spring Boot 3.3
- REST APIs with validation
- WebSocket STOMP endpoint (`/ws/events`) + heartbeat broadcast (`/topic/heartbeat`)
- Scheduling enabled (`@EnableScheduling`)
- PostgreSQL via `org.postgresql:postgresql`
- Flyway migrations (`backend/src/main/resources/db/migration`)
- Spring Data JPA with PostgreSQL dialect
- Tenant isolation via mandatory `X-Tenant-Id` request header
- Candle upsert API is idempotent on `(tenant_id, instrument_key, timeframe_unit, timeframe_interval, candle_ts)`
- Trading preferences persistence in dedicated `trading_preference` table keyed by `(tenant_id, username)`
- Migration runtime status persistence in `admin_migration_job` table keyed by stream identity

## Frontend stack (updated for web)
- React + TypeScript + Vite web application
- MUI-based enterprise admin UI
- Admin login + migration controls + migration status monitor + historical data grid
- Dedicated `Option Chain` screen (NIFTY/BANKNIFTY/SENSEX) with expiry selector, CE/PE table, OI bars, and auto-refresh
- Migration job control is manual per stream (start/pause/resume/stop one-by-one)
- `Trading window` feature with:
  - Up to 5 tabs
  - 2 to 10 charts per tab (add/delete enforced)
  - Resizable chart tiles
  - `lightweight-charts` candles + volume + SMA/EMA overlays
  - Instrument/timeframe selectors with custom instrument support
  - Per-user layout persistence (load + autosave + manual save)

## End-to-end local runbook (Git checkout → running services)

### 1) Clone repository and checkout branch
```bash
# clone once
git clone <your-repo-url> Trade
cd Trade

# switch to your working branch
git checkout <branch-name>
```

### 2) Install prerequisites
```bash
# Java + Maven for backend
java -version
mvn -version

# Node.js + npm for frontend
node -v
npm -v
```

### 3) Install docker package (optional, but recommended)
```bash
# Ubuntu / Debian helper provided by this repo
chmod +x scripts/install-docker.sh
./scripts/install-docker.sh

# verify installation
docker --version
docker compose version
```

### 4) Start PostgreSQL
Use either Docker Compose (recommended) or your own local PostgreSQL.

```bash
# starts only database service in background
docker compose up -d postgres

# validate DB container health
docker compose ps
```

### Optional fast container setup (recommended for first run)
```bash
# installs docker package if needed, enables BuildKit, pre-pulls base images,
# builds services in parallel, and starts the stack
chmod +x .codex/install.sh
./.codex/install.sh
```

### 5) Run backend server (Spring Boot)
```bash
cd backend

# Optional DB overrides (only if not using default localhost values)
# export DB_URL=jdbc:postgresql://localhost:5432/trade
# export DB_USERNAME=<local-db-user>
# export DB_PASSWORD=<local-db-password>

mvn spring-boot:run
```

Backend defaults to `http://localhost:8081`.

### 6) Run frontend server (Vite)
Open a second terminal:
```bash
cd Trade/desktop
npm install
npm run dev:renderer
```

Frontend defaults to `http://localhost:5173`.

### 7) Login and verify UI workflows
1. Open `http://localhost:5173`.
2. Login with tenant `local-desktop`, username `admin`, and the Flyway-seeded local admin password.
3. Migration tab:
   - Use **Start** on each job card to run streams one-by-one manually.
   - Click **Refresh Status**.
4. Historical Data tab:
   - Enter instrument/timeframe filters.
   - Click **Apply Filters**.
5. Option Chain tab:
   - Open **Option Chain** from the left menu.
   - Select underlying and expiry.
   - Verify live CE/PE rows and summary chips.
   - Use **Migrate Historical** for bootstrap snapshot capture across available expiries.
5. Trading window tab:
   - Open **Trading window** from the left menu.
   - Add charts and tabs (up to 5 tabs / up to 10 charts per tab).
   - Change instrument/timeframe and resize chart tiles.
   - Click **Save Layout**.
   - Refresh page and verify the same layout reloads for the same username.

### 8) Optional all-in-one Docker startup
```bash
docker compose up --build
# PostgreSQL data persisted under docker volume: pg_data
```

### 9) Run feature tests
```bash
# backend preference service tests
cd backend
mvn -Dtest=TradingPreferenceServiceTest test

# frontend type-check + build + e2e
cd ../desktop
npm run lint
npm run build
npm run test:e2e
```

## Key API endpoints
- `POST /api/v1/candles` (upsert candle)
- `GET /api/v1/candles` (paged query with `from/to` range)
- WebSocket endpoint: `/ws/events`
- Heartbeat topic: `/topic/heartbeat`
- `GET /api/v1/upstox/intraday` (proxy Upstox intraday candles)
- `GET /api/v1/upstox/historical` (proxy Upstox historical candles)
- `GET /api/v1/upstox/option-chain` (proxy Upstox option chain)
- `GET /api/v1/upstox/option-contracts` (proxy Upstox option contracts/expiries)
- `POST /api/v1/upstox/connectivity-test` (matrix connectivity checks by instruments/timeframes)
- `GET /api/v1/admin/historical-data` (admin paged candle query)
- `GET /api/v1/admin/option-chain/expiries` (option expiry list for underlying)
- `GET /api/v1/admin/option-chain/latest` (latest option chain snapshot rows)
- `GET /api/v1/admin/option-chain/history` (paged historical snapshot rows)
- `POST /api/v1/admin/option-chain/migrate-historical` (bootstrap option-chain snapshot capture)
- `POST /api/v1/admin/migrations/{jobKey}/start` (manual per-job start/restart)
- `POST /api/v1/admin/migrations/{jobKey}/pause`
- `POST /api/v1/admin/migrations/{jobKey}/resume`
- `POST /api/v1/admin/migrations/{jobKey}/stop`
- `GET /api/v1/admin/triggers` (list configured sync triggers)
- `POST /api/v1/admin/triggers` (create a new time-driven trigger)
- `POST /api/v1/admin/triggers/{triggerId}/start`
- `POST /api/v1/admin/triggers/{triggerId}/pause`
- `POST /api/v1/admin/triggers/{triggerId}/resume`
- `POST /api/v1/admin/triggers/{triggerId}/stop`
- `GET /api/v1/admin/trading/preferences?username=<username>` (load user trading layout)
- `PUT /api/v1/admin/trading/preferences` (save user trading layout payload)

> All REST calls require `X-Tenant-Id`.

## Upstox configuration
- Upstox token is tenant-scoped and stored in DB via Admin UI (`Migration Jobs` section).
- Trigger scheduler poll interval:
  - `ADMIN_TRIGGER_POLL_MS`
- `UPSTOX_BASE_URL` can be set for sandbox environments.
- Option-chain scheduler config keys:
  - `UPSTOX_OPTION_CHAIN_ENABLED`
  - `UPSTOX_OPTION_CHAIN_TENANT_ID`
  - `UPSTOX_OPTION_CHAIN_REFRESH_SECONDS`
  - `UPSTOX_OPTION_CHAIN_MAX_EXPIRIES`

## Default migration catalog instruments
- Spot indices:
  - `NSE_INDEX|Nifty 50`
  - `NSE_INDEX|Nifty Bank`
  - `BSE_INDEX|SENSEX`
- Current monthly futures (added to migration jobs with same timeframes):
  - `NSE_FO|51714` (`NIFTY FUT 30 MAR 26`)
  - `NSE_FO|51701` (`BANKNIFTY FUT 30 MAR 26`)
  - `BSE_FO|825565` (`SENSEX FUT 25 MAR 26`)

Note: futures instrument keys are contract-specific and must be rolled forward on expiry.

## Feature documentation
- Manage triggers feature: `docs/manage-triggers-feature.md`
- Manage triggers test cases: `docs/manage-triggers-test-cases.md`
- Trading window feature: `docs/trading-window-feature.md`
- Option chain feature: `docs/option-chain-feature.md`
- Option chain test cases: `docs/option-chain-test-cases.md`

## Multi-AI agent collaboration rules
- Architecture and delivery workflow rules for AI + human contributors live in `docs/AI_AGENT_DEVELOPMENT.md`.
- Follow the PR readiness checklist in that document so every feature is tracked, tested, and verified before merge.
- Keep controller/service/repository responsibilities separated to preserve safe parallel development by multiple agents.

