import { Router } from 'express';
import { reactivateUser, suspendUser } from '../controllers/adminUser.js';
import { authMiddleware, requireRole } from '../middlewares/auth.js';

const router = Router();

router.use(authMiddleware);
router.post('/users/:userId/suspend', requireRole('ADMIN', 'SUPER_ADMIN'), suspendUser);
router.post('/users/:userId/reactivate', requireRole('ADMIN', 'SUPER_ADMIN'), reactivateUser);

export default router;
