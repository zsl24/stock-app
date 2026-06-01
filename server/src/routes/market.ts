import { Router } from 'express';
import { stockDataService } from '../services/stockData.js';
import { stockScreener } from '../services/screener.js';
import { newsAnalysisService } from '../services/newsAnalysis.js';

const router = Router();

// GET /api/market — Market overview (indices)
router.get('/', async (_req, res) => {
  try {
    const overview = await stockDataService.getMarketOverview();
    res.json({ success: true, data: overview });
  } catch (err: any) {
    console.error('Market overview error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/market/news — Market-level news
router.get('/news', async (_req, res) => {
  try {
    const news = await newsAnalysisService.getMarketNews();
    res.json({ success: true, data: news });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
