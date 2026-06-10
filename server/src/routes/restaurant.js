/**
 * restaurant.js — Routes
 * Mounts restaurant CRUD endpoints under /api/v1/restaurants.
 *
 * GET    /api/v1/restaurants              → list (public; defaults to ACTIVE)
 * POST   /api/v1/restaurants              → create
 * GET    /api/v1/restaurants/:restaurantId → get by ID
 * PATCH  /api/v1/restaurants/:restaurantId → update
 * DELETE /api/v1/restaurants/:restaurantId → soft-delete (status = CLOSED)
 */

import { Router } from 'express';
import {
  listRestaurantsHandler,
  createRestaurantHandler,
  getRestaurantHandler,
  updateRestaurantHandler,
  deleteRestaurantHandler,
} from '../controllers/restaurant.js';

const router = Router();

// Collection endpoints
router.get('/', listRestaurantsHandler);
router.post('/', createRestaurantHandler);

// Item endpoints
router.get('/:restaurantId', getRestaurantHandler);
router.patch('/:restaurantId', updateRestaurantHandler);
router.delete('/:restaurantId', deleteRestaurantHandler);

export default router;