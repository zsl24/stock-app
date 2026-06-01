import type { RiskSummary, RiskDimension } from './usRiskScoring.js';
import type { IndicatorResult } from './usIndicators.js';
import type { MacroIndicator } from './macroData.js';
import type { EarningsResult } from './earningsData.js';

export interface ReportSection {
  title: string;
  content: string;
}

export interface DailyReport {
  reportDate: string;
  title: string;
  sections: ReportSection[];
  reportText: string;
  marketSummary: string;
  riskSummary: string;
  actionSummary: string;
  opportunitySummary: string;
  dataQualityNotes: string[];
}

// Format a number as percentage string
function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '数据缺失';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

// Get action for a stock based on indicators
function stockAction(ind: IndicatorResult): string {
  if (!ind) return '数据缺失';

  const actions: string[] = [];

  if (ind.belowMa200) actions.push('⚠️ 止损/减仓');
  else if (ind.belowMa50 && ind.trend3d.startsWith('down')) actions.push('等待回调企稳');
  else if (ind.belowMa20 && ind.trend3d === 'mixed') actions.push('观察');
  else if (ind.changePct > 2 && ind.volumeVsAvg && ind.volumeVsAvg > 1.3) actions.push('放量突破，关注');
  else if (ind.trend3d === 'up3' && !ind.belowMa20) actions.push('持有');
  else if (ind.trend3d === 'down3') actions.push('减仓观望');
  else actions.push('持有');

  return actions[0];
}

// Format risk dimension as a table row
function formatRiskRow(dim: RiskDimension): string {
  const levelEmoji: Record<string, string> = {
    low: '🟢', medium: '🟡', high: '🟠', extreme: '🔴',
  };
  return `| ${dim.dimensionZh} | ${levelEmoji[dim.riskLevel] || ''} ${dim.riskLevelZh} | ${dim.finalScore}/100 | ${dim.reasons.slice(0, 3).join('；')} |`;
}

// Get theme for a symbol based on the watchlist
function getThemeForSymbol(symbol: string, themes: Record<string, string[]>): string {
  for (const [theme, stocks] of Object.entries(themes)) {
    if (stocks.includes(symbol)) return theme;
  }
  return '其他';
}

export async function buildDailyReport(
  reportDate: string,
  indicators: Map<string, IndicatorResult>,
  riskScores: RiskSummary,
  macroData: MacroIndicator[],
  earnings: EarningsResult,
  indexData: Array<{ name: string; symbol: string; changePct: number; price: number }>,
  breadthData: { advanceCount: number; declineCount: number; advanceRatio: number },
  sectorData: Array<{ nameZh: string; avgChangePercent: number }>,
  topGainers: Array<{ symbol: string; changePercent: number }>,
  topLosers: Array<{ symbol: string; changePercent: number }>,
  newsAvailable: boolean,
): Promise<DailyReport> {
  const dataQuality: string[] = [];
  const now = new Date().toISOString();

  // --- Section 1: Market Summary ---
  const indexLines = indexData.map(i =>
    `${i.name}（${i.symbol}）：${i.price.toLocaleString()}，${pct(i.changePct)}`
  );

  const macroMap = new Map(macroData.map(m => [m.symbol, m]));
  const macroLines: string[] = [];
  for (const m of macroData) {
    if (m.available && m.price !== null) {
      macroLines.push(`${m.name}：${m.price.toFixed(2)}${m.changePct !== null ? '（' + pct(m.changePct) + '）' : ''}`);
    } else {
      macroLines.push(`${m.name}：数据缺失`);
    }
  }

  // Build the sector summary
  const sectorLines = sectorData.map(s =>
    `${s.nameZh}：${pct(s.avgChangePercent)}`
  );

  // Build the main report text (~800-1200 words in Chinese)
  const overallRiskLabel = riskScores.overallLevelZh;
  const riskEmoji: Record<string, string> = { low: '🟢', medium: '🟡', high: '🟠', extreme: '🔴' };
  const riskIcon = riskEmoji[riskScores.overallLevel] || '⚪';

  // Generate position guidance based on risk level
  const positionGuidance: Record<string, { range: string; tech: string; semi: string; optical: string; gold: string }> = {
    low: { range: '60%–80%', tech: '25%–35%', semi: '15%–25%', optical: '10%–15%', gold: '5%–10%' },
    medium: { range: '40%–60%', tech: '20%–30%', semi: '10%–20%', optical: '5%–10%', gold: '10%–20%' },
    high: { range: '20%–40%', tech: '10%–20%', semi: '5%–10%', optical: '0%–5%', gold: '15%–25%' },
    extreme: { range: '0%–20%', tech: '0%–10%', semi: '0%–5%', optical: '0%', gold: '20%–30%' },
  };
  const guidance = positionGuidance[riskScores.overallLevel] || positionGuidance.medium;

  const reportText = `【美股盘后复盘日报 — ${reportDate}】

## 一、今日市场发生了什么

### 指数表现
${indexLines.join('\n')}

三大指数${riskScores.overallLevel === 'low' ? '全面走强' : riskScores.overallLevel === 'high' ? '承压走弱' : '涨跌互现'}。
市场宽度：${breadthData.advanceCount}只上涨 / ${breadthData.declineCount}只下跌，上涨比率 ${breadthData.advanceRatio.toFixed(0)}%。

### 板块表现
${sectorLines.join('；')}

领涨板块：${sectorData[0]?.nameZh || '无'}（${pct(sectorData[0]?.avgChangePercent)}）| 垫底板块：${sectorData[sectorData.length - 1]?.nameZh || '无'}（${pct(sectorData[sectorData.length - 1]?.avgChangePercent)}）

### 宏观指标
${macroLines.join('\n')}

### 涨跌榜
涨幅前5：${topGainers.map(g => `${g.symbol}(${pct(g.changePercent)})`).join('、')}
跌幅前5：${topLosers.map(g => `${g.symbol}(${pct(g.changePercent)})`).join('、')}

### 金银表现
黄金期货：${macroMap.get('GOLD')?.price?.toFixed(2) || '数据缺失'} | 白银期货：${macroMap.get('SILVER')?.price?.toFixed(2) || '数据缺失'}
GLD：${pct(indicators.get('GLD')?.changePct)} | SLV：${pct(indicators.get('SLV')?.changePct)} | GDX：${pct(indicators.get('GDX')?.changePct)}

### 半导体核心标的
NVDA：${pct(indicators.get('NVDA')?.changePct)} | AVGO：${pct(indicators.get('AVGO')?.changePct)} | AMD：${pct(indicators.get('AMD')?.changePct)} | MU：${pct(indicators.get('MU')?.changePct)}
TSM：${pct(indicators.get('TSM')?.changePct)} | ASML：${pct(indicators.get('ASML')?.changePct)} | AMAT：${pct(indicators.get('AMAT')?.changePct)}

### 大科技核心标的
MSFT：${pct(indicators.get('MSFT')?.changePct)} | AAPL：${pct(indicators.get('AAPL')?.changePct)} | GOOGL：${pct(indicators.get('GOOGL')?.changePct)} | META：${pct(indicators.get('META')?.changePct)}
AMZN：${pct(indicators.get('AMZN')?.changePct)} | TSLA：${pct(indicators.get('TSLA')?.changePct)} | NFLX：${pct(indicators.get('NFLX')?.changePct)}

### 光通信核心标的
AVGO：${pct(indicators.get('AVGO')?.changePct)} | MRVL：${pct(indicators.get('MRVL')?.changePct)} | ANET：${pct(indicators.get('ANET')?.changePct)} | CIEN：${pct(indicators.get('CIEN')?.changePct)}

## 二、风险评分

综合风险评分：${riskScores.overallScore}/100（${riskIcon} ${overallRiskLabel}）

| 维度 | 风险等级 | 分数 | 主要原因 |
|------|---------|------|---------|
${riskScores.dimensions.map(d => formatRiskRow(d)).join('\n')}

AI修正：未启用（ai_adjustment=0），所有评分由规则引擎计算。

## 三、操作建议

### 美股账户总仓位建议：${guidance.range}

### 主题配置建议
| 主题 | 建议配置 | 说明 |
|------|---------|------|
| 大科技 | ${guidance.tech} | ${riskScores.overallLevel === 'extreme' ? '避险为主，仅保留核心仓位' : '分批持有，等待回踩加仓机会'} |
| 半导体 | ${guidance.semi} | ${riskScores.dimensions.find(d => d.dimension === 'semiconductor')?.riskLevel === 'high' ? '高波动，控制仓位' : '关注行业催化剂'} |
| 光通信 | ${guidance.optical} | ${riskScores.overallLevel === 'extreme' ? '暂时回避' : '小仓位参与，等待加速信号'} |
| 金银 | ${guidance.gold} | ${macroMap.get('DXY')?.changePct && macroMap.get('DXY')!.changePct! > 0 ? '美元偏强，控制金银仓位' : '配置对冲尾部风险'} |

### 核心标的活动作建议
${[...indicators.entries()]
  .filter(([sym]) => ['NVDA', 'AVGO', 'AMD', 'MSFT', 'AAPL', 'GOOGL', 'META', 'AMZN', 'TSLA', 'GLD', 'SLV', 'MRVL', 'ANET', 'CIEN'].includes(sym))
  .map(([sym, ind]) => {
    const action = stockAction(ind);
    return `| ${sym} | ${ind.close.toFixed(2)} | ${pct(ind.changePct)} | ${ind.trend3dLabel} | ${ind.belowMa20 ? '⚠️ 破20日线' : '✅'} | ${ind.belowMa50 ? '⚠️ 破50日线' : '✅'} | ${action} |`;
  })
  .join('\n')}

操作建议说明：以上建议基于${reportDate}收盘数据生成。所有分析结论中，技术位判断为事实，趋势判断为推断，仓位和买卖建议为操作建议。投资有风险，入市需谨慎。

## 四、财报与重大事件

${earnings.available ? '（财报日历已从 Finnhub 获取，详见下方财报日历表）' : '⚠️ 财报数据缺失。请配置 FINNHUB_API_KEY 环境变量以获取财报日历数据。也可以手动将财报日历导入到 earnings_calendar.csv 文件中。'}

## 五、新闻

${newsAvailable ? '（新闻数据已获取，详见下方新闻列表）' : '⚠️ 新闻数据缺失。请配置 FINNHUB_API_KEY 环境变量以获取公司新闻数据。'}

## 六、机会观察

${generateOpportunities(indicators, riskScores, sectorData)}

---
数据来源：新浪财经（行情）、东方财富（K线历史数据）| 生成时间：${now}
风险评分引擎：规则打分 v1.0 | AI修正：未启用
⚠️ 本报告仅供研究参考，不构成投资建议。投资有风险，入市需谨慎。`;

  // Track data quality
  if (!earnings.available) dataQuality.push('财报日历数据缺失');
  if (!newsAvailable) dataQuality.push('新闻数据缺失');
  for (const m of macroData) {
    if (!m.available) dataQuality.push(`${m.name}数据缺失`);
  }

  return {
    reportDate,
    title: `美股盘后复盘日报 — ${reportDate}`,
    sections: [
      { title: '今日市场发生了什么', content: indexLines.join('\n') },
      { title: '风险评分', content: riskScores.dimensions.map(d => `${d.dimensionZh}: ${d.finalScore}/100 ${d.riskLevelZh}`).join('\n') },
      { title: '操作建议', content: `总仓位: ${guidance.range}` },
      { title: '财报与重大事件', content: earnings.available ? '已获取' : '数据缺失' },
      { title: '新闻', content: newsAvailable ? '已获取' : '数据缺失' },
      { title: '机会观察', content: '见下方详细分析' },
    ],
    reportText,
    marketSummary: `三大指数${riskScores.overallLevel === 'low' ? '走强' : riskScores.overallLevel === 'high' ? '走弱' : '震荡'}，上涨比率${breadthData.advanceRatio.toFixed(0)}%`,
    riskSummary: `综合风险${riskScores.overallScore}/100（${overallRiskLabel}）`,
    actionSummary: `美股总仓位建议：${guidance.range}`,
    opportunitySummary: generateOpportunitiesText(indicators, riskScores),
    dataQualityNotes: dataQuality,
  };
}

function generateOpportunities(
  indicators: Map<string, IndicatorResult>,
  riskScores: RiskSummary,
  _sectorData: Array<{ nameZh: string; avgChangePercent: number }>
): string {
  const lines: string[] = [];

  // Find strengthening themes
  const strongStocks = [...indicators.entries()]
    .filter(([, ind]) => ind.trend3d === 'up3' && !ind.belowMa20 && ind.changePct > 0)
    .map(([sym]) => sym);

  const weakStocks = [...indicators.entries()]
    .filter(([, ind]) => ind.trend3d === 'down3' || (ind.belowMa50 && ind.changePct < -1))
    .map(([sym]) => sym);

  if (strongStocks.length > 5) {
    lines.push(`· 走强标的增多（${strongStocks.length}只站上短期均线且连续走强），市场短期动能改善`);
    lines.push(`· 关注：${strongStocks.slice(0, 5).join('、')}`);
  } else if (strongStocks.length > 0) {
    lines.push(`· 个别标的走强：${strongStocks.join('、')}`);
  }

  if (weakStocks.length > 3) {
    lines.push(`· ${weakStocks.length}只标的走弱或跌破关键均线，需回避：${weakStocks.slice(0, 5).join('、')}`);
  }

  if (riskScores.overallLevel === 'extreme') {
    lines.push('· 市场风险极高，建议优先保护利润、控制仓位，不做新开仓');
    lines.push('· 关注避险资产（金银），等待风险释放后再考虑加仓');
  } else if (riskScores.overallLevel === 'high') {
    lines.push('· 风险偏高，只给条件单，不轻易追涨。关注回踩20日线时的低吸机会');
  } else if (riskScores.overallLevel === 'medium') {
    lines.push('· 风险中性，可关注突破后回踩确认的标的。分批建仓，控制单次仓位');
  } else {
    lines.push('· 风险偏低，允许回踩买入和突破跟随策略。关注放量突破20日高点的标的');
  }

  return lines.join('\n');
}

function generateOpportunitiesText(
  indicators: Map<string, IndicatorResult>,
  riskScores: RiskSummary
): string {
  const strongCount = [...indicators.values()].filter(ind => ind.trend3d === 'up3' && !ind.belowMa20).length;
  const weakCount = [...indicators.values()].filter(ind => ind.trend3d === 'down3').length;
  return `${strongCount}只走强 / ${weakCount}只走弱，整体风险${riskScores.overallLevelZh}`;
}
