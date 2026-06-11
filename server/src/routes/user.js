import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import {
  cancelDeletionRequest,
  createDeletionRequest,
  getDeletionRequest,
  getMe,
  updateMe
} from '../controllers/user.js';

const router = Router();

router.use(authMiddleware);
router.get('/me', getMe);
router.patch('/me', updateMe);
router.post('/me/deletion-request', createDeletionRequest);
router.get('/me/deletion-request', getDeletionRequest);
router.post('/me/deletion-request/cancel', cancelDeletionRequest);

export default router;
