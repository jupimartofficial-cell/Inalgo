# Analytics Dashboard UX Specification

> **Note**: Section 2 (`InAlgo Intra P&L Screen`) documents the InAlgo-specific trader-facing screen.
> Section 1 (`Generic Analytics Dashboard`) is the original generic template instance.

---

## Section 2 — InAlgo Intra P&L Screen UX Specification

**Route**: `Backtest > Intra P&L` (subsection `intra-pnl`)
**Last updated**: 2026-03-26
**Status**: Implemented & verified with real data

### Purpose
The Intra P&L screen is the primary performance analytics and live portfolio view for the InAlgo intraday trading workspace. It consolidates executed strategy P&L, strategy-level diagnostics, individual trade records, and a live Upstox portfolio feed into a single page with two top-level tabs.

---

### Tab 1: InAlgo P&L

#### Page Header
| Element | Description |
|---|---|
| Title | "Intra P&L" (h5, fontWeight 800) |
| P&L badge | Total P&L chip inline with title — green background + text when positive, red when negative |
| Actions | "Clear Workspace" (outlined) + "Open Intra Monitor" (contained, with arrow icon) |

#### Tab bar
Plain HTML `button` tab strip with active underline indicator. Two tabs: **InAlgo P&L** and **Upstox Portfolio** (with bank icon).

#### Filters Panel (collapsible)
- Section header: "Filters" with collapse chevron (rotates 180° when open) and inline export buttons (Apply, CSV, XLSX, PDF)
- Filter fields: Mode (All/Paper/Live), Status (All/Open/Closed), Range (Today/This Week/This Month/Custom Range), optional From/To date pickers (shown only when Range = Custom), Strategy text, Instrument text, Account text
- Collapses via MUI `Collapse` with animated chevron

#### P&L Summary Panel (collapsible)
- Section header: "P&L Summary" with collapse chevron
- 8 metric cards in a responsive grid (2 col on mobile, 3 on tablet, 4 on desktop):

| Card | Color scheme |
|---|---|
| Total P&L | Green bg + text if positive; red if negative |
| Today's P&L | Same as Total P&L |
| Realized P&L | Same as Total P&L |
| Unrealized P&L | Same as Total P&L |
| Win Rate | Neutral + linear progress bar (green if ≥50%, red if <50%) |
| Avg Gain / Trade | Green bg + text if positive |
| Avg Loss / Trade | Red bg + text if negative |
| Max Drawdown | **Amber/yellow background + amber text** (risk metric — never colored green even when value is positive) |

#### Performance Charts Panel (collapsible)
- Section header: "Performance Charts" with collapse chevron
- Two side-by-side sub-charts (stack on mobile):
  - **Daily P&L Trend**: horizontal bar chart, last 14 days, each row = `[MODE chip] [DD/MM/YY date] [proportional bar] [₹value]`; green bars for profit, red for loss
  - **Cumulative P&L**: same layout but shows running cumulative value instead of daily delta
- Date format: `DD/MM/YY` (e.g. `26/03/26`)

#### Strategy Performance Panel (collapsible)
- Section header: "Strategy Performance" + count badge (e.g. "5") + collapse chevron
- Search input with magnifier icon (filters strategy name client-side, resets page to 0)
- Sortable table columns: **Trades** ↑↓, **Win %** ↑↓, **Total P&L** ↑↓ (click header to toggle asc/desc; default: Total P&L desc)
- Non-sortable columns: Strategy, Avg Trade, Max Win, Max Loss, Drawdown, Paper / Live chip
- Win % column shows value + mini linear progress bar
- Color rules: Total P&L / Avg Trade use `pnlColor` (green/red); Max Win fixed green; Max Loss fixed red; Drawdown fixed amber
- Pagination: 5 / 10 / 25 rows per page (only shown when rows > page size)

#### Trade Ledger Panel (collapsible)
- Section header: "Trade Ledger" + count badge (e.g. "13") + collapse chevron
- Local filter row (independent of global Filters panel):
  - Search input: filters by instrument, strategy, exit reason
  - Mode dropdown: All / Paper / Live
  - Status dropdown: All / Open / Closed
- Table columns: Date (DD/MM/YY), Time (HH:mm), Instrument, Strategy (truncated with ellipsis at 140px), Mode chip, Qty, P&L, Exit Reason (truncated), Status chip
- Row background: light green (#f0fdf4) for profit, light red (#fef2f2) for loss
- Table wrapped in `overflow-x: auto` with `min-width: 680px` for narrow viewports
- Pagination: 10 / 25 / 50 / 100 rows per page (always visible)

---

### Tab 2: Upstox Live Portfolio

#### Header
- Title: "Upstox Live Portfolio" with bank icon
- Subtitle with "Last synced: HH:MM:SS" timestamp (IST locale)
- Auto-refresh toggle chip ("Auto-refresh OFF" / "Auto-refresh ON (30s)") — toggles 30-second interval polling
- Manual refresh icon button (shows spinner while loading)

#### Summary Cards
4 cards in a 2×2 grid: Total P&L (Day), Open Positions, Orders Today, Filled Orders

#### Positions Table (collapsible)
- Section header: "Positions" + count badge + collapse chevron
- Columns: Symbol (trading name + instrument token sub-label), Net Qty (chip: green if long, red if short), Avg Buy, Avg Sell, LTP, P&L
- Row background: light green if P&L > 0, light red if P&L < 0

#### Orders Today Table (collapsible)
- Section header: "Orders Today" + count badge + collapse chevron
- Columns: Symbol (trading name + order ID monospace sub-label), Side (BUY=green chip / SELL=red chip), Qty / Filled (stacked: total qty + "filled: N" sub-label), Type, Price / Avg (stacked: limit price + "avg: N" sub-label), Status (chip: success/error/warning), Tag

#### Error handling
- Error alert with "Upstox sync failed: {message}" and Retry button
- Loading alert "Syncing with Upstox…" while fetching

---

### Bug Fix: Upstox API Snake_Case Deserialization (2026-03-26)

**Root cause**: Upstox v2 API returns JSON in snake_case (`instrument_token`, `trading_symbol`, `buy_price`, `filled_quantity`, etc.). Spring Boot's default Jackson `ObjectMapper` uses camelCase property binding. Without `@JsonProperty` annotations on the DTO records, all Upstox response fields silently deserialized to `null`.

**Fix applied**:
- `UpstoxOrderDtos.PositionDetail`: added `@JsonProperty` for all 15 fields
- `UpstoxOrderDtos.OrderDetail`: added `@JsonProperty` for all 16 fields
- `UpstoxOrderDtos.IntraOrderResult`: added `tradingSymbol`, `filledQuantity`, `averagePrice` fields
- `UpstoxOrderService.fetchOrders()`: maps `tradingSymbol`, `filledQuantity`, `averagePrice` from `OrderDetail`
- `intraPnlAnalytics.types.ts` (`UpstoxOrderItem`): added `tradingSymbol`, `filledQuantity`, `averagePrice` fields

**Impact**: Positions table now shows correct symbol names, quantities, prices, and P&L. Orders table now shows human-readable `tradingSymbol` and filled quantity / average price.

---

### Key API Endpoints (Intra P&L)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/intra-trade/pnl/dashboard` | Full dashboard (summary, trend, cumulative, strategy perf, ledger). Refreshes daily aggregates on every call. Params: `username`, `mode`, `status`, `fromDate`, `toDate`, `strategy`, `instrument`, `account` |
| `GET` | `/api/v1/admin/intra-trade/pnl/export` | Download report. Param: `format=CSV\|XLSX\|PDF` |
| `GET` | `/api/v1/admin/intra-trade/upstox/positions` | Live positions from Upstox `/v2/portfolio/short-term-positions` |
| `GET` | `/api/v1/admin/intra-trade/upstox/orders` | Today's orders from Upstox `/v2/order/retrieve-all` |

---

## Section 1 — Generic Analytics Dashboard (Original)

This document instantiates `ui-design-template.generic.yaml` for the Analytics dashboard shown in the provided reference images.

## Reference Images
- `reference-dashboard-collapsed-sidebar` (image 1)
- `reference-dashboard-expanded-sidebar` (image 2)

## Filled Template Instance

```yaml
# file: ui-design-template.generic.yaml
template_version: "1.0"
template_name: "Generic App Dashboard UI Template"
intended_for: "AI agents (UX spec -> UI generation)"
notes:
  - "This is a generic, reusable template for dashboard-style apps."
  - "Copy this file and fill the 'instance.*' section for each new screen."

instance:
  product_name: "NiceDash"
  page:
    id: "analytics_dashboard"
    title: "Analytics"
    route: "/dashboard/analytics"
    purpose: "Provide at-a-glance performance metrics, trend charts, and regional traffic breakdown for quick operational decisions."
    variants:
      - id: "variant_a"
        description: "Expanded sidebar with full labels and grouped navigation sections"
      - id: "variant_b"
        description: "Collapsed sidebar with icon-first navigation and tooltip/hover expansion behavior"
  data_sources:
    - id: "ds.primary"
      description: "Dashboard analytics API (visits, revenue, regional split, campaign metrics)"
    - id: "ds.fallback"
      description: "Local mock snapshot for offline/demo mode"
  states:
    loading: true
    empty: true
    error: true

design_tokens:
  layout:
    grid_columns: 12
    grid_gap_px: 24
    page_padding_px: 24
    radius_px: 16
    elevation: "soft"
  typography:
    h1: { size: "xl", weight: "700" }
    h2: { size: "lg", weight: "600" }
    body: { size: "md", weight: "400" }
    helper: { size: "sm", weight: "400", tone: "muted" }
  colors:
    background: "neutral-50"
    surface: "white"
    text: "neutral-900"
    muted_text: "neutral-500"
    primary: "teal-800"
    accent: "lime-400"
    success: "green-600"
    danger: "red-500"
    warning: "amber-500"
  components:
    card:
      radius_px: 16
      padding_px: 20
      header_divider: false
    button:
      radius_px: 12
      sizes: ["sm", "md", "lg"]
    input:
      radius_px: 12

app_shell:
  topbar:
    id: "topbar"
    position: "fixed"
    height_px: 64
    zones:
      left:
        - id: "topbar.sidebar_toggle"
          type: "icon_button"
          icon: "menu"
          intent: "toggle sidebar"
          actions:
            - { type: "toggle", target: "sidebar" }
        - id: "topbar.global_search"
          type: "search_input"
          placeholder: "Search..."
          icon_left: "search"
          behaviors:
            on_enter: { type: "dispatch", event: "SEARCH_SUBMIT" }
            on_clear: { type: "dispatch", event: "SEARCH_CLEAR" }
      right:
        - id: "topbar.theme_toggle"
          type: "icon_button"
          icon: "moon"
          intent: "toggle theme"
          actions:
            - { type: "toggle_theme", values: ["light", "dark"] }
        - id: "topbar.language"
          type: "menu_button"
          icon: "flag"
          intent: "change language"
          menu:
            id: "menu.language"
            items:
              - { label: "English", value: "en" }
              - { label: "Hindi", value: "hi" }
        - id: "topbar.cart"
          type: "icon_button"
          icon: "cart"
          badge: 0
        - id: "topbar.notifications"
          type: "icon_button"
          icon: "bell"
          badge: 6
          actions:
            - { type: "open_panel", panel_id: "panel.notifications" }
        - id: "topbar.settings"
          type: "icon_button"
          icon: "settings"
        - id: "topbar.user"
          type: "avatar_button"
          actions:
            - { type: "open_menu", menu_id: "menu.user" }

  sidebar:
    id: "sidebar"
    modes:
      - id: "expanded"
        width_px: 280
      - id: "collapsed"
        width_px: 84
        behaviors:
          tooltips: true
          expand_on_hover: true
    navigation:
      sections:
        - id: "nav.section.dashboards"
          label: "DASHBOARDS"
          items:
            - id: "nav.item.analytics"
              label: "Analytics"
              icon: "chart"
              route: "/dashboard/analytics"
              states:
                active_when_route_matches: true
            - id: "nav.item.ecommerce"
              label: "eCommerce"
              icon: "bag"
              route: "/dashboard/ecommerce"
            - id: "nav.item.modern"
              label: "Modern"
              icon: "target"
              route: "/dashboard/modern"
        - id: "nav.section.apps"
          label: "APPS"
          items:
            - id: "nav.item.chat"
              label: "Chat"
              icon: "message"
              route: "/apps/chat"
            - id: "nav.item.calendar"
              label: "Calendar"
              icon: "calendar"
              route: "/apps/calendar"
            - id: "nav.item.email"
              label: "Email"
              icon: "mail"
              route: "/apps/email"

page_layout:
  content_area:
    id: "content"
    container: "fluid"
    grid:
      columns: 12
      gap_px: 24
    composition_rules:
      - "Use cards for major blocks"
      - "Prefer 8/4 split rows for dashboard density"
      - "Ensure titles + primary metrics are above charts"

  rows:
    - id: "row.hero_plus_insights"
      components:
        - id: "card.hero.analytics_greeting"
          type: "hero_card"
          grid_span: { md: 12, lg: 8, xl: 8 }
          header:
            title: "Good Evening Cameron"
            subtitle: "Stay updated with your store's performance today. Get a quick snapshot of key statistics."
          body:
            illustration: "running_growth_character"
          footer:
            primary_cta: { label: "View Full Report", action: "ACT_NAVIGATE:/reports" }
        - id: "card.key_insights"
          type: "segment_bar_card"
          grid_span: { md: 12, lg: 4, xl: 4 }
          header:
            title: "Key Insights"
          body:
            metric_label: "All-time Revenue"
            metric_value: "$395.7k"
            segmented_bar:
              segments:
                - { label: "Asia", value_pct: 46 }
                - { label: "USA", value_pct: 26 }
                - { label: "Europe", value_pct: 28 }
            legend: true

    - id: "row.visits_and_donut"
      components:
        - id: "card.website_visits"
          type: "chart_card"
          grid_span: { md: 12, lg: 8, xl: 8 }
          header:
            title: "Website Visits"
            controls:
              - { type: "legend", id: "control.legend.site", items: ["Site A", "Site B"] }
              - { type: "dropdown", id: "control.time_range", default: "2026" }
          body:
            top_metric:
              value: "$395.7k"
              delta_badge: { value: "+18%", intent: "success" }
              helper_text: "than last year"
            chart:
              chart_type: "stacked_bar"
              x_axis: "Jan-Dec"
              y_axis: "0k-10k"
              series: "site_a,site_b"
        - id: "card.current_visits"
          type: "donut_breakdown_card"
          grid_span: { md: 12, lg: 4, xl: 4 }
          header: { title: "Current Visits" }
          body:
            donut:
              center_label: "Total"
              center_value: 2458
            breakdown_rows:
              - { label: "America", value: 1650, delta: "+4.7%", intent: "success" }
              - { label: "Asia", value: 350, delta: "+2.1%", intent: "success" }
              - { label: "Europe", value: 498, delta: "-1.7%", intent: "danger" }

behavior:
  navigation:
    active_state_rule: "route prefix match"
  actions:
    - id: "ACT_NAVIGATE"
      params: ["to"]
    - id: "ACT_OPEN_MENU"
      params: ["menu_id"]
    - id: "ACT_OPEN_PANEL"
      params: ["panel_id"]
    - id: "ACT_TOGGLE"
      params: ["target"]
    - id: "ACT_RELOAD_CHART"
      params: ["chart_id", "filters"]
  data_states:
    loading:
      ui: "skeleton cards + disabled controls"
    empty:
      ui: "empty-state illustration + CTA"
    error:
      ui: "error banner + retry"

responsiveness:
  breakpoints:
    mobile:
      rules:
        - "Sidebar becomes overlay"
        - "Grid becomes 1 column"
        - "Charts become horizontally scrollable"
    tablet:
      rules:
        - "Grid becomes 2 columns"
        - "Hero full width, KPI/insights below"
    desktop:
      rules:
        - "Use 8/4 split for main rows"
        - "Keep controls visible in headers"

a11y:
  keyboard:
    focus_order_rule: "topbar -> sidebar -> content (left-to-right, top-to-bottom)"
    visible_focus_ring: true
  aria:
    require_labels_for:
      - "icon_button"
      - "search_input"
      - "dropdown"
      - "chart"
  charts:
    requirements:
      - "Provide table fallback"
      - "Tooltips accessible via keyboard"
      - "Color not sole indicator (use labels)"
  contrast:
    minimum: "WCAG AA"

floating_controls:
  - id: "fab.primary"
    type: "floating_action_button"
    icon: "settings"
    position: "bottom_right"
    actions:
      - { type: "open_panel", panel_id: "panel.customizer" }
    panel:
      id: "panel.customizer"
      content_blocks:
        - { type: "theme_selector" }
        - { type: "layout_selector", options: ["expanded_sidebar", "collapsed_sidebar"] }
        - { type: "direction_toggle", options: ["LTR", "RTL"] }
```

## Self-review (requested checklist)

### Docker package installation
- Docker package installed in the environment via `apt-get install -y docker.io`.

### Correctness / Security / Performance / Maintainability review
This artifact is a UX spec document only (no executable backend/frontend logic was introduced), so null-safety, transaction handling, tenant authorization, query performance, and code-level maintainability checks are **not directly applicable**.

### Concrete follow-up diffs (implementation-ready stubs)
If this spec is implemented in code, apply these minimal diffs first:

```diff
diff --git a/backend/src/main/java/com/inalgo/trade/controller/CandleController.java b/backend/src/main/java/com/inalgo/trade/controller/CandleController.java
@@
- public CandleResponse getCandles(String symbol, String interval) {
+ public CandleResponse getCandles(@NotBlank String symbol, @NotBlank String interval) {
+   // Ensure tenant scoping is enforced for every read path.
+   final String tenantId = TenantContext.requireTenantId();
```

```diff
diff --git a/desktop/src/renderer/src/api/candles.ts b/desktop/src/renderer/src/api/candles.ts
@@
-export const fetchCandles = async (symbol: string) => {
+export const fetchCandles = async (symbol: string) => {
+  if (!symbol?.trim()) throw new Error('symbol is required');
```

```diff
diff --git a/backend/src/main/java/com/inalgo/trade/service/CandleService.java b/backend/src/main/java/com/inalgo/trade/service/CandleService.java
@@
- public void upsert(...) {
+ @Transactional
+ public void upsert(...) {
+   // Keep operation idempotent by matching unique key (tenant_id, instrument_key, timeframe, candle_ts)
```
