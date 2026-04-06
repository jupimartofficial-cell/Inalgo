import {
  Avatar,
  Box,
  Chip,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AlarmRoundedIcon from '@mui/icons-material/AlarmRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import SsidChartRoundedIcon from '@mui/icons-material/SsidChartRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type {
  BacktestSubSection,
  IntraSubSection,
  MarketSignalsSubSection,
  NavSection,
  TradingDeskSubSection,
} from './AppShellShared';

export type NavGroupKey = 'quick-access' | 'trading' | 'analytics' | 'admin';

export type NavItemKey =
  | 'intra-monitor'
  | 'intra-strategies'
  | 'intra-pnl'
  | 'trading-desk'
  | 'trading-scripts'
  | 'trading-window'
  | 'option-chain'
  | 'backtest-pnl'
  | 'strategy-list'
  | 'market-watch'
  | 'trading-param'
  | 'trading-signal'
  | 'market-trend'
  | 'history'
  | 'dashboard'
  | 'migration'
  | 'manage-triggers';

interface NavItemDefinition {
  key: NavItemKey;
  group: Exclude<NavGroupKey, 'quick-access'>;
  label: string;
  icon: ReactNode;
  section: NavSection;
  aliases: string[];
  intraSubSection?: IntraSubSection;
  backtestSubSection?: BacktestSubSection;
  marketSignalsSubSection?: MarketSignalsSubSection;
  tradingDeskSubSection?: TradingDeskSubSection;
}

export interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  section: NavSection;
  onSection: (s: NavSection) => void;
  intraSubSection: IntraSubSection;
  onIntraSubSection: (s: IntraSubSection) => void;
  backtestSubSection: BacktestSubSection;
  onBacktestSubSection: (s: BacktestSubSection) => void;
  marketSignalsSubSection: MarketSignalsSubSection;
  onMarketSignalsSubSection: (s: MarketSignalsSubSection) => void;
  tradingDeskSubSection: TradingDeskSubSection;
  onTradingDeskSubSection: (s: TradingDeskSubSection) => void;
  pinnedNavItemKeys: NavItemKey[];
  onPinnedNavItemKeysChange: (keys: NavItemKey[]) => void;
  expandedNavGroup: NavGroupKey;
  onExpandedNavGroupChange: (group: NavGroupKey) => void;
  tenantId: string;
  onLogout: () => void;
  isMobile: boolean;
}

const NAV_ITEMS: NavItemDefinition[] = [
  {
    key: 'intra-monitor',
    group: 'trading',
    label: 'Intra Monitor',
    icon: <TimelineRoundedIcon />,
    section: 'intra',
    intraSubSection: 'intra-monitor',
    aliases: ['live', 'paper', 'monitor', 'run'],
  },
  {
    key: 'trading-desk',
    group: 'trading',
    label: 'Trading Desk',
    icon: <SsidChartRoundedIcon />,
    section: 'trading-desk',
    tradingDeskSubSection: 'advanced-trading',
    aliases: ['desk', 'advanced', 'orders'],
  },
  {
    key: 'trading-scripts',
    group: 'trading',
    label: 'Trading Scripts',
    icon: <CodeRoundedIcon />,
    section: 'trading-scripts',
    aliases: ['script', 'code', 'ide', 'backtest'],
  },
  {
    key: 'option-chain',
    group: 'trading',
    label: 'Option Chain',
    icon: <QueryStatsRoundedIcon />,
    section: 'optionchain',
    aliases: ['options', 'chain', 'ce', 'pe'],
  },
  {
    key: 'trading-window',
    group: 'trading',
    label: 'Trading window',
    icon: <CandlestickChartRoundedIcon />,
    section: 'trading',
    aliases: ['charts', 'window', 'workspace'],
  },
  {
    key: 'intra-strategies',
    group: 'trading',
    label: 'Intra Strategies',
    icon: <BoltRoundedIcon />,
    section: 'intra',
    intraSubSection: 'intra-strategies',
    aliases: ['strategy', 'builder', 'intra'],
  },
  {
    key: 'intra-pnl',
    group: 'trading',
    label: 'Intra P&L',
    icon: <TrendingUpRoundedIcon />,
    section: 'intra',
    intraSubSection: 'intra-pnl',
    aliases: ['pnl', 'review', 'intra'],
  },
  {
    key: 'market-watch',
    group: 'analytics',
    label: 'Market Watch',
    icon: <GridViewRoundedIcon />,
    section: 'market-signals',
    marketSignalsSubSection: 'market-watch',
    aliases: ['watch', 'tiles', 'signals'],
  },
  {
    key: 'trading-param',
    group: 'analytics',
    label: 'Trading Param',
    icon: <TimelineRoundedIcon />,
    section: 'market-signals',
    marketSignalsSubSection: 'trading-param',
    aliases: ['param', 'analytics'],
  },
  {
    key: 'trading-signal',
    group: 'analytics',
    label: 'Trading Signal',
    icon: <InsightsRoundedIcon />,
    section: 'market-signals',
    marketSignalsSubSection: 'trading-signal',
    aliases: ['signal', 'analytics'],
  },
  {
    key: 'market-trend',
    group: 'analytics',
    label: 'Market Trend',
    icon: <AssessmentRoundedIcon />,
    section: 'market-signals',
    marketSignalsSubSection: 'market-trend',
    aliases: ['trend', 'macro', 'sentiment'],
  },
  {
    key: 'backtest-pnl',
    group: 'analytics',
    label: 'Backtest P&L',
    icon: <TrendingUpRoundedIcon />,
    section: 'backtest',
    backtestSubSection: 'pnl',
    aliases: ['backtest', 'pnl'],
  },
  {
    key: 'strategy-list',
    group: 'analytics',
    label: 'Strategy List',
    icon: <DashboardRoundedIcon />,
    section: 'backtest',
    backtestSubSection: 'strategy-list',
    aliases: ['strategies', 'backtest'],
  },
  {
    key: 'history',
    group: 'analytics',
    label: 'Historical Data',
    icon: <BarChartRoundedIcon />,
    section: 'history',
    aliases: ['history', 'candles', 'data'],
  },
  {
    key: 'dashboard',
    group: 'analytics',
    label: 'Dashboard',
    icon: <DashboardRoundedIcon />,
    section: 'dashboard',
    aliases: ['home', 'overview'],
  },
  {
    key: 'migration',
    group: 'admin',
    label: 'Migration Jobs',
    icon: <RocketLaunchRoundedIcon />,
    section: 'migration',
    aliases: ['migration', 'jobs', 'sync'],
  },
  {
    key: 'manage-triggers',
    group: 'admin',
    label: 'Manage Triggers',
    icon: <AlarmRoundedIcon />,
    section: 'triggers',
    aliases: ['triggers', 'scheduler'],
  },
];

const GROUP_ORDER: Exclude<NavGroupKey, 'quick-access'>[] = ['trading', 'analytics', 'admin'];
const GROUP_LABEL: Record<NavGroupKey, string> = {
  'quick-access': 'Quick Access',
  trading: 'Trading',
  analytics: 'Analytics',
  admin: 'Admin',
};

const DEFAULT_PINNED: NavItemKey[] = ['intra-monitor', 'trading-desk', 'option-chain'];

const ITEM_BY_KEY = new Map(NAV_ITEMS.map((item) => [item.key, item]));

const isItemActive = (
  item: NavItemDefinition,
  section: NavSection,
  intraSubSection: IntraSubSection,
  backtestSubSection: BacktestSubSection,
  marketSignalsSubSection: MarketSignalsSubSection,
  tradingDeskSubSection: TradingDeskSubSection,
) => {
  if (item.section !== section) return false;
  if (item.section === 'intra') return item.intraSubSection === intraSubSection;
  if (item.section === 'backtest') return item.backtestSubSection === backtestSubSection;
  if (item.section === 'market-signals') return item.marketSignalsSubSection === marketSignalsSubSection;
  if (item.section === 'trading-desk') return item.tradingDeskSubSection === tradingDeskSubSection;
  return true;
};

const navigateToItem = (
  item: NavItemDefinition,
  onSection: (s: NavSection) => void,
  onIntraSubSection: (s: IntraSubSection) => void,
  onBacktestSubSection: (s: BacktestSubSection) => void,
  onMarketSignalsSubSection: (s: MarketSignalsSubSection) => void,
  onTradingDeskSubSection: (s: TradingDeskSubSection) => void,
) => {
  onSection(item.section);
  if (item.intraSubSection) onIntraSubSection(item.intraSubSection);
  if (item.backtestSubSection) onBacktestSubSection(item.backtestSubSection);
  if (item.marketSignalsSubSection) onMarketSignalsSubSection(item.marketSignalsSubSection);
  if (item.tradingDeskSubSection) onTradingDeskSubSection(item.tradingDeskSubSection);
};

const renderNavRow = (
  item: NavItemDefinition,
  collapsed: boolean,
  selected: boolean,
  onClick: () => void,
  onTogglePin: (() => void) | null,
  pinned: boolean,
) => (
  <ListItem disablePadding sx={{ mb: 0.25 }} key={item.key}>
    <Tooltip title={collapsed ? item.label : ''} placement="right">
      <ListItemButton
        selected={selected}
        aria-label={item.label}
        onClick={onClick}
        sx={{
          borderRadius: 1.5,
          minHeight: 38,
          justifyContent: collapsed ? 'center' : 'flex-start',
          px: collapsed ? 1 : 1.25,
          '&.Mui-selected': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': { bgcolor: 'primary.dark' },
            '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
          },
          '&:not(.Mui-selected):hover': { bgcolor: 'action.hover' },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: collapsed ? 'auto' : 30,
            mr: collapsed ? 0 : 0.5,
            justifyContent: 'center',
            color: selected ? 'inherit' : 'text.secondary',
          }}
        >
          {item.icon}
        </ListItemIcon>
        {!collapsed && (
          <>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: selected ? 700 : 500 }} />
            {onTogglePin && (
              <IconButton
                size="small"
                edge="end"
                aria-label={pinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePin();
                }}
                sx={{ ml: 0.5, color: pinned ? 'primary.main' : 'text.disabled' }}
              >
                <PushPinOutlinedIcon fontSize="inherit" />
              </IconButton>
            )}
          </>
        )}
      </ListItemButton>
    </Tooltip>
  </ListItem>
);

export const navItems: { section: NavSection; label: string; icon: ReactNode }[] = [
  { section: 'dashboard', label: 'Dashboard', icon: <DashboardRoundedIcon /> },
  { section: 'migration', label: 'Migration Jobs', icon: <RocketLaunchRoundedIcon /> },
  { section: 'triggers', label: 'Manage Triggers', icon: <AlarmRoundedIcon /> },
  { section: 'history', label: 'Historical Data', icon: <BarChartRoundedIcon /> },
  { section: 'optionchain', label: 'Option Chain', icon: <QueryStatsRoundedIcon /> },
  { section: 'trading', label: 'Trading window', icon: <CandlestickChartRoundedIcon /> },
  { section: 'trading-scripts', label: 'Trading Scripts', icon: <CodeRoundedIcon /> },
  { section: 'intra', label: 'Intra Trade', icon: <TimelineRoundedIcon /> },
  { section: 'backtest', label: 'Backtest', icon: <AssessmentRoundedIcon /> },
  { section: 'market-signals', label: 'Market Signals', icon: <InsightsRoundedIcon /> },
  { section: 'trading-desk', label: 'Trading Desk', icon: <SsidChartRoundedIcon /> },
];

export const SidebarContent = ({
  collapsed,
  section,
  onSection,
  intraSubSection,
  onIntraSubSection,
  backtestSubSection,
  onBacktestSubSection,
  marketSignalsSubSection,
  onMarketSignalsSubSection,
  tradingDeskSubSection,
  onTradingDeskSubSection,
  pinnedNavItemKeys,
  onPinnedNavItemKeysChange,
  expandedNavGroup,
  onExpandedNavGroupChange,
  tenantId,
  onLogout,
  onClose,
  isMobile,
}: Omit<SidebarProps, 'open'>) => {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');

  const sanitizedPinned = useMemo(() => {
    const set = new Set<NavItemKey>();
    [...DEFAULT_PINNED, ...pinnedNavItemKeys].forEach((key) => {
      if (ITEM_BY_KEY.has(key)) set.add(key);
    });
    return [...set];
  }, [pinnedNavItemKeys]);

  const quickAccessItems = useMemo(
    () => sanitizedPinned.map((key) => ITEM_BY_KEY.get(key)).filter((item): item is NavItemDefinition => Boolean(item)),
    [sanitizedPinned],
  );

  const filteredPaletteItems = useMemo(() => {
    const normalized = paletteQuery.trim().toLowerCase();
    if (!normalized) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => {
      if (item.label.toLowerCase().includes(normalized)) return true;
      if (GROUP_LABEL[item.group].toLowerCase().includes(normalized)) return true;
      return item.aliases.some((alias) => alias.toLowerCase().includes(normalized));
    });
  }, [paletteQuery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isK = event.key.toLowerCase() === 'k';
      if ((event.metaKey || event.ctrlKey) && isK) {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen]);

  const handleNavigateItem = (item: NavItemDefinition) => {
    navigateToItem(item, onSection, onIntraSubSection, onBacktestSubSection, onMarketSignalsSubSection, onTradingDeskSubSection);
    setPaletteOpen(false);
    setPaletteQuery('');
    if (isMobile) onClose();
  };

  const togglePin = (itemKey: NavItemKey) => {
    if (sanitizedPinned.includes(itemKey)) {
      const remaining = sanitizedPinned.filter((key) => key !== itemKey);
      onPinnedNavItemKeysChange(remaining.length > 0 ? remaining : DEFAULT_PINNED);
      return;
    }
    onPinnedNavItemKeysChange([...sanitizedPinned, itemKey]);
  };

  const renderExpandedGroups = () => (
    <>
      <Typography variant="overline" color="text.secondary" sx={{ px: 1.25, fontSize: '0.63rem', letterSpacing: '0.08em' }}>
        {GROUP_LABEL['quick-access']}
      </Typography>
      <List dense disablePadding sx={{ mb: 0.75 }}>
        {quickAccessItems.map((item) => renderNavRow(
          item,
          collapsed,
          isItemActive(item, section, intraSubSection, backtestSubSection, marketSignalsSubSection, tradingDeskSubSection),
          () => handleNavigateItem(item),
          () => togglePin(item.key),
          true,
        ))}
      </List>

      {GROUP_ORDER.map((groupKey) => {
        const groupItems = NAV_ITEMS.filter((item) => item.group === groupKey);
        const expanded = expandedNavGroup === groupKey;
        return (
          <Box key={groupKey} sx={{ mb: 0.5 }}>
            <ListItem disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                onClick={() => onExpandedNavGroupChange(expanded ? 'quick-access' : groupKey)}
                aria-label={`${GROUP_LABEL[groupKey]} section`}
                sx={{ borderRadius: 1.5, minHeight: 34, px: 1.25 }}
              >
                <ListItemText
                  primary={GROUP_LABEL[groupKey]}
                  primaryTypographyProps={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', color: 'text.secondary' }}
                />
                {expanded ? <ExpandLessRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
              </ListItemButton>
            </ListItem>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <List dense disablePadding>
                {groupItems.map((item) => renderNavRow(
                  item,
                  collapsed,
                  isItemActive(item, section, intraSubSection, backtestSubSection, marketSignalsSubSection, tradingDeskSubSection),
                  () => handleNavigateItem(item),
                  () => togglePin(item.key),
                  sanitizedPinned.includes(item.key),
                ))}
              </List>
            </Collapse>
          </Box>
        );
      })}
    </>
  );

  const renderCollapsedRail = () => {
    const iconItems = [
      ...quickAccessItems,
      ...['intra-monitor', 'trading-scripts', 'trading-desk', 'option-chain', 'market-watch', 'backtest-pnl', 'migration', 'manage-triggers', 'dashboard']
        .map((key) => ITEM_BY_KEY.get(key as NavItemKey))
        .filter((item): item is NavItemDefinition => Boolean(item)),
    ].filter((item, index, arr) => arr.findIndex((candidate) => candidate.key === item.key) === index);

    return (
      <List dense sx={{ px: 0.5 }}>
        {iconItems.map((item, index) => (
          <ListItem disablePadding key={item.key} sx={{ justifyContent: 'center', mb: 0.4 }}>
            <Tooltip title={item.label} placement="right">
              <ListItemButton
                selected={isItemActive(item, section, intraSubSection, backtestSubSection, marketSignalsSubSection, tradingDeskSubSection)}
                aria-label={item.label}
                onClick={() => handleNavigateItem(item)}
                sx={{
                  width: 40,
                  minHeight: 34,
                  borderRadius: 1.25,
                  justifyContent: 'center',
                  px: 0,
                  '&.Mui-selected': { bgcolor: 'action.selected', color: 'primary.main', '&:hover': { bgcolor: 'action.selected' } },
                }}
              >
                {item.icon}
              </ListItemButton>
            </Tooltip>
            {index === quickAccessItems.length - 1 && quickAccessItems.length > 0 && (
              <Box sx={{ position: 'absolute', bottom: -6, left: 8, right: 8, borderBottom: '1px solid', borderColor: 'divider' }} />
            )}
          </ListItem>
        ))}
      </List>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: collapsed ? 1.5 : 2.5, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1.5, alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <Tooltip title={collapsed ? 'InAlgo Trade Console' : ''} placement="right">
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: 'primary.main',
                background: 'linear-gradient(135deg, #1a3a6b 0%, #2d5499 100%)',
              }}
            >
              <ShowChartRoundedIcon fontSize="small" />
            </Avatar>
          </Tooltip>
          {!collapsed && (
            <Box>
              <Typography variant="h6" fontWeight={800} color="primary.main" sx={{ lineHeight: 1.1, fontSize: '0.95rem' }}>
                InAlgo
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.05em' }}>
                TRADE CONSOLE
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ px: collapsed ? 1 : 1.5, py: 1.5 }} data-testid="sidebar-tenant-chip">
        {collapsed ? (
          <Tooltip title={tenantId} placement="right">
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Avatar variant="rounded" sx={{ width: 34, height: 34, bgcolor: 'action.hover', color: 'primary.main' }}>
                <StorageRoundedIcon fontSize="small" />
              </Avatar>
            </Box>
          </Tooltip>
        ) : (
          <Chip
            icon={<StorageRoundedIcon style={{ fontSize: 14 }} />}
            label={tenantId}
            size="small"
            variant="outlined"
            color="primary"
            sx={{ width: '100%', justifyContent: 'flex-start', fontWeight: 600, fontSize: '0.72rem' }}
          />
        )}
      </Box>

      <Box sx={{ px: collapsed ? 0.5 : 0.75, pb: 1 }}>
        <Tooltip title={collapsed ? 'Command Palette (Ctrl/Cmd+K)' : ''} placement="right">
          <ListItemButton
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
            sx={{ borderRadius: 1.5, minHeight: 34, justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 0.75 : 1.25 }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 'auto' : 30, color: 'text.secondary' }}>
              <SearchRoundedIcon fontSize="small" />
            </ListItemIcon>
            {!collapsed && <ListItemText primary="Jump to (Ctrl/Cmd+K)" primaryTypographyProps={{ fontSize: '0.76rem', color: 'text.secondary', fontWeight: 600 }} />}
          </ListItemButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: collapsed ? 0.25 : 0.5 }}>
        {collapsed ? renderCollapsedRail() : renderExpandedGroups()}
      </Box>

      <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Tooltip title={collapsed ? 'Logout' : ''} placement="right">
          <ListItemButton
            onClick={onLogout}
            aria-label="Logout"
            sx={{ borderRadius: 1.5, color: 'error.main', justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 1 : 1.5, '&:hover': { bgcolor: 'error.light', color: 'error.dark' } }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 'auto' : 34, mr: collapsed ? 0 : undefined, color: 'inherit', justifyContent: 'center' }}>
              <LogoutRoundedIcon fontSize="small" />
            </ListItemIcon>
            {!collapsed && <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 600 }} />}
          </ListItemButton>
        </Tooltip>
      </Box>

      <Dialog open={paletteOpen} onClose={() => setPaletteOpen(false)} fullWidth maxWidth="sm" aria-label="Command Palette">
        <DialogTitle sx={{ pb: 1 }}>Go to</DialogTitle>
        <DialogContent sx={{ pt: 0.5 }}>
          <TextField
            autoFocus
            fullWidth
            placeholder="Search pages, workflows, and tools"
            value={paletteQuery}
            onChange={(event) => setPaletteQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && filteredPaletteItems.length > 0) {
                event.preventDefault();
                handleNavigateItem(filteredPaletteItems[0]);
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            size="small"
            sx={{ mb: 1.5 }}
          />
          <List dense>
            {filteredPaletteItems.map((item) => (
              <ListItem disablePadding key={`palette-${item.key}`} sx={{ mb: 0.25 }}>
                <ListItemButton
                  onClick={() => handleNavigateItem(item)}
                  aria-label={`Open ${item.label}`}
                  sx={{ borderRadius: 1.25 }}
                >
                  <ListItemIcon sx={{ minWidth: 30, color: 'text.secondary' }}>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    secondary={GROUP_LABEL[item.group]}
                    primaryTypographyProps={{ fontSize: '0.84rem', fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: '0.72rem' }}
                  />
                  <IconButton
                    size="small"
                    edge="end"
                    aria-label={sanitizedPinned.includes(item.key) ? `Unpin ${item.label}` : `Pin ${item.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      togglePin(item.key);
                    }}
                    sx={{ color: sanitizedPinned.includes(item.key) ? 'primary.main' : 'text.disabled' }}
                  >
                    <PushPinOutlinedIcon fontSize="inherit" />
                  </IconButton>
                </ListItemButton>
              </ListItem>
            ))}
            {filteredPaletteItems.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1.25, py: 1 }}>
                No matching destinations.
              </Typography>
            )}
          </List>
        </DialogContent>
      </Dialog>
    </Box>
  );
};
