import { Chip, Stack } from '@mui/material';
import type { ChartDrawing, ChartVisualTheme, CompareSeriesState } from './ProChartCanvasShared';
import { instrumentLabelFrom } from './ProChartCanvasShared';

export interface ProChartSurfaceMetaProps {
  theme: ChartVisualTheme;
  compareResults: CompareSeriesState[];
  drawings: ChartDrawing[];
}

export const ProChartSurfaceMeta = ({ theme, compareResults, drawings }: ProChartSurfaceMetaProps) => {
  const visibleCompare = compareResults.filter((item) => item.visible);
  if (visibleCompare.length === 0 && drawings.length === 0) return null;

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" gap={0.75} sx={{ mb: 1 }}>
      {visibleCompare.map((item) => (
        <Chip
          key={item.id}
          size="small"
          label={`${item.label ?? instrumentLabelFrom(item.instrumentKey)}${item.loading ? ' · Loading' : item.error ? ' · Error' : ''}`}
          sx={{
            bgcolor: `${item.color}22`,
            border: `1px solid ${item.color}`,
            color: theme.strongText,
          }}
        />
      ))}
      {drawings.length > 0 && (
        <Chip size="small" label={`${drawings.length} drawing${drawings.length === 1 ? '' : 's'}`} variant="outlined" />
      )}
    </Stack>
  );
};
