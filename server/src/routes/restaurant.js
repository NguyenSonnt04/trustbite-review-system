/**
 * restaurant.js — Routes
 * Mounts restaurant CRUD endpoints under /api/v1/restaurants.
 *
 * GET    /api/v1/restaurants                          → list (public; defaults to ACTIVE)
 * GET    /api/v1/restaurants/nearby                   → map-bounds lookup (public; ACTIVE only)
 * POST   /api/v1/restaurants                          → create
 * GET    /api/v1/restaurants/:restaurantId            → get by ID with ratingBreakdown + ownerClaimStatus
 * GET    /api/v1/restaurants/:restaurantId/reviews    → list verified/reference reviews (public)
 * GET    /api/v1/restaurants/:restaurantId/images     → list managed images
 * POST   /api/v1/restaurants/:restaurantId/images     → upload managed image
 * DELETE /api/v1/restaurants/:restaurantId/images/:imageId → delete managed image
 * PATCH  /api/v1/restaurants/:restaurantId            → update
 * DELETE /api/v1/restaurants/:restaurantId            → soft-delete (sets is_deleted = true)
 */

import { Router } from 'express';
import {
  listRestaurantsHandler,
  listNearbyRestaurantsHandler,
  createRestaurantHandler,
  getRestaurantHandler,
  listRestaurantMenuHandler,
  listRestaurantImagesHandler,
  listRestaurantReviewsHandler,
  deleteRestaurantImageHandler,
  uploadRestaurantImageHandler,
  updateRestaurantHandler,
  deleteRestaurantHandler,
} from '../controllers/restaurant.js';
import { authMiddleware } from '../middlewares/auth.js';
import {
  uploadSingleRestaurantImage,
  validateRestaurantImageUploadMetadata,
} from '../middlewares/multipart.js';

const router = Router();

// Public endpoints — no auth required
router.get('/', listRestaurantsHandler);
router.get('/nearby', listNearbyRestaurantsHandler);
router.get('/:restaurantId/menu', listRestaurantMenuHandler);
router.get('/:restaurantId/reviews', listRestaurantReviewsHandler);
router.get('/:restaurantId/images', authMiddleware, listRestaurantImagesHandler);
router.get('/:restaurantId', getRestaurantHandler);

// Mutating endpoints — require authentication
router.post('/', authMiddleware, createRestaurantHandler);
router.post(
  '/:restaurantId/images',
  authMiddleware,
  validateRestaurantImageUploadMetadata,
  uploadSingleRestaurantImage,
  uploadRestaurantImageHandler,
);
router.delete(
  '/:restaurantId/images/:imageId',
  authMiddleware,
  validateRestaurantImageUploadMetadata,
  deleteRestaurantImageHandler,
);
router.patch('/:restaurantId', authMiddleware, updateRestaurantHandler);
router.delete('/:restaurantId', authMiddleware, deleteRestaurantHandler);

export default router;
