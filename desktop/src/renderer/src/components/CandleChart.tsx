import { useEffect, useRef } from 'react';
import { createChart, type IChartApi, type CandlestickData } from 'lightweight-charts';
import type { Candle } from '../api/candles';

interface Props {
  candles: Candle[];
}

export const CandleChart = ({ candles }: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, { autoSize: true, layout: { background: { color: '#0d1117' }, textColor: '#d1d4dc' } });
    chartRef.current = chart;
    const series = chart.addCandlestickSeries();
    series.setData(candles.map(toSeriesCandle));

    return () => chart.remove();
  }, [candles]);

  return <div ref={ref} style={{ height: 480, width: '100%' }} />;
};

const toSeriesCandle = (candle: Candle): CandlestickData => ({
  time: (new Date(candle.candleTs).getTime() / 1000) as CandlestickData['time'],
  open: candle.openPrice,
  high: candle.highPrice,
  low: candle.lowPrice,
  close: candle.closePrice
});
