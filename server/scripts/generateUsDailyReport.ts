/**
 * CLI script to generate US market daily report.
 * Usage: npx tsx scripts/generateUsDailyReport.ts [--date YYYY-MM-DD]
 *
 * Runs the same pipeline as the POST /api/review/generate endpoint.
 * Designed to be called by cron jobs after US market close (e.g., 16:30 EST daily).
 */

import { initSchema } from '../src/db/schema.js';
import { marketReviewService } from '../src/services/marketReview.js';
import { computeIndicators } from '../src/services/usIndicators.js';
import { computeRiskScores } from '../src/services/usRiskScoring.js';
import { buildDailyReport } from '../src/services/usDailyReportBuilder.js';
import { fetchMacroData } from '../src/services/macroData.js';
import { getEarningsCalendar } from '../src/services/earningsData.js';
import { stockDataService } from '../src/services/stockData.js';
import {
  upsertMarketData,
  saveRiskScores,
  upsertDailyReport,
  clearEarningsForDate,
  insertEarnings,
} from '../src/db/repository.js';
import { US_STOCK_POOL } from '../src/config.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI args
const args = process.argv.slice(2);
let reportDate = new Date().toISOString().split('T')[0]; // today by default

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date' && args[i + 1]) {
    reportDate = args[i + 1];
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`Usage: npx tsx scripts/generateUsDailyReport.ts [--date YYYY-MM-DD]

Options:
  --date YYYY-MM-DD   Report date (default: today)
  --help, -h          Show this help`);
    process.exit(0);
  }
}

async function main() {
  console.log(`\n📊 StockScope — US Market Daily Report Generator`);
  console.log(`   Date: ${reportDate}`);
  console.log(`   Started: ${new Date().toISOString()}\n`);

  // Init DB
  initSchema();
  console.log('[1/8] Database initialized');

  // Load watchlist
  let watchlistConfig: any = null;
  try {
    const configPath = path.resolve(__dirname, '../../config/us_watchlist.json');
    watchlistConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    console.warn('[!] Watchlist config not found, using defaults');
  }

  // Step 1: Market review
  console.log('[2/8] Fetching market review...');
  const review = await marketReviewService.generateReview();

  // Step 2: Indicators
  console.log('[3/8] Computing technical indicators...');
  const indicatorMap = new Map<string, any>();
  const allSymbols = [...US_STOCK_POOL];
  if (watchlistConfig) {
    for (const theme of Object.values(watchlistConfig.themes) as any[]) {
      for (const s of [...(theme.stocks || []), ...(theme.etfs || [])]) {
        if (!allSymbols.includes(s)) allSymbols.push(s);
      }
    }
  }

  const quotes = await stockDataService.getQuotes(allSymbols);
  for (const q of quotes) {
    try {
      const ind = await computeIndicators(q.symbol, undefined, {
        close: q.regularMarketPrice,
        prevClose: q.regularMarketPreviousClose,
        changePct: q.regularMarketChangePercent,
        volume: q.regularMarketVolume,
      });
      if (ind) indicatorMap.set(q.symbol, ind);
    } catch {
      // skip
    }
  }
  console.log(`   → ${indicatorMap.size} symbols analyzed`);

  // Step 3: Macro
  console.log('[4/8] Fetching macro data...');
  const macroData = await fetchMacroData();
  const macroMap = new Map(macroData.map(m => [m.symbol, m]));
  const availableMacro = macroData.filter(m => m.available).length;
  console.log(`   → ${availableMacro}/${macroData.length} macro indicators available`);

  // Step 4: Risk scores
  console.log('[5/8] Computing risk scores...');
  const indexChanges = new Map<string, number>();
  for (const idx of review.indices) {
    indexChanges.set(idx.symbol, idx.changePercent);
  }
  const riskScores = computeRiskScores(indicatorMap, macroMap, indexChanges, reportDate);
  console.log(`   → Overall risk: ${riskScores.overallScore}/100 (${riskScores.overallLevelZh})`);

  // Step 5: Earnings
  console.log('[6/8] Fetching earnings calendar...');
  const toDate = new Date(new Date(reportDate).getTime() + 30 * 86400000).toISOString().split('T')[0];
  const earnings = await getEarningsCalendar(allSymbols, reportDate, toDate);
  console.log(`   → ${earnings.available ? `${earnings.events.length} events found` : 'Not available'}`);

  // Step 6: Build report
  console.log('[7/8] Building daily report...');
  const dailyReport = await buildDailyReport(
    reportDate, indicatorMap, riskScores, macroData, earnings,
    review.indices.map(i => ({ name: i.name, symbol: i.symbol, changePct: i.changePercent, price: i.price })),
    review.breadth,
    review.sectors.map(s => ({ nameZh: s.nameZh, avgChangePercent: s.avgChangePercent })),
    review.topGainers, review.topLosers,
    false,
  );
  console.log(`   → Report: ${dailyReport.reportText.length} chars`);

  // Step 7: Persist to DB
  console.log('[8/8] Saving to database...');
  const marketRows = [];
  for (const [symbol, ind] of indicatorMap.entries()) {
    marketRows.push({
      trade_date: reportDate, symbol, name: '', theme: '', asset_type: 'stock',
      close: ind.close, prev_close: ind.prevClose, change_pct: ind.changePct, volume: ind.volume,
      ma20: ind.ma20, ma50: ind.ma50, ma200: ind.ma200,
      high_20d: ind.high20d, low_20d: ind.low20d,
      below_ma20: ind.belowMa20 ? 1 : 0, below_ma50: ind.belowMa50 ? 1 : 0, below_ma200: ind.belowMa200 ? 1 : 0,
      volume_vs_avg: ind.volumeVsAvg, trend_3d: ind.trend3d,
      source: ind.source, data_time: ind.dataTime,
    });
  }
  upsertMarketData(marketRows);

  saveRiskScores(riskScores.dimensions.map(d => ({
    report_date: reportDate, risk_dimension: d.dimension,
    rule_score: d.ruleScore, ai_adjustment: d.aiAdjustment, final_score: d.finalScore,
    risk_level: d.riskLevel, reasons: d.reasons.join('；'),
    source: riskScores.source, data_time: riskScores.dataTime,
  })));

  if (earnings.available && earnings.events.length > 0) {
    clearEarningsForDate(reportDate);
    insertEarnings(earnings.events.map(e => ({
      report_date: reportDate, symbol: e.symbol, company_name: e.companyName,
      earnings_date: e.earningsDate, earnings_time: e.earningsTime,
      importance_level: e.importanceLevel, expected_eps: e.expectedEps,
      expected_revenue: e.expectedRevenue, source: e.source, data_time: e.dataTime,
    })));
  }

  upsertDailyReport({
    report_date: reportDate, title: dailyReport.title,
    report_text: dailyReport.reportText,
    market_summary: dailyReport.marketSummary,
    risk_summary: dailyReport.riskSummary,
    action_summary: dailyReport.actionSummary,
    opportunity_summary: dailyReport.opportunitySummary,
    data_quality_notes: dailyReport.dataQualityNotes.join('\n'),
  });

  console.log(`\n✅ Daily report generated successfully!`);
  console.log(`   Date: ${reportDate}`);
  console.log(`   Risk: ${riskScores.overallScore}/100 (${riskScores.overallLevelZh})`);
  console.log(`   Symbols: ${indicatorMap.size}`);
  console.log(`   Data missing: ${dailyReport.dataQualityNotes.join(', ') || 'None'}`);
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Report generation failed:', err.message);
  process.exit(1);
});
