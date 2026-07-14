import { Router } from 'express';
import {
  createAdminWebSession,
  createLocalDevelopmentUser,
  deleteAdminWebSession,
  getAdminWebSession,
  sendOtp,
  verifyOtp,
} from '../controllers/auth.js';
import { requireAdminBff } from '../middlewares/bffAuth.js';

const router = Router();

router.post('/otp/request', sendOtp);
router.post('/otp/verify', verifyOtp);
router.post('/dev/local-signup', createLocalDevelopmentUser);
router.post('/admin/web-session', requireAdminBff, createAdminWebSession);
router.get('/admin/web-session', requireAdminBff, getAdminWebSession);
router.delete('/admin/web-session', requireAdminBff, deleteAdminWebSession);

export default router;
