import { Router } from 'express';
import {
  listMerchantClaimsHandler,
  listMerchantRestaurantsHandler,
  submitRestaurantClaimHandler,
} from '../controllers/restaurantClaim.js';
import { authMiddleware } from '../middlewares/auth.js';
import {
  uploadSingleMerchantClaimEvidence,
  validateMerchantClaimUploadMetadata,
} from '../middlewares/multipart.js';

const router = Router();

router.get('/restaurants', authMiddleware, listMerchantRestaurantsHandler);
router.get('/restaurant-claims', authMiddleware, listMerchantClaimsHandler);
router.post(
  '/restaurant-claims',
  authMiddleware,
  validateMerchantClaimUploadMetadata,
  uploadSingleMerchantClaimEvidence,
  submitRestaurantClaimHandler,
);

export default router;
