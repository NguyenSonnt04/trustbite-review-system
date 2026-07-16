import { Router } from 'express';
import { getAdminSession, reactivateUser, suspendUser } from '../controllers/adminUser.js';
import {
  decideRestaurantClaimHandler,
  listAdminRestaurantsHandler,
  listAdminRestaurantClaimsHandler,
} from '../controllers/restaurantClaim.js';
import { authMiddleware, requireRole } from '../middlewares/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/session', requireRole('ADMIN', 'SUPER_ADMIN'), getAdminSession);
router.post('/users/:userId/suspend', requireRole('ADMIN', 'SUPER_ADMIN'), suspendUser);
router.post('/users/:userId/reactivate', requireRole('ADMIN', 'SUPER_ADMIN'), reactivateUser);
router.get(
  '/restaurants',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  listAdminRestaurantsHandler,
);
router.get(
  '/restaurant-claims',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  listAdminRestaurantClaimsHandler,
);
router.post(
  '/restaurant-claims/:claimId/decision',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  decideRestaurantClaimHandler,
);

export default router;
