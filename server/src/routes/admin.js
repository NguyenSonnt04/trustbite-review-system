import { Router } from 'express';
import { getAdminSession, reactivateUser, suspendUser } from '../controllers/adminUser.js';
import { authMiddleware, requireRole } from '../middlewares/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/session', requireRole('ADMIN', 'SUPER_ADMIN'), getAdminSession);
router.post('/users/:userId/suspend', requireRole('ADMIN', 'SUPER_ADMIN'), suspendUser);
router.post('/users/:userId/reactivate', requireRole('ADMIN', 'SUPER_ADMIN'), reactivateUser);

export default router;
