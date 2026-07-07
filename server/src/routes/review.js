import { Router } from 'express';
import { createReviewHandler } from '../controllers/review.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

router.post('/', authMiddleware, createReviewHandler);

export default router;
