import { Router } from 'express';
import {
  getNotificationSummaryHandler,
  listNotificationsHandler,
  markNotificationReadHandler,
} from '../controllers/notification.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

router.use(authMiddleware);
router.get('/summary', getNotificationSummaryHandler);
router.get('/', listNotificationsHandler);
router.patch('/:notificationId/read', markNotificationReadHandler);

export default router;
