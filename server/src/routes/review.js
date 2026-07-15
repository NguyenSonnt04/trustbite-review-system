import { Router } from 'express';
import {
  createReviewHandler,
  getReviewStatusHandler,
  skipReviewVerificationHandler,
} from '../controllers/review.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

router.post('/', authMiddleware, createReviewHandler);
router.post('/:reviewId/skip-verification', authMiddleware, skipReviewVerificationHandler);
router.get('/:reviewId/status', authMiddleware, getReviewStatusHandler);

export default router;
