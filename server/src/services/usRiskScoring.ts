import type { IndicatorResult } from './usIndicators.js';
import type { MacroIndicator } from './macroData.js';

export interface RiskDimension {
  dimension: string;
  dimensionZh: string;
  ruleScore: number;
  aiAdjustment: number;
  finalScore: number;
  riskLevel: string;      // 'low' | 'medium' | 'high' | 'extreme'
  riskLevelZh: string;
  reasons: string[];
}

export interface RiskSummary {
  date: string;
  dimensions: RiskDimension[];
  overallScore: number;
  overallLevel: string;
  overallLevelZh: string;
  dataTime: string;
  source: string;
}

// Score → level mapping
function scoreToLevel(score: number): { level: string; label: string } {
  if (score <= 30) return { level: 'low', label: '低风险' };
  if (score <= 60) return { level: 'medium', label: '中性' };
  if (score <= 80) return { level: 'high', label: '高风险' };
  return { level: 'extreme', label: '极高风险' };
}

// Core stocks per risk dimension for trend analysis
const DIMENSION_STOCKS: Record<string, string[]> = {
  index: ['^GSPC', '^IXIC', '^DJI'],
  tech: ['QQQ', 'XLK', 'MSFT', 'AAPL', 'GOOGL', 'META', 'AMZN', 'TSLA', 'NFLX'],
  semiconductor: ['NVDA', 'AVGO', 'AMD', 'MU', 'TSM', 'ASML', 'INTC', 'QCOM', 'AMAT'],
  optical: ['AVGO', 'MRVL', 'ANET', 'CIEN', 'COHR', 'LITE', 'AAOI', 'FN'],
  gold_silver: ['GLD', 'SLV', 'GDX', 'GDXJ'],
  macro: ['VIX', 'DXY', 'US10Y'],
};

export function computeRiskScores(
  indicators: Map<string, IndicatorResult>,
  macroMap: Map<string, MacroIndicator>,
  indexChanges: Map<string, number>,  // index → changePct
  reportDate: string
): RiskSummary {
  const now = new Date().toISOString();
  const dimensions: RiskDimension[] = [];
  const dimKeys = Object.keys(DIMENSION_STOCKS) as Array<keyof typeof DIMENSION_STOCKS>;
  const dimNames: Record<string, string> = {
    index: '指数风险',
    tech: '科技股风险',
    semiconductor: '半导体风险',
    optical: '光通信风险',
    gold_silver: '金银风险',
    macro: '宏观风险',
  };

  for (const key of dimKeys) {
    const stocks = DIMENSION_STOCKS[key];
    const reasons: string[] = [];
    let score = 0;

    for (const symbol of stocks) {
      const ind = indicators.get(symbol);
      if (!ind) continue;

      // Check MA levels
      if (ind.belowMa20) {
        reasons.push(`${symbol} 跌破20日均线`);
        score += 10;
      }
      if (ind.belowMa50) {
        reasons.push(`${symbol} 跌破50日均线`);
        score += 15;
      }
      if (ind.belowMa200) {
        reasons.push(`${symbol} 跌破200日均线`);
        score += 25;
      }

      // 3-day consecutive decline
      if (ind.trend3d === 'down3') {
        reasons.push(`${symbol} 连续3日走弱`);
        score += 10;
      }

      // Daily drop > 2%
      if (ind.changePct < -2) {
        reasons.push(`${symbol} 当日跌幅超2%（${ind.changePct.toFixed(1)}%）`);
        score += 10;
      }

      // Heavy volume selling
      if (ind.changePct < 0 && ind.volumeVsAvg && ind.volumeVsAvg > 1.3) {
        reasons.push(`${symbol} 放量下跌（量比 ${ind.volumeVsAvg.toFixed(2)}）`);
        score += 10;
      }

      // Below 20-day low
      if (ind.low20d && ind.close < ind.low20d) {
        reasons.push(`${symbol} 跌破20日低点`);
        score += 15;
      }
    }

    // Dimension-specific rules
    if (key === 'index') {
      // VIX impact
      const vix = macroMap.get('VIX');
      if (vix?.available && vix.price && vix.price > 25) {
        reasons.push('VIX 高于25，恐慌情绪上升');
        score += 15;
      } else if (vix?.price && vix.price > 20) {
        reasons.push('VIX 位于20以上');
        score += 5;
      }

      // Check if all 3 indices are negative
      const spChange = indexChanges.get('^GSPC') ?? 0;
      const ixChange = indexChanges.get('^IXIC') ?? 0;
      const djChange = indexChanges.get('^DJI') ?? 0;
      if (spChange < 0 && ixChange < 0 && djChange < 0) {
        reasons.push('三大指数同时下跌');
        score += 10;
      }
    }

    if (key === 'tech') {
      // US10Y impact on tech
      const us10y = macroMap.get('US10Y');
      if (us10y?.available && us10y.changePct && us10y.changePct > 0.5) {
        reasons.push('美债收益率快速上行，压制科技股估值');
        score += 10;
      }
    }

    if (key === 'semiconductor') {
      // Check if SOX-related stocks are weaker than index
      const soxStocks = ['NVDA', 'AVGO', 'AMD'];
      const weakCount = soxStocks.filter(s => {
        const ind = indicators.get(s);
        return ind && ind.changePct < (indexChanges.get('^IXIC') ?? 0);
      }).length;
      if (weakCount >= 2) {
        reasons.push('核心半导体龙头集体弱于纳指');
        score += 15;
      }
    }

    if (key === 'gold_silver') {
      // DXY impact
      const dxy = macroMap.get('DXY');
      if (dxy?.available && dxy.changePct && dxy.changePct > 0.3) {
        reasons.push('美元走强，压制金银');
        score += 10;
      }
      // Check both GLD and SLV
      const gldInd = indicators.get('GLD');
      const slvInd = indicators.get('SLV');
      if (gldInd && slvInd && gldInd.changePct < 0 && slvInd.changePct < 0) {
        reasons.push('金银同步下跌');
        score += 10;
      }
    }

    // Cap score at 100
    score = Math.min(score, 100);

    // If no reasons found, give baseline
    if (reasons.length === 0) {
      reasons.push('各项指标正常，无明显风险信号');
      score = 15;
    }

    const { level, label } = scoreToLevel(score);

    dimensions.push({
      dimension: key,
      dimensionZh: dimNames[key] || key,
      ruleScore: score,
      aiAdjustment: 0,
      finalScore: score,
      riskLevel: level,
      riskLevelZh: label,
      reasons,
    });
  }

  // Overall score = weighted average (index 25%, tech 20%, semi 20%, optical 10%, gold 10%, macro 15%)
  const weights: Record<string, number> = { index: 0.25, tech: 0.20, semiconductor: 0.20, optical: 0.10, gold_silver: 0.10, macro: 0.15 };
  let overallScore = 0;
  let totalWeight = 0;
  for (const dim of dimensions) {
    const w = weights[dim.dimension] ?? 0.1;
    overallScore += dim.finalScore * w;
    totalWeight += w;
  }
  overallScore = Math.round(overallScore / totalWeight);

  const { level: oLevel, label: oLabel } = scoreToLevel(overallScore);

  return {
    date: reportDate,
    dimensions,
    overallScore,
    overallLevel: oLevel,
    overallLevelZh: oLabel,
    dataTime: now,
    source: 'Sina/EastMoney + RiskRules v1.0',
  };
}
