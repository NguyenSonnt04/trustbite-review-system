/**
 * routes/index.js — Central router
 * Registers all sub-routers under the /api/v1 namespace.
 */

import { Router } from 'express';
import restaurantRoutes from './restaurant.js';

const router = Router();

// Restaurant CRUD — Task 3.1 (PHASE 3 — Restaurant & Search)
router.use('/restaurants', restaurantRoutes);

export default router;