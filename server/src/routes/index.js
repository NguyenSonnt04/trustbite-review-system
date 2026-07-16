/**
 * routes/index.js — Central router
 * Registers all sub-routers under the /api/v1 namespace.
 */

import { Router } from 'express';
import adminRoutes from './admin.js';
import adminWebRoutes from './adminWeb.js';
import authRoutes from './auth.js';
import awsRoutes from './aws.js';
import moderationRoutes from './moderation.js';
import merchantRoutes from './merchant.js';
import receiptRoutes from './receipt.js';
import restaurantRoutes from './restaurant.js';
import reviewRoutes from './review.js';
import userRoutes from './user.js';

const router = Router();

router.use('/admin', adminRoutes);
router.use('/admin-web', adminWebRoutes);
router.use('/auth', authRoutes);
router.use('/aws', awsRoutes);
router.use('/merchant', merchantRoutes);
// Restaurant CRUD — Task 3.1 (PHASE 3 — Restaurant & Search)
router.use('/restaurants', restaurantRoutes);
router.use('/receipts', receiptRoutes);
router.use('/reviews', reviewRoutes);
router.use('/users', userRoutes);
// Moderation reports — Task 6.1 (PHASE 6 — Moderation & Compliance)
router.use('/moderation', moderationRoutes);

export default router;
