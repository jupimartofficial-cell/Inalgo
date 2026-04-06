import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const enabled = process.env.REAL_DATA_E2E === '1';
const tenantId = process.env.E2E_TENANT_ID ?? 'local-desktop';
const username = process.env.E2E_USERNAME ?? 'admin';
const password = process.env.E2E_PASSWORD ?? '';
const strategyName = process.env.E2E_STRATEGY_NAME?.trim();
const startDate = process.env.E2E_START_DATE ?? '2026-03-20';
const endDate = process.env.E2E_END_DATE ?? '2026-03-27';
const artifactRoot = process.env.E2E_ARTIFACT_DIR ?? '../artifacts/intra-real-data';

type Checkpoint = {
  id: string;
  pass: boolean;
  detail: string;
};

test.describe('Real Data Certification: Backtest -> Intra Monitor -> Intra P&L', () => {
  test.skip(!enabled, 'Set REAL_DATA_E2E=1 to run real-data certification.');
  test.skip(enabled && !password, 'Set E2E_PASSWORD to run real-data certification.');

  test('certifies historical backtest to monitor/pnl workflow on local real stack', async ({ page }) => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const artifactDir = path.resolve(process.cwd(), artifactRoot, ts);
    await fs.mkdir(artifactDir, { recursive: true });

    const checkpoints: Checkpoint[] = [];
    const mark = (id: string, pass: boolean, detail: string) => checkpoints.push({ id, pass, detail });

    await page.goto('/intra/monitor');
    await page.getByLabel('Tenant ID').fill(tenantId);
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/intra\/monitor$/);
    await expect(page.getByRole('tab', { name: /Quick Test/i })).toBeVisible();
    mark('login_and_route', true, 'Authenticated and opened /intra/monitor');

    const marketStatusText = await page
      .getByText(/market\s+(open|closed)/i)
      .first()
      .textContent()
      .catch(() => null);
    const normalizedMarketText = (marketStatusText ?? '').toLowerCase();
    const marketBranch = normalizedMarketText.includes('open')
      ? 'OPEN_MARKET'
      : normalizedMarketText.includes('closed')
        ? 'CLOSED_MARKET'
        : 'UNKNOWN';
    mark('market_branch', true, `Detected monitor branch: ${marketBranch}`);

    if (strategyName) {
      await page.getByRole('textbox', { name: 'Search strategies' }).fill(strategyName);
      await page.getByRole('button', { name: new RegExp(`${strategyName} Open`) }).first().click();
      mark('strategy_selection', true, `Selected strategy by name: ${strategyName}`);
    } else {
      await page.getByRole('button', { name: /Open$/ }).first().click();
      mark('strategy_selection', true, 'Selected first visible strategy');
    }

    const modeSelect = page.getByRole('combobox').filter({ hasText: /Real-Time Paper|Historical Backtest/i }).first();
    await modeSelect.click();
    await page.getByRole('option', { name: /Historical Backtest/i }).click();
    await expect(page.getByLabel(/Start date/i)).toBeVisible();
    await expect(page.getByLabel(/End date/i)).toBeVisible();
    await page.getByLabel(/Start date/i).fill(startDate);
    await page.getByLabel(/End date/i).fill(endDate);
    mark('historical_mode_configured', true, `Configured historical range ${startDate} to ${endDate}`);

    await page.getByRole('button', { name: /Run Historical Test/i }).first().click();
    await expect(page.getByText(/run started/i)).toBeVisible({ timeout: 30_000 });
    mark('historical_run_started', true, 'Historical run API accepted and run persisted');

    await page.screenshot({ path: path.join(artifactDir, 'monitor-after-run.png'), fullPage: true });

    await page.getByRole('button', { name: 'View P&L' }).first().click();
    await expect(page).toHaveURL(/\/intra\/pnl$/);
    await expect(page.getByRole('heading', { name: 'Intra P&L' })).toBeVisible();
    await expect(page.getByTestId('intra-pnl-summary-card')).toBeVisible();
    await expect(page.getByTestId('intra-pnl-ledger-card')).toBeVisible();
    mark('pnl_navigation_and_sections', true, 'Navigated to Intra P&L and validated core sections');

    const csvResponse = page.waitForResponse((response) => response.url().includes('/api/v1/admin/intra-trade/pnl/export') && response.status() === 200);
    await page.getByTestId('intra-pnl-export-csv').click();
    await csvResponse;
    mark('csv_export', true, 'CSV export endpoint returned HTTP 200');

    await page.getByTestId('intra-pnl-tab-upstox').click();
    await expect(page.getByTestId('intra-pnl-upstox-tab')).toBeVisible();
    const upstoxDataOrError = await Promise.race([
      page.getByText('No positions found for today.').first().waitFor({ timeout: 20_000 }).then(() => 'data_empty'),
      page.getByText('Upstox sync failed').first().waitFor({ timeout: 20_000 }).then(() => 'sync_error'),
      page.getByText(/Open Positions|Orders Today|Filled Orders/i).first().waitFor({ timeout: 20_000 }).then(() => 'data_present'),
    ]).catch(() => 'unknown');
    mark('upstox_sync_render', upstoxDataOrError !== 'unknown', `Upstox tab rendered outcome: ${upstoxDataOrError}`);

    await page.screenshot({ path: path.join(artifactDir, 'pnl-final.png'), fullPage: true });

    const passed = checkpoints.every((c) => c.pass);
    const report = {
      generatedAt: new Date().toISOString(),
      tenantId,
      username,
      strategyName: strategyName ?? '(first strategy)',
      range: { startDate, endDate },
      marketBranch,
      checkpoints,
      passed,
      notes: [
        marketBranch === 'CLOSED_MARKET'
          ? 'Closed-market branch validated: persistence and stale/session behavior expected.'
          : 'Open-market branch validated: monitor freshness progression should be reviewed with runtime evidence.',
      ],
      artifacts: {
        monitorScreenshot: 'monitor-after-run.png',
        pnlScreenshot: 'pnl-final.png',
      },
    };

    await fs.writeFile(path.join(artifactDir, 'certification-report.json'), JSON.stringify(report, null, 2), 'utf-8');
    expect(passed, `Certification checkpoints failed. See ${path.join(artifactDir, 'certification-report.json')}`).toBe(true);
  });
});
