import { Router } from 'express';
import { marketReviewService } from '../services/marketReview.js';

const router = Router();

// GET /api/review/us — US market post-market review
router.get('/us', async (_req, res) => {
  try {
    const review = await marketReviewService.generateReview();
    res.json({ success: true, data: review });
  } catch (err: any) {
    console.error('Market review error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
