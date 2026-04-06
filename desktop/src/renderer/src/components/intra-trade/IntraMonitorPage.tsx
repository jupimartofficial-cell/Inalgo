import { Box, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  convertPositionToManualWatch,
  emergencyIntraAction,
  exitIntraPosition,
  exitIntraRuntime,
  fetchIntraStrategyVersions,
  partialExitIntraPosition,
  partialExitIntraRuntime,
  pauseIntraRuntime,
  resumeIntraRuntime,
} from '../../api/admin';
import { MarketWatchPanel } from '../market-watch/MarketWatchPanel';
import { IntraMonitorMarketSummaryCard } from './IntraMonitorDataPanels';
import {
  IntraMonitorCommandBar,
  IntraMonitorEmergencyFooter,
  IntraMonitorLiveLayout,
  IntraMonitorModeSwitcher,
  IntraMonitorQuickTestLayout,
  IntraPromotionDialog,
  type IntraStatusTone,
} from './IntraMonitorTraderView';
import { LiveGuardDialog } from './IntraTradeShared';
import { useIntraMonitorController } from './useIntraMonitorController';

export const IntraMonitorPage = ({
  token,
  tenantId,
  username,
  onNotify,
}: {
  token: string;
  tenantId: string;
  username: string;
  onNotify: (payload: { msg: string; severity: 'success' | 'error' | 'info' }) => void;
}) => {
  const navigate = useNavigate();
  const controller = useIntraMonitorController({
    token,
    tenantId,
    username,
    onNotify,
  });

  const commandBarAction =
    controller.surfaceMode === 'LIVE_MONITOR'
    && controller.selectedRuntime
    && ['WAITING', 'ENTERED', 'PARTIAL_EXIT', 'ERROR'].includes(controller.selectedRuntime.status)
      ? {
          ...controller.commandBarAction,
          onClick: () => controller.openGuardDialog('Exit strategy', 'LIVE', (payload) =>
            exitIntraRuntime(tenantId, token, controller.selectedRuntime!.runtimeId, username, payload),
          ),
        }
      : controller.commandBarAction;

  // Fix #1 — derive traffic-light tone from the live runtime status
  const statusTone: IntraStatusTone =
    controller.surfaceMode === 'LIVE_MONITOR' && controller.selectedRuntime
      ? controller.selectedRuntime.status === 'ENTERED' ? 'success'
        : controller.selectedRuntime.status === 'WAITING' ? 'info'
        : (controller.selectedRuntime.status === 'PAUSED' || controller.selectedRuntime.status === 'PARTIAL_EXIT') ? 'warning'
        : controller.selectedRuntime.status === 'ERROR' ? 'error'
        : 'default'
      : 'default';

  // Fix #2 — derive active Quick Test step for the stepper
  const activeQuickTestStep =
    controller.selectedStrategy == null ? 0
      : controller.filteredValidationRuns.length === 0 ? 1
        : 2;

  // Fix #4 — emergency buttons rendered in the sticky footer (always visible)
  const emergencyButtons = (
    <>
      <Button
        size="small"
        color="error"
        variant="contained"
        onClick={() => controller.openGuardDialog('Square off all', 'LIVE', (payload) =>
          emergencyIntraAction(tenantId, token, username, { action: 'SQUARE_OFF_ALL', ...payload }),
        )}
      >
        Square Off All
      </Button>
      <Button
        size="small"
        color="warning"
        variant="outlined"
        onClick={() => {
          const reason = window.prompt('Reason for exiting all paper runs');
          if (!reason) return;
          void emergencyIntraAction(tenantId, token, username, { action: 'EXIT_ALL_PAPER', reason })
            .then(() => controller.reloadMonitor())
            .catch((error) => onNotify({ msg: (error as Error).message || 'Emergency action failed', severity: 'error' }));
        }}
      >
        Exit All Paper
      </Button>
      <Button
        size="small"
        color="warning"
        variant="outlined"
        onClick={() => controller.openGuardDialog('Exit all live', 'LIVE', (payload) =>
          emergencyIntraAction(tenantId, token, username, { action: 'EXIT_ALL_LIVE', ...payload }),
        )}
      >
        Exit All Live
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          const reason = window.prompt('Reason for pausing all strategies') || 'Pause all strategies';
          void emergencyIntraAction(tenantId, token, username, { action: 'PAUSE_ALL', reason })
            .then(() => controller.reloadMonitor())
            .catch((error) => onNotify({ msg: (error as Error).message || 'Emergency action failed', severity: 'error' }));
        }}
      >
        Pause All
      </Button>
    </>
  );

  const marketWatchContent = (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', p: 2 }}>
      <MarketWatchPanel token={token} tenantId={tenantId} username={username} onNotify={onNotify} />
    </Box>
  );

  return (
    <Stack spacing={2} sx={{ pb: controller.surfaceMode === 'LIVE_MONITOR' ? 7 : 0 }}>
      <IntraMonitorCommandBar
        strategyName={controller.commandBarStrategyName}
        modeLabel={controller.commandBarModeLabel}
        currentState={controller.commandBarStateLabel}
        lastScanLabel={controller.commandBarLastScan}
        marketStatusLabel={controller.marketStatusLabel}
        freshnessLabel={controller.freshnessLabel}
        openPositionsCount={controller.commandBarOpenPositions}
        currentMtm={controller.commandBarMtm}
        primaryAction={commandBarAction}
        statusTone={statusTone}
      />

      <IntraMonitorModeSwitcher value={controller.surfaceMode} onChange={controller.setSurfaceMode} />
      <IntraMonitorMarketSummaryCard marketSummary={controller.marketSummary} />

      {controller.surfaceMode === 'QUICK_TEST' ? (
        <IntraMonitorQuickTestLayout
          strategySearch={controller.strategySearch}
          onStrategySearchChange={(value) => { controller.setStrategyPage(0); controller.setStrategySearch(value); }}
          strategyStatusFilter={controller.strategyStatusFilter}
          onStrategyStatusFilterChange={(value) => { controller.setStrategyPage(0); controller.setStrategyStatusFilter(value); }}
          strategies={controller.pagedStrategies}
          selectedStrategyId={controller.strategyId}
          onSelectStrategy={(selectedStrategyId) => {
            const selected = controller.filteredStrategies.find((row) => row.id === selectedStrategyId)
              ?? controller.pagedStrategies.find((row) => row.id === selectedStrategyId);
            if (!selected) return;
            void (async () => {
              try {
                const versions = await fetchIntraStrategyVersions(tenantId, token, selected.id, username);
                const latest = versions[0];
                if (latest) controller.loadStrategyIntoWorkspace(selected.id, latest.strategy);
              } catch (error) {
                onNotify({ msg: (error as Error).message || 'Unable to load selected strategy version', severity: 'error' });
              }
            })();
          }}
          strategyPage={controller.strategyPage}
          strategyRowsPerPage={controller.strategyRowsPerPage}
          strategyTotal={controller.filteredStrategies.length}
          onStrategyPageChange={controller.setStrategyPage}
          onStrategyRowsPerPageChange={(rows) => { controller.setStrategyPage(0); controller.setStrategyRowsPerPage(rows); }}
          selectedStrategy={controller.selectedStrategy}
          selectedMode={controller.tradeMode}
          onModeChange={controller.setTradeMode}
          scanInstrumentKey={controller.scanInstrumentKey}
          onScanInstrumentChange={controller.setScanInstrumentKey}
          scanTimeframeKey={controller.scanTimeframeKey}
          onScanTimeframeChange={controller.setScanTimeframeKey}
          instrumentOptions={controller.baseInstruments.map((item) => ({ key: item.key, label: item.label }))}
          timeframeOptions={controller.timeframeOptions.map((item) => ({ key: item.unit + '|' + item.interval, label: item.label }))}
          historicalStartDate={controller.strategy.startDate}
          historicalEndDate={controller.strategy.endDate}
          onHistoricalStartDateChange={(value) => controller.setStrategy((current) => ({ ...current, startDate: value }))}
          onHistoricalEndDateChange={(value) => controller.setStrategy((current) => ({ ...current, endDate: value }))}
          pagedValidationRuns={controller.pagedValidationRuns}
          paperRunPage={controller.paperRunPage}
          paperRunRowsPerPage={controller.paperRunRowsPerPage}
          paperRunTotal={controller.filteredValidationRuns.length}
          onPaperRunPageChange={controller.setPaperRunPage}
          onPaperRunRowsPerPageChange={(rows) => { controller.setPaperRunPage(0); controller.setPaperRunRowsPerPage(rows); }}
          paperRunModeFilter={controller.paperRunModeFilter}
          onPaperRunModeFilterChange={(value) => { controller.setPaperRunPage(0); controller.setPaperRunModeFilter(value); }}
          selectedExecutionSummary={controller.selectedExecution}
          onOpenPnl={() => navigate('/intra/pnl')}
          onRunSelectedMode={() => { void controller.runStrategy(controller.tradeMode === 'BACKTEST' ? 'BACKTEST' : 'PAPER'); }}
          onPromoteToLive={() => controller.setPromotionOpen(true)}
          promotionChecklist={controller.promotionChecklist}
          loadingStrategies={controller.loadingStrategies}
          activeQuickTestStep={activeQuickTestStep}
          onStopRun={(runId, status) => { void controller.stopValidationRun(runId, status); }}
          onDeleteRun={(runId) => { void controller.deleteValidationRun(runId); }}
        />
      ) : (
        <IntraMonitorLiveLayout
          runtimeStatusFilter={controller.runtimeStatusFilter}
          onRuntimeStatusFilterChange={controller.setRuntimeStatusFilter}
          runtimes={controller.filteredLiveRuntimes}
          selectedRuntimeId={controller.selectedRuntimeId}
          onSelectRuntime={controller.setSelectedRuntimeId}
          runtimePage={controller.liveRuntimePage}
          runtimeRowsPerPage={controller.liveRuntimeRowsPerPage}
          runtimeTotal={controller.runtimeTotal}
          onRuntimePageChange={controller.setLiveRuntimePage}
          onRuntimeRowsPerPageChange={(rows) => { controller.setLiveRuntimePage(0); controller.setLiveRuntimeRowsPerPage(rows); }}
          selectedRuntime={controller.selectedRuntime}
          selectedRuntimePositions={controller.selectedRuntimePositions}
          positionPage={controller.positionPage}
          positionRowsPerPage={controller.positionRowsPerPage}
          positionTotal={controller.selectedRuntimePositionsAll.length}
          onPositionPageChange={controller.setPositionPage}
          onPositionRowsPerPageChange={(rows) => { controller.setPositionPage(0); controller.setPositionRowsPerPage(rows); }}
          selectedRuntimeEvents={controller.selectedRuntimeEvents}
          eventFilter={controller.eventFilter}
          onEventFilterChange={controller.setEventFilter}
          eventPage={controller.eventPage}
          eventRowsPerPage={controller.eventRowsPerPage}
          eventTotal={controller.selectedRuntimeEventsAll.length}
          onEventPageChange={controller.setEventPage}
          onEventRowsPerPageChange={(rows) => { controller.setEventPage(0); controller.setEventRowsPerPage(rows); }}
          autoRefreshInterval={controller.autoRefreshInterval}
          onAutoRefreshIntervalChange={controller.setAutoRefreshInterval}
          autoRefreshCountdown={controller.autoRefreshCountdown}
          onResume={() => {
            if (!controller.selectedRuntime) return;
            void resumeIntraRuntime(tenantId, token, controller.selectedRuntime.runtimeId, username, 'resume from live monitor')
              .then(() => controller.reloadMonitor())
              .catch((error) => onNotify({ msg: (error as Error).message || 'Unable to resume strategy', severity: 'error' }));
          }}
          onPause={() => {
            if (!controller.selectedRuntime) return;
            controller.openGuardDialog('Pause strategy', 'LIVE', (payload) =>
              pauseIntraRuntime(tenantId, token, controller.selectedRuntime!.runtimeId, username, payload),
            );
          }}
          onExit={() => {
            if (!controller.selectedRuntime) return;
            controller.openGuardDialog('Exit strategy', 'LIVE', (payload) =>
              exitIntraRuntime(tenantId, token, controller.selectedRuntime!.runtimeId, username, payload),
            );
          }}
          onPartial={() => {
            if (!controller.selectedRuntime) return;
            controller.openGuardDialog('Partial exit strategy', 'LIVE', (payload) =>
              partialExitIntraRuntime(tenantId, token, controller.selectedRuntime!.runtimeId, username, payload),
            );
          }}
          onOpenPnl={() => navigate('/intra/pnl')}
          onPositionExit={(positionId) => controller.openGuardDialog('Exit position', 'LIVE', (payload) =>
            exitIntraPosition(tenantId, token, positionId, username, payload),
          )}
          onPositionPartial={(positionId) => controller.openGuardDialog('Partial exit position', 'LIVE', (payload) =>
            partialExitIntraPosition(tenantId, token, positionId, username, payload),
          )}
          onPositionWatch={(positionId) => controller.openGuardDialog('Move to manual watch', 'LIVE', async (payload) => {
            await convertPositionToManualWatch(tenantId, token, positionId, username, payload.reason);
          })}
        />
      )}

      {marketWatchContent}

      <IntraPromotionDialog
        open={controller.promotionOpen}
        strategyName={controller.selectedStrategy?.strategyName ?? ''}
        checklist={controller.promotionChecklist}
        onCancel={() => controller.setPromotionOpen(false)}
        onConfirm={() => {
          controller.setPromotionOpen(false);
          void controller.runStrategy('LIVE');
        }}
      />

      <LiveGuardDialog
        open={controller.guardOpen}
        isLive={controller.guardIsLive}
        actionLabel={controller.guardLabel}
        onConfirm={(result) => {
          controller.setGuardOpen(false);
          const action = controller.pendingActionRef.current;
          controller.pendingActionRef.current = null;
          if (action) void action(result);
        }}
        onCancel={() => {
          controller.setGuardOpen(false);
          controller.pendingActionRef.current = null;
        }}
      />

      {/* Fix #4 — Emergency footer always visible in Live Monitor */}
      {controller.surfaceMode === 'LIVE_MONITOR' && (
        <IntraMonitorEmergencyFooter>
          {emergencyButtons}
        </IntraMonitorEmergencyFooter>
      )}
    </Stack>
  );
};
