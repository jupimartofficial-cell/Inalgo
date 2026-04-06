# CLAUDE.md — InAlgo Trade Platform

This file provides AI assistants with essential context about the codebase, conventions, and workflows for the InAlgo Trade platform. Read this before making any changes.

---

## Project Overview

InAlgo is a multi-tenant financial data platform for Indian traders. It syncs multi-timeframe OHLCV candle data (2020 → today) for NSE/BSE spot indices (NIFTY 50, BANKNIFTY, SENSEX) and configured index futures from Upstox, provides historical data browsing, and is the foundation for backtesting and F&O trade execution.

**Key capabilities:**
- Backfill and maintain candle data from Upstox V3 APIs
- Tenant-scoped admin console (login, migration jobs, trigger management, status monitoring)
- Paginated historical data queries by instrument, timeframe, and date range
- WebSocket heartbeat for real-time UI updates
- Default migration catalog includes spot indices plus current monthly futures keys:
  - `NSE_FO|51714` (`NIFTY FUT 30 MAR 26`)
  - `NSE_FO|51701` (`BANKNIFTY FUT 30 MAR 26`)
  - `BSE_FO|825565` (`SENSEX FUT 25 MAR 26`)

---

## Repository Structure

```
Trade/
├── backend/                  # Spring Boot 3 / Java 21 REST API
│   ├── src/main/java/com/inalgo/trade/
│   │   ├── controller/       # HTTP handlers (candle, exception)
│   │   ├── service/          # Business logic (candle, heartbeat)
│   │   ├── admin/            # Admin APIs (login, migration jobs, trigger lifecycle, status)
│   │   ├── upstox/           # Upstox integration (client, migration, connectivity)
│   │   ├── entity/           # JPA entities (candle, migration state)
│   │   ├── repository/       # Spring Data repositories
│   │   ├── security/         # Tenant context + header filter
│   │   ├── config/           # WebSocket, CORS configs
│   │   └── dto/              # Request/response DTOs
│   ├── src/main/resources/
│   │   ├── application.yml   # Main config (see Environment Variables)
│   │   └── db/migration/     # Flyway SQL migrations (V1, V2, ...)
│   └── src/test/             # Unit + integration tests
├── desktop/                  # React 18 + TypeScript + Vite web frontend
│   ├── src/renderer/src/
│   │   ├── App.tsx           # Main admin console UI shell and navigation
│   │   ├── api/admin.ts      # API client (login, migration, triggers, historical data)
│   │   ├── api/candles.ts    # Candle query client
│   │   └── components/       # UI components (CandleChart, trigger panel, etc.)
│   ├── src/main/main.ts      # Electron main process
│   └── src/preload/          # Electron preload / IPC bridge
├── docs/
│   ├── AI_AGENT_DEVELOPMENT.md   # Multi-agent collaboration rules (read this too)
│   ├── ENTERPRISE_DELIVERY_STANDARD.md # Enterprise delivery defaults, release gates, and artifact rules
│   ├── ENTERPRISE_CODING_STANDARD.md # Repo coding, API, security, scalability, and performance standards
│   └── analytics-dashboard-ux-spec.md
├── scripts/
│   ├── install-docker.sh         # Docker setup helper (Ubuntu/Debian)
│   └── upstox_endpoint_matrix_test.py  # Upstox API coverage testing
├── docker-compose.yml            # PostgreSQL + backend + frontend containers
├── README.md                     # End-to-end runbook
└── UPSTOX_HISTORICAL_CANDLE_DATA_SYNC_PLAN.md  # V3 API design reference
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend language | Java 21 |
| Backend framework | Spring Boot 3.3.5 |
| ORM | Spring Data JPA + Hibernate |
| Database | PostgreSQL 16 |
| DB migrations | Flyway |
| Build tool (backend) | Maven |
| Frontend language | TypeScript 5.6 |
| Frontend framework | React 18.3 |
| UI library | Material-UI (MUI) 6 |
| Bundler | Vite 5.4 |
| Desktop wrapper | Electron 33 (optional) |
| Containerization | Docker + Docker Compose |

---

## Delivery Standards

- Read `AGENTS.md`, `docs/AI_AGENT_DEVELOPMENT.md`, `docs/ENTERPRISE_DELIVERY_STANDARD.md`, and `docs/ENTERPRISE_CODING_STANDARD.md` before major implementation work.
- Default skill order for meaningful engineering tasks in this repo:
  - `$enterprise-delivery-defaults`
  - `$enterprise-coding-standards`
  - `$structured-change-documentation`
  - `$spring-boot-react-postgresql-production-gate` when code, schema, auth, API, or release validation is involved
- Treat `docs/ENTERPRISE_DELIVERY_STANDARD.md` as the source of truth for enterprise artifact expectations, release-readiness, and rollback notes.
- Treat `docs/ENTERPRISE_CODING_STANDARD.md` as the source of truth for architecture, API, protocol, security, scalability, performance, and coding-quality rules.
- Enforce source-file AI token budget for code changes by running `scripts/check-source-token-budget.sh` (default budget: `500` lines and `20,000` bytes per file).
- Claude must follow the same standards and default skill order as Codex and any other AI agents in this repo.
- All PRs must use `.github/PULL_REQUEST_TEMPLATE.md` and `docs/PR_CHECKLIST.md`.

---

## Development Setup

### Prerequisites

```bash
java -version   # Java 21+
mvn -version    # Maven 3.8+
node -v         # Node 18+
npm -v
docker --version
docker compose version
```

### Start Database

```bash
docker compose up -d postgres
```

### Run Backend

```bash
cd backend
mvn spring-boot:run
# Starts on http://localhost:8081
```

### Run Frontend

```bash
cd desktop
npm install
npm run dev:renderer
# Starts on http://localhost:5173
```

### All-in-one (Docker)

```bash
docker compose up --build
```

### Local Login

| Field | Value |
|-------|-------|
| Tenant ID | `local-desktop` |
| Username | `admin` |
| Password | seeded by Flyway for local development |
| Backend URL | `http://localhost:8081` |
| Frontend URL | `http://localhost:5173` |

---

## Environment Variables

All have defaults in `application.yml`. Override with environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_URL` | `jdbc:postgresql://localhost:5432/trade` | PostgreSQL JDBC URL |
| `DB_USERNAME` | required | DB username |
| `DB_PASSWORD` | required | DB password |
| `UPSTOX_BASE_URL` | `https://api.upstox.com` | Upstox API base (use sandbox for testing) |
| `UPSTOX_ACCESS_TOKEN` | not set in source | Legacy env override for local probes; runtime tokens should be configured through the Admin UI per tenant |
| `UPSTOX_MIGRATION_ENABLED` | `true` | Enable/disable background migration |
| `UPSTOX_MIGRATION_CRON` | `0 */5 * * * *` | Migration scheduler cron |
| `UPSTOX_MIGRATION_INTRADAY_WINDOW_DAYS` | `5` | Default intraday fetch window |
| `UPSTOX_MIGRATION_INTRADAY_MIN_WINDOW_DAYS` | `2` | Minimum window after adaptive halving |
| `UPSTOX_MIGRATION_LONG_WINDOW_DAYS` | `30` | Window for daily/weekly/monthly timeframes |
| `MARKET_SENTIMENT_ENABLED` | `true` | Enable/disable scheduled market-trend refresh |
| `MARKET_SENTIMENT_TENANT_ID` | `local-desktop` | Tenant used by the scheduled market-trend refresh |
| `MARKET_SENTIMENT_CRON` | `0 */5 * * * *` | Market-trend scheduler cron |
| `MARKET_SENTIMENT_TIMEOUT_SECONDS` | `20` | External feed/API timeout for market-trend refresh |
| `MARKET_SENTIMENT_NEWS_LOOKBACK_HOURS` | `48` | News lookback window for trend scoring |
| `MARKET_SENTIMENT_MAX_ITEMS_PER_SOURCE` | `8` | Maximum recent items to inspect per configured source |
| `ADMIN_SESSION_MINUTES` | `360` | Admin session timeout |
| `MARKET_HOURS_ZONE_ID` | `Asia/Kolkata` | Zone used to evaluate trigger and scheduler market hours |
| `MARKET_HOURS_OPEN_TIME` | `09:15` | Start of the India business-hour execution window |
| `MARKET_HOURS_CLOSE_TIME` | `15:30` | End of the India business-hour execution window |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Allowed CORS origins |

---

## Key Commands

```bash
# Backend: run all tests
cd backend && mvn test

# Backend: build JAR
cd backend && mvn clean package -DskipTests

# Frontend: type check + lint
cd desktop && npm run build

# Repo-wide source-file token budget gate
cd .. && scripts/check-source-token-budget.sh

# Frontend: dev server only
cd desktop && npm run dev:renderer

# Frontend: package Electron app
cd desktop && npm run package
```

---

## Architecture & Conventions

### Strict Layer Separation

```
Controller → Service → Repository → Entity
```

- **Controllers** (`controller/`, `admin/`, `upstox/`): HTTP mapping, request validation, response mapping only. No business logic. No direct DB calls.
- **Services** (`service/`, `admin/`, `upstox/`): All business rules, tenant constraints, retry logic, migration workflows.
- **Repositories**: Persistence only. Use Spring Data JPA query methods or `@Query` for custom SQL.
- **Frontend `api/` modules**: Remote call boundaries and DTO typing only. No business logic in API clients.
- **Frontend components**: UI and state orchestration only.

### Tenant Isolation — Non-Negotiable

Every request that touches data must carry and validate `X-Tenant-Id`.

- `TenantHeaderFilter` extracts the header into `TenantContext` (ThreadLocal).
- All service methods that read or write tenant data must scope queries to the current tenant.
- Migration jobs only run streams configured for the requesting tenant.
- Never mix tenant data — treat this as a security boundary.

```java
// Always scope queries to tenant
String tenantId = TenantContext.getTenantId();
repository.findByTenantIdAndInstrumentKey(tenantId, instrumentKey);
```

### Idempotent Data Ingestion

Candle upsert is idempotent on the unique key:
```
(tenant_id, instrument_key, timeframe_unit, timeframe_interval, candle_ts)
```

- Always use the existing upsert query — never ad-hoc inserts.
- Migration jobs must tolerate restarts and retries without creating duplicate data.
- Any new import/sync code must follow this contract.

### Migration State Machine

`UpstoxMigrationStateEntity` tracks migration lifecycle:
```
PENDING → RUNNING → COMPLETED
                  → FAILED
```

- `checkpoint` field stores the last successfully processed date for resumable backfills.
- `errorMessage` stores the last failure reason.
- Adaptive windowing: on `UDAPI1148` (validation) errors, the fetch window is halved. This is a deliberate anti-throttling strategy — do not remove it.

### Database Migrations

- Schema is managed exclusively by Flyway. Never use `ddl-auto: create` or `update`.
- Migration files live in `backend/src/main/resources/db/migration/`.
- Naming: `V{n}__{description}.sql` (e.g., `V3__add_column_x.sql`).
- Migrations must be backward-compatible and idempotent where possible.

### API Design Patterns

- All list endpoints must enforce pagination (`page` + `size`, max `size=500`).
- All endpoints require `X-Tenant-Id` header.
- Admin endpoints additionally require `Authorization: Bearer <jwt>` header.
- Error responses use the centralized `ApiExceptionHandler`.
- WebSocket STOMP endpoint: `/ws/events`, heartbeat topic: `/topic/heartbeat`.

### Frontend Conventions

- All API calls go through `src/renderer/src/api/` modules — never inline fetch in components.
- Always send `X-Tenant-Id` and `Authorization` headers from the API client layer.
- Use MUI components for all UI elements; do not introduce additional UI libraries.
- TypeScript strict mode is enabled — all types must be explicit.

---

## Key API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/admin/login` | None | Get JWT token |
| `POST` | `/api/v1/admin/migration/trigger` | JWT | Trigger migration job |
| `GET` | `/api/v1/admin/migration/status` | JWT | List migration states |
| `POST` | `/api/v1/candles` | Tenant header | Upsert candle data |
| `GET` | `/api/v1/candles` | Tenant header | Paginated candle query |
| `GET` | `/api/v1/upstox/historical` | Tenant header | Proxy Upstox historical |
| `GET` | `/api/v1/upstox/intraday` | Tenant header | Proxy Upstox intraday |
| `POST` | `/api/v1/upstox/connectivity-test` | Tenant header | Matrix connectivity test |
| `GET` | `/api/v1/admin/intra-trade/pnl/dashboard` | JWT | Intra P&L dashboard (summary, trend, strategy perf, ledger) |
| `GET` | `/api/v1/admin/intra-trade/pnl/export` | JWT | Download P&L report (`format=CSV\|XLSX\|PDF`) |
| `GET` | `/api/v1/admin/intra-trade/upstox/positions` | JWT | Live Upstox short-term positions |
| `GET` | `/api/v1/admin/intra-trade/upstox/orders` | JWT | Today's Upstox order book |
| WS | `/ws/events` | None | STOMP WebSocket |

> All REST calls require `X-Tenant-Id` header.

---

## Testing

### Backend

Tests live in `backend/src/test/java/com/inalgo/trade/`.

| Test file | Coverage |
|-----------|----------|
| `TradeBackendApplicationTests` | Spring context startup |
| `AdminMigrationServiceTest` | Migration orchestration logic |
| `UpstoxClientTest` | Upstox HTTP client calls |
| `UpstoxHistoricalMigrationServiceTest` | Migration state machine |
| `UpstoxHistoricalMigrationPostgresIntegrationTest` | Full DB integration |
| `UpstoxConnectivityServiceTest` | Connectivity matrix |

Run all backend tests:
```bash
cd backend && mvn test
```

### Frontend

TypeScript type checking via the build:
```bash
cd desktop && npm run build
```

---

## PR Readiness Checklist

Before opening a PR, verify all of the following:

**Feature tracking**
- [ ] Implementation note added to `README.md` or relevant feature doc
- [ ] API/interface changes documented (params, headers, behavior, failure modes)
- [ ] New config/env vars documented with defaults

**Tests**
- [ ] Unit/integration tests added or updated for changed behavior
- [ ] Existing tests pass: `cd backend && mvn test`
- [ ] Error paths tested (validation failures, auth failures, provider failures)
- [ ] Idempotency tested for any data write paths

**Verification**
- [ ] `cd desktop && npm run build` passes without errors
- [ ] Manual verification steps recorded when automated checks are insufficient

**Security & performance**
- [ ] Tenant authorization validated for all data paths
- [ ] Input validation added for external/user-controlled inputs
- [ ] Pagination limits enforced on new list endpoints
- [ ] New queries reviewed for N+1 and missing indexes

---

## Critical Rules for AI Assistants

1. **Never bypass tenant isolation.** Any code that touches data must be scoped to the current tenant. Treat this as a security boundary.

2. **Never use direct inserts for candle data.** Always use the idempotent upsert path. Duplicate candles will break downstream calculations.

3. **Never modify Flyway migrations that have already been applied.** Create a new migration file instead.

4. **Never use `ddl-auto: create` or `update`.** Flyway exclusively manages schema.

5. **Keep layers separated.** Do not add business logic to controllers or persistence logic to services.

6. **Preserve the adaptive windowing logic** in `UpstoxHistoricalMigrationService`. It is the primary defense against Upstox API rate limits.

7. **Do not commit real Upstox tokens.** Use tenant-scoped Admin UI storage or local ignored files/environment variables for probes only.

8. **Small, focused PRs.** One feature family per PR. Avoid cross-layer rewrites unless required for correctness or security.

9. **All new list endpoints must have pagination.** Max page size: 500.

10. **Frontend API calls go through `api/` modules only.** Never inline `fetch()` directly in React components.

---

## Useful References

- `docs/AI_AGENT_DEVELOPMENT.md` — Multi-agent collaboration rules and delivery workflow
- `UPSTOX_HISTORICAL_CANDLE_DATA_SYNC_PLAN.md` — Upstox V3 API reference, error codes, adaptive windowing design
- `backend/src/main/resources/db/migration/` — Schema history
- `docker-compose.yml` — Service topology and port mappings
