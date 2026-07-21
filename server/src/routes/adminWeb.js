import { Router } from 'express';
import {
  createAdminUser,
  getAdminUser,
  listAdminUsers,
  updateAdminUser,
} from '../controllers/adminUserManagement.js';
import { reactivateUser, suspendUser } from '../controllers/adminUser.js';
import {
  createAdminRestaurantMenuItem,
  deleteAdminRestaurants,
  deleteAdminRestaurantImage,
  getAdminRestaurant,
  listAdminRestaurantMenu,
  listAdminRestaurants,
  replaceAdminRestaurantImage,
  updateAdminRestaurant,
  updateAdminRestaurantImage,
  updateAdminRestaurantMenuItem,
  uploadAdminRestaurantImage,
} from '../controllers/adminRestaurantManagement.js';
import { requireAdminBff, requireAdminWebSession } from '../middlewares/bffAuth.js';
import { uploadSingleRestaurantImage } from '../middlewares/multipart.js';

const router = Router();

router.use(requireAdminBff, requireAdminWebSession);
router.get('/users', listAdminUsers);
router.post('/users', createAdminUser);
router.get('/users/:userId', getAdminUser);
router.patch('/users/:userId', updateAdminUser);
router.post('/users/:userId/suspend', suspendUser);
router.post('/users/:userId/reactivate', reactivateUser);
router.get('/restaurants', listAdminRestaurants);
router.post('/restaurants/bulk-delete', deleteAdminRestaurants);
router.get('/restaurants/:restaurantId', getAdminRestaurant);
router.patch('/restaurants/:restaurantId', updateAdminRestaurant);
router.get('/restaurants/:restaurantId/menu', listAdminRestaurantMenu);
router.post('/restaurants/:restaurantId/menu', createAdminRestaurantMenuItem);
router.patch(
  '/restaurants/:restaurantId/menu/:menuItemId',
  updateAdminRestaurantMenuItem,
);
router.post(
  '/restaurants/:restaurantId/images',
  uploadSingleRestaurantImage,
  uploadAdminRestaurantImage,
);
router.patch(
  '/restaurants/:restaurantId/images/:imageId',
  updateAdminRestaurantImage,
);
router.post(
  '/restaurants/:restaurantId/images/:imageId/replace',
  uploadSingleRestaurantImage,
  replaceAdminRestaurantImage,
);
router.delete(
  '/restaurants/:restaurantId/images/:imageId',
  deleteAdminRestaurantImage,
);

export default router;
