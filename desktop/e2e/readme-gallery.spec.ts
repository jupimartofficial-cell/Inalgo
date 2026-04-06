import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const assetsDir = path.resolve(__dirname, '../../docs/assets');
const nowIso = '2026-04-06T09:25:00.000Z';

async function ensureAssetsDir() {
  await fs.mkdir(assetsDir, { recursive: true });
}

async function installDemoSession(
  page: Page,
  state: {
    section: string;
    marketSignalsSubSection?: string;
  },
) {
  await page.addInitScript((sessionState) => {
    window.sessionStorage.setItem('inalgo_admin_session_v1', JSON.stringify({
      tenantId: 'demo-tenant',
      username: 'demo-contributor',
      token: 'demo-session-placeholder',
      section: sessionState.section,
      intraSubSection: 'intra-monitor',
      backtestSubSection: 'pnl',
      marketSignalsSubSection: sessionState.marketSignalsSubSection ?? 'trading-param',
      tradingDeskSubSection: 'advanced-trading',
      sidebarCollapsed: false,
      pinnedNavItemKeys: ['trading-scripts', 'intra-monitor', 'option-chain', 'market-watch'],
      expandedNavGroup: sessionState.section === 'market-signals' ? 'analytics' : 'trading',
    }));
  }, state);
}

async function mockSharedShell(page: Page) {
  await page.route('**/api/v1/admin/migrations/jobs*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/v1/admin/migrations/status*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/v1/admin/historical-data*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"content":[],"totalElements":0,"totalPages":0,"number":0,"size":50}' }));
  await page.route('**/api/v1/admin/trading/preferences*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"username":"demo-contributor","preferences":null}' }));
}

test('captures sanitized Option Chain gallery image for README', async ({ page }) => {
  await ensureAssetsDir();
  await page.setViewportSize({ width: 1440, height: 950 });
  await installDemoSession(page, { section: 'optionchain' });
  await mockSharedShell(page);

  await page.route('**/api/v1/admin/option-chain/expiries*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        underlyingKey: 'NSE_INDEX|Nifty 50',
        expiries: ['2026-04-30', '2026-05-28'],
      }),
    });
  });

  await page.route('**/api/v1/admin/option-chain/latest*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        underlyingKey: 'NSE_INDEX|Nifty 50',
        expiryDate: '2026-04-30',
        snapshotTs: nowIso,
        underlyingSpotPrice: 22460.5,
        pcr: 1.12,
        syntheticFuturePrice: 22464.2,
        rows: [
          { strikePrice: 22350, callLtp: 221.8, callOi: 1200000, callPrevOi: 1060000, callVolume: 250000, callIv: 18.8, callOiChangePercent: 13.2, putLtp: 104.1, putOi: 1700000, putPrevOi: 1510000, putVolume: 290000, putIv: 20.1, putOiChangePercent: 12.6 },
          { strikePrice: 22400, callLtp: 188.2, callOi: 1600000, callPrevOi: 1400000, callVolume: 410000, callIv: 19.1, callOiChangePercent: 14.3, putLtp: 132.4, putOi: 2100000, putPrevOi: 1800000, putVolume: 370000, putIv: 20.4, putOiChangePercent: 16.7 },
          { strikePrice: 22450, callLtp: 155.5, callOi: 1450000, callPrevOi: 1210000, callVolume: 350000, callIv: 19.8, callOiChangePercent: 19.8, putLtp: 141.6, putOi: 1940000, putPrevOi: 1750000, putVolume: 330000, putIv: 20.9, putOiChangePercent: 10.8 },
          { strikePrice: 22500, callLtp: 128.4, callOi: 1840000, callPrevOi: 1660000, callVolume: 390000, callIv: 20.2, callOiChangePercent: 10.8, putLtp: 166.9, putOi: 1850000, putPrevOi: 1620000, putVolume: 315000, putIv: 21.3, putOiChangePercent: 14.2 },
        ],
      }),
    });
  });

  await page.goto('/option-chain');
  await expect(page.getByRole('heading', { name: 'Option Chain' })).toBeVisible();
  await expect(page.getByText('Spot 22,460.50')).toBeVisible();
  await page.screenshot({ path: path.join(assetsDir, 'inalgo-option-chain-gallery.png'), fullPage: false });
});

test('captures sanitized Market Watch gallery image for README', async ({ page }) => {
  await ensureAssetsDir();
  await page.setViewportSize({ width: 1440, height: 950 });
  await installDemoSession(page, { section: 'market-signals', marketSignalsSubSection: 'market-watch' });
  await mockSharedShell(page);

  const config = {
    refreshIntervalSeconds: 60,
    gridColumns: 3,
    tiles: [
      { id: 'signal-tile', title: 'Nifty Signal Pulse', source: 'TRADING_SIGNAL', instrumentKey: 'NSE_INDEX|Nifty 50', timeframeUnit: 'minutes', timeframeInterval: 15, primaryField: 'signal' },
      { id: 'param-tile', title: 'BankNifty Opening Range', source: 'TRADING_PARAM', instrumentKey: 'NSE_INDEX|Nifty Bank', primaryField: 'gapType' },
      { id: 'sentiment-tile', title: 'India Market Bias', source: 'MARKET_SENTIMENT', instrumentKey: 'NSE_INDEX|Nifty 50', primaryField: 'marketBias' },
    ],
  };

  await page.route('**/api/v1/admin/market-watch/config*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'demo-contributor', config, updatedAt: nowIso }),
    });
  });

  await page.route('**/api/v1/admin/market-watch/data*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        fetchedAt: nowIso,
        tiles: [
          {
            tileId: 'signal-tile',
            source: 'TRADING_SIGNAL',
            primaryField: 'signal',
            primaryLabel: 'Signal',
            primaryValue: 'BUY',
            statusLabel: 'BUY',
            statusTone: 'positive',
            updatedAt: '6 Apr 2026, 09:25',
            fields: [
              { key: 'signal', label: 'Signal', value: 'BUY', tone: 'positive' },
              { key: 'currentClose', label: 'Close', value: '22,460.50', tone: 'positive' },
              { key: 'previousClose', label: 'Prev', value: '22,310.20', tone: 'neutral' },
              { key: 'dma9', label: 'DMA 9', value: '22,402.10', tone: 'positive' },
              { key: 'dma26', label: 'DMA 26', value: '22,211.35', tone: 'positive' },
              { key: 'dma110', label: 'DMA 110', value: '21,980.00', tone: 'positive' },
              { key: 'signalDate', label: 'Signal Date', value: '6 Apr 2026', tone: 'neutral' },
            ],
          },
          {
            tileId: 'param-tile',
            source: 'TRADING_PARAM',
            primaryField: 'gapType',
            primaryLabel: 'Gap Type',
            primaryValue: 'Gap Up',
            statusLabel: 'Range Breakout',
            statusTone: 'positive',
            updatedAt: '6 Apr 2026, 09:25',
            fields: [
              { key: 'gapType', label: 'Gap Type', value: 'Gap Up', tone: 'positive' },
              { key: 'gapPct', label: 'Gap %', value: '+0.42%', tone: 'positive' },
              { key: 'orbBreakout', label: 'ORB Breakout', value: 'Yes', tone: 'positive' },
              { key: 'orbBreakdown', label: 'ORB Breakdown', value: 'No', tone: 'neutral' },
              { key: 'orbHigh', label: 'ORB High', value: '48,110.25', tone: 'positive' },
              { key: 'orbLow', label: 'ORB Low', value: '47,840.10', tone: 'neutral' },
              { key: 'todayOpen', label: 'Open', value: '47,910.00', tone: 'positive' },
              { key: 'todayClose', label: 'Close', value: '48,126.35', tone: 'positive' },
              { key: 'prevHigh', label: 'Prev High', value: '48,040.80', tone: 'neutral' },
              { key: 'prevLow', label: 'Prev Low', value: '47,610.50', tone: 'neutral' },
              { key: 'prevClose', label: 'Prev Close', value: '47,724.60', tone: 'neutral' },
              { key: 'tradeDate', label: 'Trade Date', value: '6 Apr 2026', tone: 'neutral' },
            ],
          },
          {
            tileId: 'sentiment-tile',
            source: 'MARKET_SENTIMENT',
            primaryField: 'marketBias',
            primaryLabel: 'Market Bias',
            primaryValue: 'Bullish',
            statusLabel: 'Aligned',
            statusTone: 'positive',
            updatedAt: '6 Apr 2026, 09:25',
            fields: [
              { key: 'trendStatus', label: 'Trend', value: 'Bullish', tone: 'positive' },
              { key: 'currentValue', label: 'Value', value: '22,460.50', tone: 'positive' },
              { key: 'ema9', label: 'EMA 9', value: '22,402.10', tone: 'positive' },
              { key: 'ema21', label: 'EMA 21', value: '22,266.90', tone: 'positive' },
              { key: 'ema110', label: 'EMA 110', value: '21,980.00', tone: 'positive' },
              { key: 'aiAnalysis', label: 'AI', value: 'Aligned', tone: 'positive' },
              { key: 'aiConfidence', label: 'Confidence', value: '82%', tone: 'positive' },
              { key: 'sourceCount', label: 'Sources', value: '5', tone: 'neutral' },
              { key: 'evidenceCount', label: 'Evidence', value: '9', tone: 'neutral' },
              { key: 'reason', label: 'Reason', value: 'Global cues and EMA stack support bullish intraday bias.', tone: 'positive' },
            ],
          },
        ],
      }),
    });
  });

  await page.goto('/market-signals/market-watch');
  await expect(page.getByRole('heading', { name: 'Market Watch' })).toBeVisible();
  await expect(page.getByText('Nifty Signal Pulse')).toBeVisible();
  await page.screenshot({ path: path.join(assetsDir, 'inalgo-market-watch-gallery.png'), fullPage: false });
});
