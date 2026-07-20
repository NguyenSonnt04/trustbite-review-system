import { Router } from 'express';
import {
  createBillScanHandler,
  getBillScanHandler,
} from '../controllers/billScan.js';
import { authMiddleware } from '../middlewares/auth.js';
import {
  uploadSingleBillScanImage,
  validateBillScanUploadMetadata,
} from '../middlewares/multipart.js';

const router = Router();

router.post(
  '/',
  authMiddleware,
  validateBillScanUploadMetadata,
  uploadSingleBillScanImage,
  createBillScanHandler,
);
router.get('/:scanId', authMiddleware, getBillScanHandler);

export default router;
