import { Router } from 'express';
import { marketReviewService } from '../services/marketReview.js';
import { computeIndicators } from '../services/usIndicators.js';
import { computeRiskScores } from '../services/usRiskScoring.js';
import { buildDailyReport } from '../services/usDailyReportBuilder.js';
import { fetchMacroData } from '../services/macroData.js';
import { getEarningsCalendar } from '../services/earningsData.js';
import {
  upsertMarketData,
  saveRiskScores,
  upsertDailyReport,
  getDailyReportByDate,
  getLatestDailyReport,
  getMarketDataByDate,
  getRiskScoresByDate,
  clearEarningsForDate,
  insertEarnings,
  clearNewsForDate,
} from '../db/repository.js';
import { US_STOCK_POOL } from '../config.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load watchlist config
let watchlistConfig: any = null;
try {
  const configPath = path.resolve(__dirname, '../../config/us_watchlist.json');
  watchlistConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  console.log('[Review] Watchlist config loaded');
} catch (err: any) {
  console.warn(`[Review] Watchlist config not found at ${path.resolve(__dirname, '../../config/us_watchlist.json')}: ${err.message}`);
}

const router = Router();

// GET /api/review/us — basic market review (existing, kept for backwards compat)
router.get('/us', async (_req, res) => {
  try {
    const review = await marketReviewService.generateReview();
    res.json({ success: true, data: review });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/review/generate — generate full daily report and persist to DB
router.post('/generate', async (req, res) => {
  try {
    const reportDate = (req.body.date as string) || new Date().toISOString().split('T')[0];
    console.log(`[Review] Generating daily report for ${reportDate}...`);

    // Step 1: Fetch market review (indices, breadth, sectors, gainers/losers)
    const review = await marketReviewService.generateReview();

    // Step 2: Compute technical indicators for all US stocks
    // Use quote data from the review to minimize API calls
    console.log('[Review] Computing indicators...');
    const indicatorMap = new Map<string, any>();
    const allSymbols = [...US_STOCK_POOL];

    // Add watchlist symbols
    if (watchlistConfig) {
      for (const theme of Object.values(watchlistConfig.themes) as any[]) {
        for (const s of [...(theme.stocks || []), ...(theme.etfs || [])]) {
          if (!allSymbols.includes(s)) allSymbols.push(s);
        }
      }
    }

    // Fetch quotes first (batch, fast)
    const { stockDataService } = await import('../services/stockData.js');
    const quotes = await stockDataService.getQuotes(allSymbols);
    const quoteMap = new Map<string, any>();
    for (const q of quotes) {
      quoteMap.set(q.symbol, {
        close: q.regularMarketPrice,
        prevClose: q.regularMarketPreviousClose,
        changePct: q.regularMarketChangePercent,
        volume: q.regularMarketVolume,
      });
    }

    // Compute indicators using quote data only (no historical for speed)
    // Key stocks get full historical analysis
    const keyStocks = ['NVDA', 'AVGO', 'AMD', 'MU', 'MSFT', 'AAPL', 'GOOGL', 'META', 'AMZN', 'TSLA', 'GLD', 'SLV'];
    for (const symbol of allSymbols) {
      try {
        const quote = quoteMap.get(symbol);
        if (!quote) continue;

        // Only fetch historical for key stocks to avoid rate limits
        const isKey = keyStocks.includes(symbol);
        const ind = await computeIndicators(symbol, undefined, quote);
        if (ind) indicatorMap.set(symbol, ind);
      } catch {
        // skip failed symbols
      }
    }
    console.log(`[Review] Computed indicators for ${indicatorMap.size} symbols`);

    // Step 3: Fetch macro data
    const macroData = await fetchMacroData();
    const macroMap = new Map(macroData.map(m => [m.symbol, m]));

    // Step 4: Index changes for risk scoring
    const indexChanges = new Map<string, number>();
    for (const idx of review.indices) {
      indexChanges.set(idx.symbol, idx.changePercent);
    }

    // Step 5: Compute risk scores
    const riskScores = computeRiskScores(indicatorMap, macroMap, indexChanges, reportDate);

    // Step 6: Fetch earnings calendar
    const watchlistSymbols = allSymbols;
    const fromDate = reportDate;
    const toDate = new Date(new Date(reportDate).getTime() + 30 * 86400000).toISOString().split('T')[0];
    const earnings = await getEarningsCalendar(watchlistSymbols, fromDate, toDate);

    // Step 7: Build the daily report text
    const dailyReport = await buildDailyReport(
      reportDate,
      indicatorMap,
      riskScores,
      macroData,
      earnings,
      review.indices.map(i => ({
        name: i.name,
        symbol: i.symbol,
        changePct: i.changePercent,
        price: i.price,
      })),
      review.breadth,
      review.sectors.map(s => ({ nameZh: s.nameZh, avgChangePercent: s.avgChangePercent })),
      review.topGainers,
      review.topLosers,
      false, // news not available without API key
    );

    // Step 8: Persist to database
    // 8a. Save market data
    const marketRows = [];
    for (const [symbol, ind] of indicatorMap.entries()) {
      marketRows.push({
        trade_date: reportDate,
        symbol,
        name: '',
        theme: '',
        asset_type: 'stock',
        close: ind.close,
        prev_close: ind.prevClose,
        change_pct: ind.changePct,
        volume: ind.volume,
        ma20: ind.ma20,
        ma50: ind.ma50,
        ma200: ind.ma200,
        high_20d: ind.high20d,
        low_20d: ind.low20d,
        below_ma20: ind.belowMa20 ? 1 : 0,
        below_ma50: ind.belowMa50 ? 1 : 0,
        below_ma200: ind.belowMa200 ? 1 : 0,
        volume_vs_avg: ind.volumeVsAvg,
        trend_3d: ind.trend3d,
        source: ind.source,
        data_time: ind.dataTime,
      });
    }
    upsertMarketData(marketRows);

    // 8b. Save risk scores
    const riskRows = riskScores.dimensions.map(d => ({
      report_date: reportDate,
      risk_dimension: d.dimension,
      rule_score: d.ruleScore,
      ai_adjustment: d.aiAdjustment,
      final_score: d.finalScore,
      risk_level: d.riskLevel,
      reasons: d.reasons.join('；'),
      source: riskScores.source,
      data_time: riskScores.dataTime,
    }));
    saveRiskScores(riskRows);

    // 8c. Save earnings if available
    if (earnings.available && earnings.events.length > 0) {
      clearEarningsForDate(reportDate);
      insertEarnings(earnings.events.map(e => ({
        report_date: reportDate,
        symbol: e.symbol,
        company_name: e.companyName,
        earnings_date: e.earningsDate,
        earnings_time: e.earningsTime,
        importance_level: e.importanceLevel,
        expected_eps: e.expectedEps,
        expected_revenue: e.expectedRevenue,
        source: e.source,
        data_time: e.dataTime,
      })));
    }

    // 8d. Save the daily report
    upsertDailyReport({
      report_date: reportDate,
      title: dailyReport.title,
      report_text: dailyReport.reportText,
      market_summary: dailyReport.marketSummary,
      risk_summary: dailyReport.riskSummary,
      action_summary: dailyReport.actionSummary,
      opportunity_summary: dailyReport.opportunitySummary,
      data_quality_notes: dailyReport.dataQualityNotes.join('\n'),
    });

    console.log(`[Review] Report generated and saved for ${reportDate}`);

    res.json({
      success: true,
      data: {
        reportDate,
        riskScores,
        macroData,
        earnings,
        dailyReport,
        symbolsAnalyzed: indicatorMap.size,
        dataMissing: dailyReport.dataQualityNotes,
      },
    });
  } catch (err: any) {
    console.error('[Review] Generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/review/reports/latest — Get latest daily report
router.get('/reports/latest', async (_req, res) => {
  try {
    const report = getLatestDailyReport();
    const riskScores = report ? getRiskScoresByDate(report.report_date) : [];
    const marketData = report ? getMarketDataByDate(report.report_date) : [];

    res.json({
      success: true,
      data: {
        report,
        riskScores,
        marketData,
        hasData: !!report,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/review/reports/:date — Get report for specific date
router.get('/reports/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const report = getDailyReportByDate(date);
    const riskScores = report ? getRiskScoresByDate(date) : [];
    const marketData = report ? getMarketDataByDate(date) : [];

    res.json({
      success: true,
      data: {
        report,
        riskScores,
        marketData,
        hasData: !!report,
        date,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
