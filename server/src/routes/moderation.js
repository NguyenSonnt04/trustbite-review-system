import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { submitReport } from '../controllers/moderation.js';

const router = Router();

router.use(authMiddleware);

// UGC safety report — task 6.1 (PHASE 6 — Moderation & Compliance), SAFETY-001 / BR-SAFE-002
router.post('/reports', submitReport);

export default router;
