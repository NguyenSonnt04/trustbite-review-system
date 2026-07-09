import { Router } from 'express';
import { createLocalDevelopmentUser, sendOtp, verifyOtp } from '../controllers/auth.js';

const router = Router();

router.post('/otp/request', sendOtp);
router.post('/otp/verify', verifyOtp);
router.post('/dev/local-signup', createLocalDevelopmentUser);

export default router;
