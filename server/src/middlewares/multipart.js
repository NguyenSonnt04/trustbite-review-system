import multer from 'multer';
import { createHttpError } from '../utils/httpErrors.js';

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const RESTAURANT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: RECEIPT_MAX_BYTES,
    files: 1,
  },
});

export const restaurantImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: RESTAURANT_IMAGE_MAX_BYTES,
    files: 1,
    fields: 3,
    fieldSize: 2048,
    parts: 5,
  },
});

export function uploadSingleReceiptImage(req, res, next) {
  receiptUpload.single('receiptImage')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(createHttpError(413, 'FILE_TOO_LARGE', 'Receipt image must be 10MB or smaller.'));
      return;
    }

    if (err instanceof multer.MulterError) {
      next(createHttpError(400, 'VALIDATION_ERROR', err.message));
      return;
    }

    next(err);
  });
}

export function uploadSingleRestaurantImage(req, res, next) {
  restaurantImageUpload.single('restaurantImage')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(createHttpError(413, 'FILE_TOO_LARGE', 'Restaurant image must be 5MB or smaller.'));
      return;
    }

    if (err instanceof multer.MulterError) {
      next(createHttpError(400, 'VALIDATION_ERROR', err.message));
      return;
    }

    next(err);
  });
}
