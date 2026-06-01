import { stockDataService, type HistoricalDataPoint } from './stockData.js';

export interface IndicatorResult {
  symbol: string;
  close: number;
  prevClose: number;
  changePct: number;
  volume: number;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  belowMa20: boolean;
  belowMa50: boolean;
  belowMa200: boolean;
  high20d: number | null;
  low20d: number | null;
  volumeVsAvg: number | null;    // current volume / 20-day avg volume
  trend3d: string;               // 'up3' | 'up2' | 'down2' | 'down3' | 'mixed'
  trend3dLabel: string;
  dataTime: string;
  source: string;
}

// Calculate Simple Moving Average
function calcSMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// Calculate 3-day trend
function calcTrend3d(closes: number[]): { trend: string; label: string } {
  if (closes.length < 3) return { trend: 'mixed', label: '数据不足' };

  const recent = closes.slice(-3);
  let upDays = 0;
  let downDays = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] > recent[i - 1]) upDays++;
    else if (recent[i] < recent[i - 1]) downDays++;
  }

  if (upDays >= 2 && recent[2] > recent[0]) return { trend: 'up3', label: '连续走强 ↑' };
  if (upDays >= 2) return { trend: 'up', label: '偏强 ↗' };
  if (downDays >= 2 && recent[2] < recent[0]) return { trend: 'down3', label: '连续走弱 ↓' };
  if (downDays >= 2) return { trend: 'down', label: '偏弱 ↘' };
  return { trend: 'mixed', label: '震荡整理 →' };
}

export async function computeIndicators(
  symbol: string,
  historical?: HistoricalDataPoint[],
  quote?: { close: number; prevClose?: number; changePct?: number; volume: number }
): Promise<IndicatorResult | null> {
  // Fetch historical if not provided
  if (!historical || historical.length < 5) {
    try {
      historical = await stockDataService.getHistorical(symbol, '1d', '6mo');
    } catch {
      // Historical data unavailable — continue with quote data only
      historical = [];
    }
  }

  const closes = historical.map(h => h.close);
  const volumes = historical.map(h => h.volume);
  const latestClose = quote?.close ?? closes[closes.length - 1] ?? 0;
  const prevClose = quote?.prevClose ?? (closes.length >= 2 ? closes[closes.length - 2] : latestClose);
  const changePct = quote?.changePct ?? (prevClose ? ((latestClose - prevClose) / prevClose) * 100 : 0);
  const volume = quote?.volume ?? volumes[volumes.length - 1] ?? 0;

  const ma20 = calcSMA(closes, 20);
  const ma50 = calcSMA(closes, 50);
  const ma200 = calcSMA(closes, 200);

  const recent20Closes = closes.slice(-20);
  const high20d = recent20Closes.length > 0 ? Math.max(...recent20Closes) : null;
  const low20d = recent20Closes.length > 0 ? Math.min(...recent20Closes) : null;

  const recent20Volumes = volumes.slice(-20);
  const avgVol20d = recent20Volumes.length > 0
    ? recent20Volumes.reduce((a, b) => a + b, 0) / recent20Volumes.length
    : null;
  const volumeVsAvg = avgVol20d && avgVol20d > 0 ? volume / avgVol20d : null;

  const { trend, label: trendLabel } = calcTrend3d(closes);

  return {
    symbol,
    close: latestClose,
    prevClose,
    changePct: Math.round(changePct * 100) / 100,
    volume,
    ma20: ma20 ? Math.round(ma20 * 100) / 100 : null,
    ma50: ma50 ? Math.round(ma50 * 100) / 100 : null,
    ma200: ma200 ? Math.round(ma200 * 100) / 100 : null,
    belowMa20: ma20 ? latestClose < ma20 : false,
    belowMa50: ma50 ? latestClose < ma50 : false,
    belowMa200: ma200 ? latestClose < ma200 : false,
    high20d: high20d ? Math.round(high20d * 100) / 100 : null,
    low20d: low20d ? Math.round(low20d * 100) / 100 : null,
    volumeVsAvg: volumeVsAvg ? Math.round(volumeVsAvg * 100) / 100 : null,
    trend3d: trend,
    trend3dLabel: trendLabel,
    dataTime: new Date().toISOString(),
    source: 'Sina/EastMoney',
  };
}

// Batch compute indicators for multiple symbols
export async function computeBatchIndicators(
  symbols: string[],
  quotesMap?: Map<string, { close: number; prevClose?: number; changePct?: number; volume: number }>
): Promise<Map<string, IndicatorResult>> {
  const results = new Map<string, IndicatorResult>();

  for (const symbol of symbols) {
    try {
      const quote = quotesMap?.get(symbol);
      const result = await computeIndicators(symbol, undefined, quote);
      if (result) results.set(symbol, result);
    } catch (err: any) {
      console.warn(`[Indicators] Failed for ${symbol}: ${err.message}`);
    }
  }

  return results;
}

// Volume status label
export function volumeStatusLabel(ratio: number | null): string {
  if (ratio === null) return '数据缺失';
  if (ratio > 2) return '巨量 🔴';
  if (ratio > 1.3) return '放量 🟠';
  if (ratio > 0.7) return '正常 ⚪';
  return '缩量 🔵';
}
