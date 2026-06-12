import { Router } from 'express';
import { sendOtp, verifyOtp } from '../controllers/auth.js';

const router = Router();

router.post('/otp/request', sendOtp);
router.post('/otp/verify', verifyOtp);

export default router;
