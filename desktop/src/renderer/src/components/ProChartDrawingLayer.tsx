import {
  Box,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import CropSquareRoundedIcon from '@mui/icons-material/CropSquareRounded';
import HorizontalRuleRoundedIcon from '@mui/icons-material/HorizontalRuleRounded';
import MouseRoundedIcon from '@mui/icons-material/MouseRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import StraightenRoundedIcon from '@mui/icons-material/StraightenRounded';
import SwapVertRoundedIcon from '@mui/icons-material/SwapVertRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { useMemo, useRef, useState, type MutableRefObject, type MouseEvent as ReactMouseEvent } from 'react';
import {
  createDrawingLabel,
  createLocalId,
  type ChartDrawing,
  type ChartVisualTheme,
  type DrawingTool,
  type DrawableTool,
  type PreparedCandle,
} from './ProChartCanvasShared';

type MainSeries = ISeriesApi<'Candlestick'> | ISeriesApi<'Bar'> | ISeriesApi<'Area'> | ISeriesApi<'Line'> | ISeriesApi<'Baseline'>;

interface OverlayPoint {
  time: number;
  price: number;
  x: number;
  y: number;
}

export interface ProChartDrawingLayerProps {
  theme: ChartVisualTheme;
  activeTool: DrawingTool;
  drawings: ChartDrawing[];
  mainChartHeight: number;
  preparedCandles: PreparedCandle[];
  viewportVersion: number;
  magnetMode: boolean;
  keepDrawing: boolean;
  showToolbar: boolean;
  priceChartRef: MutableRefObject<IChartApi | null>;
  mainSeriesRef: MutableRefObject<MainSeries | null>;
  onActiveToolChange: (tool: DrawingTool) => void;
  onDrawingsChange: (updater: (current: ChartDrawing[]) => ChartDrawing[]) => void;
}

const DRAWING_COLORS: Record<DrawableTool, string> = {
  trendLine: '#38bdf8',
  horizontalLine: '#f97316',
  verticalLine: '#c084fc',
  rectangle: '#22c55e',
  text: '#facc15',
  measure: '#fb7185',
};

const TOOL_META: Array<{ value: DrawingTool; label: string; icon: typeof MouseRoundedIcon }> = [
  { value: 'cursor', label: 'Cursor', icon: MouseRoundedIcon },
  { value: 'trendLine', label: 'Trend line', icon: ShowChartRoundedIcon },
  { value: 'horizontalLine', label: 'Horizontal line', icon: HorizontalRuleRoundedIcon },
  { value: 'verticalLine', label: 'Vertical line', icon: SwapVertRoundedIcon },
  { value: 'rectangle', label: 'Zone', icon: CropSquareRoundedIcon },
  { value: 'text', label: 'Text note', icon: TextFieldsRoundedIcon },
  { value: 'measure', label: 'Measure', icon: StraightenRoundedIcon },
];

const toMainSeriesPoint = (
  chart: IChartApi | null,
  series: MainSeries | null,
  x: number,
  y: number,
): OverlayPoint | null => {
  if (!chart || !series) return null;
  const time = chart.timeScale().coordinateToTime(x);
  const price = series.coordinateToPrice(y);
  if (typeof time !== 'number' || typeof price !== 'number') return null;
  return { time, price, x, y };
};

const snapPointToCandle = (point: OverlayPoint, candles: PreparedCandle[]) => {
  if (candles.length === 0) return point;
  const nearest = candles.reduce((best, candle) => (
    Math.abs(candle.time - point.time) < Math.abs(best.time - point.time) ? candle : best
  ), candles[0]);
  const levels = [nearest.open, nearest.high, nearest.low, nearest.close];
  const snappedPrice = levels.reduce((best, value) => (
    Math.abs(value - point.price) < Math.abs(best - point.price) ? value : best
  ), levels[0]);
  return {
    ...point,
    time: nearest.time,
    price: snappedPrice,
  };
};

const measureLabel = (startPrice: number, endPrice: number) => {
  const delta = endPrice - startPrice;
  const percent = startPrice === 0 ? 0 : (delta / startPrice) * 100;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
};

export const ProChartDrawingLayer = ({
  theme,
  activeTool,
  drawings,
  mainChartHeight,
  preparedCandles,
  viewportVersion,
  magnetMode,
  keepDrawing,
  showToolbar,
  priceChartRef,
  mainSeriesRef,
  onActiveToolChange,
  onDrawingsChange,
}: ProChartDrawingLayerProps) => {
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const [draftStart, setDraftStart] = useState<OverlayPoint | null>(null);
  const [draftCurrent, setDraftCurrent] = useState<OverlayPoint | null>(null);

  const overlayWidth = overlayRef.current?.clientWidth ?? 0;

  const chartPointFromEvent = (event: ReactMouseEvent<SVGSVGElement>) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const point = toMainSeriesPoint(
      priceChartRef.current,
      mainSeriesRef.current,
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    if (!point) return null;
    return magnetMode ? snapPointToCandle(point, preparedCandles) : point;
  };

  const toScreen = (time: number, price: number) => {
    const chart = priceChartRef.current;
    const series = mainSeriesRef.current;
    if (!chart || !series) return null;
    const x = chart.timeScale().timeToCoordinate(time as Time);
    const y = series.priceToCoordinate(price);
    if (x === null || y === null) return null;
    return { x, y };
  };

  const createDrawing = (tool: DrawableTool, start: OverlayPoint, end?: OverlayPoint) => {
    onDrawingsChange((current) => {
      const nextIndex = current.filter((drawing) => drawing.type === tool).length + 1;
      if (tool === 'horizontalLine') {
        return [...current, {
          id: createLocalId('drawing'),
          type: 'horizontalLine',
          label: createDrawingLabel('horizontalLine', nextIndex),
          color: DRAWING_COLORS.horizontalLine,
          visible: true,
          locked: false,
          price: start.price,
        }];
      }
      if (tool === 'verticalLine') {
        return [...current, {
          id: createLocalId('drawing'),
          type: 'verticalLine',
          label: createDrawingLabel('verticalLine', nextIndex),
          color: DRAWING_COLORS.verticalLine,
          visible: true,
          locked: false,
          time: start.time,
        }];
      }
      if (tool === 'text') {
        const text = window.prompt('Text note', 'Watch reaction here');
        if (!text?.trim()) return current;
        return [...current, {
          id: createLocalId('drawing'),
          type: 'text',
          label: createDrawingLabel('text', nextIndex),
          color: DRAWING_COLORS.text,
          visible: true,
          locked: false,
          time: start.time,
          price: start.price,
          text: text.trim(),
        }];
      }

      if (!end) return current;
      if (tool === 'trendLine') {
        return [...current, {
          id: createLocalId('drawing'),
          type: 'trendLine',
          label: createDrawingLabel('trendLine', nextIndex),
          color: DRAWING_COLORS.trendLine,
          visible: true,
          locked: false,
          startTime: start.time,
          startPrice: start.price,
          endTime: end.time,
          endPrice: end.price,
        }];
      }
      if (tool === 'rectangle') {
        return [...current, {
          id: createLocalId('drawing'),
          type: 'rectangle',
          label: createDrawingLabel('rectangle', nextIndex),
          color: DRAWING_COLORS.rectangle,
          visible: true,
          locked: false,
          startTime: start.time,
          startPrice: start.price,
          endTime: end.time,
          endPrice: end.price,
        }];
      }
      return [...current, {
        id: createLocalId('drawing'),
        type: 'measure',
        label: createDrawingLabel('measure', nextIndex),
        color: DRAWING_COLORS.measure,
        visible: true,
        locked: false,
        startTime: start.time,
        startPrice: start.price,
        endTime: end.time,
        endPrice: end.price,
      }];
    });
  };

  const resetDraft = () => {
    setDraftStart(null);
    setDraftCurrent(null);
    if (!keepDrawing) {
      onActiveToolChange('cursor');
    }
  };

  const handlePointerDown = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (activeTool === 'cursor') return;
    const point = chartPointFromEvent(event);
    if (!point) return;

    if (activeTool === 'horizontalLine' || activeTool === 'verticalLine' || activeTool === 'text') {
      createDrawing(activeTool, point);
      resetDraft();
      return;
    }

    if (!draftStart) {
      setDraftStart(point);
      setDraftCurrent(point);
      return;
    }

    createDrawing(activeTool, draftStart, point);
    resetDraft();
  };

  const handlePointerMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!draftStart) return;
    const point = chartPointFromEvent(event);
    if (point) {
      setDraftCurrent(point);
    }
  };

  const renderedDrawings = useMemo(() => drawings
    .filter((drawing) => drawing.visible)
    .map((drawing) => {
      if (drawing.type === 'horizontalLine') {
        const point = toScreen(preparedCandles.at(-1)?.time ?? 0, drawing.price);
        if (!point) return null;
        return { drawing, type: 'horizontalLine' as const, y: point.y };
      }
      if (drawing.type === 'verticalLine') {
        const point = toScreen(drawing.time, preparedCandles.at(-1)?.close ?? 0);
        if (!point) return null;
        return { drawing, type: 'verticalLine' as const, x: point.x };
      }
      if (drawing.type === 'text') {
        const point = toScreen(drawing.time, drawing.price);
        if (!point) return null;
        return { drawing, type: 'text' as const, point };
      }
      const start = toScreen(drawing.startTime, drawing.startPrice);
      const end = toScreen(drawing.endTime, drawing.endPrice);
      if (!start || !end) return null;
      return { drawing, type: drawing.type, start, end };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null), [drawings, preparedCandles, viewportVersion]);

  return (
    <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {showToolbar && (
        <Box
          sx={{
            position: 'absolute',
            left: 10,
            top: 10,
            zIndex: 4,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            p: 0.75,
            borderRadius: 2,
            bgcolor: theme.toolbarBg,
            border: `1px solid ${theme.border}`,
          }}
        >
          {TOOL_META.map((tool) => {
            const Icon = tool.icon;
            const selected = activeTool === tool.value;
            return (
              <Tooltip title={tool.label} placement="right" key={tool.value}>
                <IconButton
                  size="small"
                  data-testid={`trading-chart-drawing-tool-${tool.value}`}
                  onClick={() => {
                    setDraftStart(null);
                    setDraftCurrent(null);
                    onActiveToolChange(tool.value);
                  }}
                  sx={{
                    color: selected ? '#0f172a' : theme.text,
                    bgcolor: selected ? theme.chipBg : 'transparent',
                    border: `1px solid ${selected ? theme.chipBg : theme.border}`,
                  }}
                >
                  <Icon fontSize="small" />
                </IconButton>
              </Tooltip>
            );
          })}
        </Box>
      )}

      <svg
        ref={overlayRef}
        width="100%"
        height={mainChartHeight}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: activeTool === 'cursor' ? 'none' : 'auto',
          cursor: activeTool === 'cursor' ? 'default' : 'crosshair',
        }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
      >
        {renderedDrawings.map((item) => {
          if (item.type === 'horizontalLine') {
            return (
              <g key={item.drawing.id}>
                <line x1={0} x2={overlayWidth} y1={item.y} y2={item.y} stroke={item.drawing.color} strokeWidth={2} strokeDasharray="8 6" />
                <text x={10} y={Math.max(16, item.y - 6)} fill={item.drawing.color} fontSize="12">{item.drawing.label}</text>
              </g>
            );
          }
          if (item.type === 'verticalLine') {
            return (
              <g key={item.drawing.id}>
                <line x1={item.x} x2={item.x} y1={0} y2={mainChartHeight} stroke={item.drawing.color} strokeWidth={2} strokeDasharray="8 6" />
                <text x={item.x + 6} y={20} fill={item.drawing.color} fontSize="12">{item.drawing.label}</text>
              </g>
            );
          }
          if (item.type === 'text') {
            return (
              <g key={item.drawing.id}>
                <circle cx={item.point.x} cy={item.point.y} r={4} fill={item.drawing.color} />
                <text x={item.point.x + 8} y={item.point.y - 8} fill={item.drawing.color} fontSize="12">{item.drawing.text}</text>
              </g>
            );
          }

          const width = item.end.x - item.start.x;
          const height = item.end.y - item.start.y;
          if (item.type === 'rectangle') {
            return (
              <g key={item.drawing.id}>
                <rect
                  x={Math.min(item.start.x, item.end.x)}
                  y={Math.min(item.start.y, item.end.y)}
                  width={Math.abs(width)}
                  height={Math.abs(height)}
                  fill={`${item.drawing.color}22`}
                  stroke={item.drawing.color}
                  strokeWidth={2}
                  rx={8}
                />
                <text x={Math.min(item.start.x, item.end.x) + 8} y={Math.min(item.start.y, item.end.y) + 18} fill={item.drawing.color} fontSize="12">
                  {item.drawing.label}
                </text>
              </g>
            );
          }
          if (item.type === 'measure') {
            return (
              <g key={item.drawing.id}>
                <line x1={item.start.x} y1={item.start.y} x2={item.end.x} y2={item.end.y} stroke={item.drawing.color} strokeWidth={2} />
                <rect
                  x={Math.min(item.start.x, item.end.x)}
                  y={Math.min(item.start.y, item.end.y)}
                  width={Math.abs(width)}
                  height={Math.abs(height)}
                  fill="transparent"
                  stroke={item.drawing.color}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
                <text x={item.end.x + 8} y={item.end.y - 8} fill={item.drawing.color} fontSize="12">
                  {measureLabel(item.drawing.startPrice, item.drawing.endPrice)}
                </text>
              </g>
            );
          }
          return (
            <g key={item.drawing.id}>
              <line x1={item.start.x} y1={item.start.y} x2={item.end.x} y2={item.end.y} stroke={item.drawing.color} strokeWidth={2.5} />
              <text x={item.end.x + 8} y={item.end.y - 8} fill={item.drawing.color} fontSize="12">{item.drawing.label}</text>
            </g>
          );
        })}

        {draftStart && draftCurrent && (
          <>
            {(activeTool === 'trendLine' || activeTool === 'measure') && (
              <line x1={draftStart.x} y1={draftStart.y} x2={draftCurrent.x} y2={draftCurrent.y} stroke={theme.chipText} strokeWidth={2} strokeDasharray="6 4" />
            )}
            {activeTool === 'rectangle' && (
              <rect
                x={Math.min(draftStart.x, draftCurrent.x)}
                y={Math.min(draftStart.y, draftCurrent.y)}
                width={Math.abs(draftCurrent.x - draftStart.x)}
                height={Math.abs(draftCurrent.y - draftStart.y)}
                fill={`${theme.chipText}14`}
                stroke={theme.chipText}
                strokeWidth={2}
                rx={8}
              />
            )}
          </>
        )}
      </svg>

      {draftStart && (
        <Box
          sx={{
            position: 'absolute',
            left: showToolbar ? 72 : 12,
            bottom: 12,
            px: 1.25,
            py: 0.75,
            borderRadius: 2,
            bgcolor: theme.overlayBg,
            color: theme.strongText,
            border: `1px solid ${theme.border}`,
          }}
        >
          <Typography variant="caption">
            Click a second point to place the {TOOL_META.find((tool) => tool.value === activeTool)?.label.toLowerCase()}.
          </Typography>
        </Box>
      )}
    </Box>
  );
};
