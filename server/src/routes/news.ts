import { Router } from 'express';
import { newsAnalysisService } from '../services/newsAnalysis.js';

const router = Router();

// GET /api/news/:symbol — Get news for a specific stock
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const news = await newsAnalysisService.getNewsForSymbol(symbol);
    res.json({ success: true, data: news });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
