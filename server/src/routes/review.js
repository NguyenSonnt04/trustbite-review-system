import { Router } from 'express';
import { createReviewHandler, getReviewStatusHandler } from '../controllers/review.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

router.post('/', authMiddleware, createReviewHandler);
router.get('/:reviewId/status', authMiddleware, getReviewStatusHandler);

export default router;
