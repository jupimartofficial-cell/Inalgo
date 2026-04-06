# Feature Documentation

This directory is the public feature catalog for the InAlgo Trade platform.

| Feature | Behavior Doc | Test Cases |
|---|---|---|
| Intra Trade | `docs/features/intra-trade/feature.md` | `docs/features/intra-trade/test-cases.md` |
| Manage Triggers | `docs/features/manage-triggers/feature.md` | `docs/features/manage-triggers/test-cases.md` |
| Market Trend | `docs/features/market-trend/feature.md` | `docs/features/market-trend/test-cases.md` |
| Market Watch | `docs/features/market-watch/feature.md` | `docs/features/market-watch/test-cases.md` |
| Option Chain | `docs/features/option-chain/feature.md` | `docs/features/option-chain/test-cases.md` |
| Trading Desk | `docs/features/trading-desk/feature.md` | `docs/features/trading-desk/test-cases.md` |
| Trading Scripts | `docs/features/trading-scripts/feature.md` | `docs/features/trading-scripts/test-cases.md` |
| Trading Window | `docs/features/trading-window/feature.md` | covered by `desktop/e2e/trading-window.spec.ts` |

## Documentation Rules

- Update the feature doc when user-visible behavior, API contracts, persistence, or operational constraints change.
- Update test cases when acceptance criteria, regression flows, or certification procedures change.
- Add a `docs/changes/<change>.md` note for non-trivial implementation work or public-release handoff context.
- Keep feature docs factual: document implemented behavior only, not future plans.
