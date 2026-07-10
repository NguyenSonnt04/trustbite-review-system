import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import {
  cancelDeletionRequest,
  createAvatarUploadUrl,
  createDeletionRequest,
  getDeletionRequest,
  getMe,
  getMyGamification,
  updateMe
} from '../controllers/user.js';
import { blockUserById, unblockUserById } from '../controllers/userBlock.js';

const router = Router();

router.use(authMiddleware);
router.get('/me', getMe);
router.patch('/me', updateMe);
router.get('/me/gamification', getMyGamification);
router.post('/me/avatar-upload-url', createAvatarUploadUrl);
router.post('/me/deletion-request', createDeletionRequest);
router.get('/me/deletion-request', getDeletionRequest);
router.post('/me/deletion-request/cancel', cancelDeletionRequest);

// UGC safety block — task 6.2 (PHASE 6 — Moderation & Compliance), SAFETY-001 / BR-SAFE-003
router.post('/:userId/block', blockUserById);
router.delete('/:userId/block', unblockUserById);

export default router;
