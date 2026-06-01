import { Router } from 'express';
import { stockDataService } from '../services/stockData.js';
import { stockScreener } from '../services/screener.js';
import { newsAnalysisService } from '../services/newsAnalysis.js';
import { getStockPool } from '../config.js';

const router = Router();

// GET /api/stocks/hot — Get hot stock recommendations
// Query params: market=cn|us|hk|all, topN=20
router.get('/hot', async (req, res) => {
  try {
    const market = (req.query.market as 'cn' | 'us' | 'hk' | 'all') || 'all';
    const topN = parseInt(req.query.topN as string) || 20;

    // For multi-market screening, we need news for all stocks
    const pool = getStockPool(market);

    // Try to get news (non-blocking — if fails, screen without news)
    let newsMap: Map<string, any[]> | undefined;
    try {
      newsMap = await newsAnalysisService.getNewsForSymbols(pool);
    } catch (err) {
      console.warn('News fetch failed, screening without news data');
    }

    const results = await stockScreener.screenMarket(market, topN, newsMap);

    res.json({
      success: true,
      data: {
        stocks: results,
        total: results.length,
        market,
        updatedAt: Date.now(),
      },
    });
  } catch (err: any) {
    console.error('Hot stocks error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stocks/:symbol — Get detailed stock info + scoring
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    // Fetch quote and historical data in parallel
    const [quote, historical, news, scored] = await Promise.all([
      stockDataService.getQuote(symbol),
      stockDataService.getHistorical(symbol, '1d', '3mo'),
      newsAnalysisService.getNewsForSymbol(symbol),
      stockScreener.screenSingle(symbol),
    ]);

    if (!quote) {
      res.status(404).json({ success: false, error: `Stock ${symbol} not found` });
      return;
    }

    res.json({
      success: true,
      data: {
        quote,
        historical,
        news,
        scoring: scored,
      },
    });
  } catch (err: any) {
    console.error(`Stock detail error for ${req.params.symbol}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stocks/:symbol/history — Get historical price data
router.get('/:symbol/history', async (req, res) => {
  try {
    const { symbol } = req.params;
    const interval = (req.query.interval as string) || '1d';
    const period = (req.query.period as string) || '3mo';

    const data = await stockDataService.getHistorical(
      symbol,
      interval as '1d' | '1wk' | '1mo',
      period as '1mo' | '3mo' | '6mo' | '1y' | '5y'
    );

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
