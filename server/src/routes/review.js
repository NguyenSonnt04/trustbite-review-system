import { Router } from 'express';
import {
  createReviewHandler,
  deleteReviewReactionHandler,
  getReviewStatusHandler,
  setReviewReactionHandler,
  skipReviewVerificationHandler,
} from '../controllers/review.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

router.post('/', authMiddleware, createReviewHandler);
router.post('/:reviewId/skip-verification', authMiddleware, skipReviewVerificationHandler);
router.get('/:reviewId/status', authMiddleware, getReviewStatusHandler);
router.put('/:reviewId/reaction', authMiddleware, setReviewReactionHandler);
router.delete('/:reviewId/reaction', authMiddleware, deleteReviewReactionHandler);

export default router;
