import { Router } from 'express';
import adminRoutes from './admin.js';
import authRoutes from './auth.js';
import awsRoutes from './aws.js';
import restaurantRoutes from './restaurant.js';
import reviewRoutes from './review.js';
import userRoutes from './user.js';

const router = Router();

router.use('/admin', adminRoutes);
router.use('/auth', authRoutes);
router.use('/aws', awsRoutes);
router.use('/restaurants', restaurantRoutes);
router.use('/reviews', reviewRoutes);
router.use('/users', userRoutes);

export default router;
