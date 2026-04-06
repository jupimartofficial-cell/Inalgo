import type { IntraPnlDashboard } from '../../../api/admin';
import type { DatePreset } from './pnlUtils';

export type DashboardFilters = {
  mode?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  strategy?: string;
  instrument?: string;
  account?: string;
};

export type PnlFilterState = {
  mode: 'ALL' | 'PAPER' | 'LIVE';
  status: 'ALL' | 'OPEN' | 'CLOSED';
  preset: DatePreset;
  customFromDate: string;
  customToDate: string;
  strategyFilter: string;
  instrumentFilter: string;
  accountFilter: string;
};

export type PnlSectionState = {
  secFilters: boolean;
  secSummary: boolean;
  secCharts: boolean;
  secStrat: boolean;
  secLedger: boolean;
};

export type PnlDashboardProps = {
  dashboard: IntraPnlDashboard | null;
  loading: boolean;
};
