import multer from 'multer';
import { createHttpError } from '../utils/httpErrors.js';

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const MERCHANT_CLAIM_MAX_BYTES = 10 * 1024 * 1024;
const RESTAURANT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    fields: 2,
    fieldSize: 1024,
    parts: 4,
  },
});

export const merchantClaimUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MERCHANT_CLAIM_MAX_BYTES,
    files: 1,
    fields: 2,
    fieldSize: 1024,
    parts: 4,
  },
});

export function validateRestaurantImageUploadMetadata(req, res, next) {
  if (!UUID_RE.test(req.params.restaurantId ?? '')) {
    next(createHttpError(400, 'VALIDATION_ERROR', 'restaurantId must be a valid UUID.'));
    return;
  }

  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    next(createHttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.'));
    return;
  }
  if (typeof idempotencyKey !== 'string' || !UUID_V4_RE.test(idempotencyKey)) {
    next(createHttpError(400, 'IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key must be a UUID v4.'));
    return;
  }

  next();
}

export function validateMerchantClaimUploadMetadata(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    next(createHttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.'));
    return;
  }
  if (typeof idempotencyKey !== 'string' || !UUID_V4_RE.test(idempotencyKey)) {
    next(createHttpError(400, 'IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key must be a UUID v4.'));
    return;
  }
  next();
}

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

export function uploadSingleMerchantClaimEvidence(req, res, next) {
  merchantClaimUpload.single('evidenceFile')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(createHttpError(413, 'FILE_TOO_LARGE', 'Merchant claim evidence must be 10MB or smaller.'));
      return;
    }

    if (err instanceof multer.MulterError) {
      next(createHttpError(400, 'VALIDATION_ERROR', err.message));
      return;
    }

    next(err);
  });
}
