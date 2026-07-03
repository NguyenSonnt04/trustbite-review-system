import { Router } from 'express';
import { uploadReceiptHandler } from '../controllers/receipt.js';
import { authMiddleware } from '../middlewares/auth.js';
import { uploadSingleReceiptImage } from '../middlewares/multipart.js';

const router = Router();

router.post('/', authMiddleware, uploadSingleReceiptImage, uploadReceiptHandler);

export default router;
