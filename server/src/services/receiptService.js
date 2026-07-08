import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';
import {
  buildReceiptObjectKey,
  deleteReceiptObject,
  uploadReceiptObject,
} from './s3ReceiptStorageService.js';
import { enqueueReceiptOcr } from './queue/receiptOcrQueue.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const RECEIPT_ENDPOINT = 'POST /api/v1/receipts';
const RECEIPT_IDEMPOTENCY_TTL_HOURS = 24;
const RECEIPT_LOCK_MINUTES = 5;
const RECEIPT_CAPTURE_MAX_AGE_HOURS = 48;
// Keep this aligned with server/migrations/001_init_schema.sql.
const DUPLICATE_RECEIPT_HASH_INDEX = 'idx_receipts_hash_uniq';
const IDEMPOTENCY_UNIQUE_CONSTRAINT = 'idempotency_keys_user_id_endpoint_idempotency_key_key';
const DUPLICATE_RECEIPT_HASH_RISK_SCORE = 80;
const OCR_ENQUEUE_FAILURE_PUBLIC_REASON = 'OCR enqueue failed; pending manual review.';
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif']);

function validationDetail(field, code, message) {
  return { field, code, message };
}

function assertUuid(value, field, details) {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    details.push(validationDetail(field, 'INVALID_UUID', `${field} must be a valid UUID.`));
  }
}

function parseOptionalNumber(value, field, details) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    details.push(validationDetail(field, 'INVALID_NUMBER', `${field} must be a number.`));
    return null;
  }
  return parsed;
}

function parseCapturedAt(value, details) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    details.push(validationDetail('capturedAt', 'INVALID_TYPE', 'capturedAt must be an ISO-8601 datetime string.'));
    return null;
  }
  const date = new Date(value);
  const capturedTime = date.getTime();
  if (Number.isNaN(capturedTime)) {
    details.push(validationDetail('capturedAt', 'INVALID_DATETIME', 'capturedAt must be a valid ISO-8601 datetime.'));
    return null;
  }

  const now = Date.now();
  const maxAgeMs = RECEIPT_CAPTURE_MAX_AGE_HOURS * 60 * 60 * 1000;
  if (capturedTime > now) {
    details.push(validationDetail('capturedAt', 'FUTURE_DATETIME', 'capturedAt must not be in the future.'));
    return null;
  }
  if (now - capturedTime > maxAgeMs) {
    details.push(validationDetail('capturedAt', 'TOO_OLD', `capturedAt must be within ${RECEIPT_CAPTURE_MAX_AGE_HOURS} hours.`));
    return null;
  }

  return date.toISOString();
}

function getFileExtension(filename = '') {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts.at(-1) : '';
}

function hasValidMagicBytes(file) {
  const buffer = file.buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;

  if (file.mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (file.mimetype === 'image/png') {
    return buffer.length >= 8
      && buffer[0] === 0x89
      && buffer[1] === 0x50
      && buffer[2] === 0x4e
      && buffer[3] === 0x47
      && buffer[4] === 0x0d
      && buffer[5] === 0x0a
      && buffer[6] === 0x1a
      && buffer[7] === 0x0a;
  }

  if (file.mimetype === 'image/heic' || file.mimetype === 'image/heif') {
    const header = buffer.subarray(4, 12).toString('ascii');
    return header.startsWith('ftyp') && (header.includes('heic') || header.includes('heif') || header.includes('mif1'));
  }

  return false;
}

function validateFile(file) {
  if (!file) {
    throw createHttpError(400, 'VALIDATION_ERROR', 'receiptImage is required.', [
      validationDetail('receiptImage', 'REQUIRED', 'receiptImage is required.'),
    ]);
  }

  if (file.size > MAX_RECEIPT_BYTES) {
    throw createHttpError(413, 'FILE_TOO_LARGE', 'Receipt image must be 10MB or smaller.');
  }

  const extension = getFileExtension(file.originalname);
  if (!ALLOWED_CONTENT_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(extension) || !hasValidMagicBytes(file)) {
    throw createHttpError(415, 'UNSUPPORTED_FILE_TYPE', 'Receipt image must be JPG, PNG, HEIC, or HEIF.');
  }
}

function validateReceiptFields(fields = {}) {
  const details = [];
  assertUuid(fields.reviewId, 'reviewId', details);
  assertUuid(fields.restaurantId, 'restaurantId', details);

  const latitude = parseOptionalNumber(fields.latitude, 'latitude', details);
  const longitude = parseOptionalNumber(fields.longitude, 'longitude', details);
  const gpsAccuracyMeters = parseOptionalNumber(fields.gpsAccuracyMeters, 'gpsAccuracyMeters', details);
  const capturedAt = parseCapturedAt(fields.capturedAt, details);

  if (latitude !== null && (latitude < -90 || latitude > 90)) {
    details.push(validationDetail('latitude', 'RANGE', 'latitude must be between -90 and 90.'));
  }
  if (longitude !== null && (longitude < -180 || longitude > 180)) {
    details.push(validationDetail('longitude', 'RANGE', 'longitude must be between -180 and 180.'));
  }
  if (gpsAccuracyMeters !== null && gpsAccuracyMeters <= 0) {
    details.push(validationDetail('gpsAccuracyMeters', 'RANGE', 'gpsAccuracyMeters must be positive.'));
  }

  if (details.length > 0) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'Receipt upload payload is invalid.', details);
  }

  return {
    reviewId: fields.reviewId,
    restaurantId: fields.restaurantId,
    latitude,
    longitude,
    gpsAccuracyMeters,
    capturedAt,
  };
}

function validateIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) {
    throw createHttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.');
  }
  if (!UUID_V4_REGEX.test(idempotencyKey)) {
    throw createHttpError(400, 'IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key must be a UUID v4.');
  }
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableRequestHash({ userId, data, fileHash }) {
  return sha256Hex(JSON.stringify({
    userId,
    endpoint: RECEIPT_ENDPOINT,
    reviewId: data.reviewId,
    restaurantId: data.restaurantId,
    latitude: data.latitude,
    longitude: data.longitude,
    gpsAccuracyMeters: data.gpsAccuracyMeters,
    capturedAt: data.capturedAt,
    fileHash,
  }));
}

async function getExistingIdempotency(client, userId, idempotencyKey) {
  const result = await client.query(
    `SELECT *
     FROM idempotency_keys
     WHERE user_id = $1
       AND endpoint = $2
       AND idempotency_key = $3
     FOR UPDATE`,
    [userId, RECEIPT_ENDPOINT, idempotencyKey],
  );

  return result.rows[0] ?? null;
}

async function createIdempotency(client, userId, idempotencyKey, requestHash) {
  await client.query(
    `INSERT INTO idempotency_keys (
       idempotency_key,
       user_id,
       endpoint,
       request_hash,
       status,
       locked_until,
       expires_at
     )
     VALUES ($1, $2, $3, $4, 'IN_PROGRESS', NOW() + ($5 || ' minutes')::interval, NOW() + ($6 || ' hours')::interval)`,
    [idempotencyKey, userId, RECEIPT_ENDPOINT, requestHash, RECEIPT_LOCK_MINUTES, RECEIPT_IDEMPOTENCY_TTL_HOURS],
  );
}

async function markIdempotencyCompleted(client, userId, idempotencyKey, responseBody, resourceId) {
  await client.query(
    `UPDATE idempotency_keys
     SET status = 'COMPLETED',
         response_status_code = 202,
         response_body = $4::jsonb,
         resource_type = 'RECEIPT_VERIFICATION',
         resource_id = $5,
         locked_until = NULL,
         updated_at = NOW()
     WHERE user_id = $1
       AND endpoint = $2
       AND idempotency_key = $3`,
    [userId, RECEIPT_ENDPOINT, idempotencyKey, JSON.stringify(responseBody), resourceId],
  );
}

async function markIdempotencyFailed(client, userId, idempotencyKey) {
  await client.query(
    `UPDATE idempotency_keys
     SET status = 'FAILED',
         locked_until = NULL,
         updated_at = NOW()
     WHERE user_id = $1
       AND endpoint = $2
       AND idempotency_key = $3
       AND status = 'IN_PROGRESS'`,
    [userId, RECEIPT_ENDPOINT, idempotencyKey],
  );
}

async function markReceiptPendingAdminReviewForQueueFailure({
  receiptVerificationId,
  userId,
  idempotencyKey,
  responseBody,
  reason,
}) {
  const degradedBody = {
    ...responseBody,
    status: 'PENDING_ADMIN_REVIEW',
    processingStatus: 'PENDING_ADMIN_REVIEW',
  };
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const loaded = await client.query(
      `SELECT id, review_id, status
       FROM receipt_verifications
       WHERE id = $1
       FOR UPDATE`,
      [receiptVerificationId],
    );

    if (loaded.rowCount === 0) {
      await client.query('COMMIT');
      return responseBody;
    }

    const receipt = loaded.rows[0];
    const updated = await client.query(
      `UPDATE receipt_verifications
       SET status = 'PENDING_ADMIN_REVIEW',
           decision_reason = $2
       WHERE id = $1
         AND status NOT IN ('VERIFIED', 'REJECTED', 'REFERENCE_ONLY', 'PENDING_ADMIN_REVIEW')
       RETURNING id`,
      [receiptVerificationId, reason],
    );

    let finalBody = degradedBody;
    if (updated.rowCount > 0) {
      await client.query(
        `UPDATE reviews
         SET status = 'PENDING_ADMIN_REVIEW',
             verification_status = 'PENDING_ADMIN_REVIEW',
             trust_label = 'PENDING_ADMIN_REVIEW',
             public_visibility = 'PRIVATE_UNTIL_DECISION',
             trust_weight_bucket = 'NONE'
         WHERE id = $1`,
        [receipt.review_id],
      );
      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, previous_status, new_status, reason)
         VALUES (NULL, 'SYSTEM', 'RECEIPT_OCR_ENQUEUE_FAILED', 'RECEIPT_VERIFICATION', $1, $2, 'PENDING_ADMIN_REVIEW', $3)`,
        [receipt.id, receipt.status, reason],
      );
    } else {
      finalBody = {
        ...responseBody,
        status: receipt.status,
        processingStatus: receipt.status,
      };
    }

    await markIdempotencyCompleted(client, userId, idempotencyKey, finalBody, receiptVerificationId);
    await client.query('COMMIT');
    return finalBody;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function refreshIdempotencyAttempt(client, userId, idempotencyKey, requestHash) {
  await client.query(
    `UPDATE idempotency_keys
     SET request_hash = $4,
         status = 'IN_PROGRESS',
         locked_until = NOW() + ($5 || ' minutes')::interval,
         expires_at = NOW() + ($6 || ' hours')::interval,
         updated_at = NOW()
     WHERE user_id = $1
       AND endpoint = $2
       AND idempotency_key = $3`,
    [userId, RECEIPT_ENDPOINT, idempotencyKey, requestHash, RECEIPT_LOCK_MINUTES, RECEIPT_IDEMPOTENCY_TTL_HOURS],
  );
}

function resolveExistingIdempotency(row, requestHash) {
  if (!row) return null;

  if (row.request_hash !== requestHash) {
    throw createHttpError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key was already used with a different payload.');
  }

  if (row.status === 'COMPLETED') {
    return {
      statusCode: row.response_status_code || 202,
      body: row.response_body,
      replayed: true,
    };
  }

  if (row.status === 'IN_PROGRESS') {
    const lockedUntil = row.locked_until ? new Date(row.locked_until).getTime() : 0;
    if (lockedUntil > Date.now()) {
      throw createHttpError(409, 'REQUEST_IN_PROGRESS', 'A request with this Idempotency-Key is still processing.');
    }

    return { retryable: true };
  }

  if (row.status === 'FAILED') {
    return { retryable: true };
  }

  return null;
}

async function getReviewForUpload(client, userId, reviewId, restaurantId) {
  const result = await client.query(
    `SELECT r.id,
            r.user_id,
            r.restaurant_id,
            r.branch_id,
            r.status,
            r.verification_status,
            rest.status AS restaurant_status,
            rest.is_deleted AS restaurant_is_deleted
     FROM reviews r
     JOIN restaurants rest ON rest.id = r.restaurant_id
     WHERE r.id = $1
     FOR UPDATE OF r`,
    [reviewId],
  );

  if (result.rowCount === 0) {
    throw createHttpError(404, 'NOT_FOUND', 'Review not found.');
  }

  const review = result.rows[0];
  if (review.user_id !== userId) {
    throw createHttpError(404, 'NOT_FOUND', 'Review not found.');
  }
  if (review.restaurant_id !== restaurantId) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'restaurantId must match the review restaurant.', [
      validationDetail('restaurantId', 'RESTAURANT_MISMATCH', 'restaurantId must match the review restaurant.'),
    ]);
  }
  if (review.restaurant_status !== 'ACTIVE' || review.restaurant_is_deleted === true) {
    throw createHttpError(422, 'RESTAURANT_NOT_ACTIVE', 'Restaurant is not active.');
  }
  if (review.status !== 'SUBMITTED' || review.verification_status !== 'UNVERIFIED') {
    throw createHttpError(422, 'REVIEW_NOT_EDITABLE', 'Review cannot accept a receipt upload.');
  }

  return review;
}

async function assertNoActiveReceipt(client, reviewId) {
  const result = await client.query(
    `SELECT id
     FROM receipt_verifications
     WHERE review_id = $1
       AND status NOT IN ('OCR_FAILED', 'REJECTED')
     LIMIT 1`,
    [reviewId],
  );

  if (result.rowCount > 0) {
    throw createHttpError(409, 'RECEIPT_ALREADY_UPLOADED', 'Review already has a receipt upload.');
  }
}

async function findExistingReceiptByHash(client, fileHash) {
  const result = await client.query(
    `SELECT id
     FROM receipt_verifications
     WHERE file_hash_sha256 = $1
       AND status NOT IN ('OCR_FAILED')
     LIMIT 1`,
    [fileHash],
  );

  return result.rows[0] ?? null;
}

async function createDuplicateReceiptFraudFlag(client, { existingReceiptId, attemptedUserId }) {
  const flagResult = await client.query(
    `INSERT INTO fraud_flags (flag_code, risk_score, status)
     VALUES ('DUPLICATE_RECEIPT_HASH', $1, 'OPEN')
     RETURNING id`,
    [DUPLICATE_RECEIPT_HASH_RISK_SCORE],
  );
  const fraudFlagId = flagResult.rows[0].id;

  await client.query(
    `INSERT INTO fraud_flag_entities (fraud_flag_id, entity_type, entity_id)
     VALUES
       ($1, 'RECEIPT_VERIFICATION', $2),
       ($1, 'USER', $3)
     ON CONFLICT DO NOTHING`,
    [fraudFlagId, existingReceiptId, attemptedUserId],
  );
}

function duplicateReceiptHashError(existingReceiptId = null) {
  const error = createHttpError(409, 'DUPLICATE_RECEIPT_HASH', 'Receipt image was already uploaded.');
  error.existingReceiptId = existingReceiptId;
  return error;
}

async function assertReceiptHashIsUnique(client, fileHash) {
  const existingReceipt = await findExistingReceiptByHash(client, fileHash);
  if (!existingReceipt) return;

  throw duplicateReceiptHashError(existingReceipt.id);
}

function isDuplicateReceiptError(err) {
  return err.code === '23505' && err.constraint === DUPLICATE_RECEIPT_HASH_INDEX;
}

function isDuplicateIdempotencyError(err) {
  return err.code === '23505' && err.constraint === IDEMPOTENCY_UNIQUE_CONSTRAINT;
}

async function persistDuplicateReceiptFraudFlag({ existingReceiptId, attemptedUserId }) {
  if (!existingReceiptId) return;

  const fraudClient = await pool.connect();
  try {
    await fraudClient.query('BEGIN');
    await createDuplicateReceiptFraudFlag(fraudClient, {
      existingReceiptId,
      attemptedUserId,
    });
    await fraudClient.query('COMMIT');
  } catch (err) {
    await fraudClient.query('ROLLBACK');
    throw err;
  } finally {
    fraudClient.release();
  }
}

async function findReceiptByHashOutsideTransaction(fileHash) {
  const client = await pool.connect();
  try {
    return await findExistingReceiptByHash(client, fileHash);
  } finally {
    client.release();
  }
}

export async function uploadReceiptForReview({ userId, idempotencyKey, fields, file }) {
  validateIdempotencyKey(idempotencyKey);
  const data = validateReceiptFields(fields);
  validateFile(file);

  const fileHash = sha256Hex(file.buffer);
  const requestHash = stableRequestHash({ userId, data, fileHash });

  let uploadedFileUrl = null;
  let ownsIdempotencyAttempt = false;

  const failOwnedIdempotencyAttempt = async () => {
    if (!ownsIdempotencyAttempt) return;

    let failureClient;
    try {
      failureClient = await pool.connect();
      await markIdempotencyFailed(failureClient, userId, idempotencyKey);
    } catch {
      // Preserve the original failure response even if failure-state persistence is unavailable.
    } finally {
      failureClient?.release();
    }
  };

  const tryPersistDuplicateReceiptFraudFlag = async ({ existingReceiptId, attemptedUserId }) => {
    try {
      await persistDuplicateReceiptFraudFlag({ existingReceiptId, attemptedUserId });
    } catch {
      // Preserve the original duplicate-hash response even if fraud-flag persistence is unavailable.
    }
  };

  const handleDuplicateReceiptError = async (err) => {
    if (err.code === 'DUPLICATE_RECEIPT_HASH') {
      await tryPersistDuplicateReceiptFraudFlag({
        existingReceiptId: err.existingReceiptId,
        attemptedUserId: userId,
      });
      throw err;
    }

    if (isDuplicateReceiptError(err)) {
      const existingReceipt = await findReceiptByHashOutsideTransaction(fileHash);
      await tryPersistDuplicateReceiptFraudFlag({
        existingReceiptId: existingReceipt?.id,
        attemptedUserId: userId,
      });
      throw createHttpError(409, 'DUPLICATE_RECEIPT_HASH', 'Receipt image was already uploaded.');
    }
  };

  const preflightClient = await pool.connect();
  try {
    await preflightClient.query('BEGIN');
    const existing = await getExistingIdempotency(preflightClient, userId, idempotencyKey);
    const replay = resolveExistingIdempotency(existing, requestHash);
    if (replay?.replayed) {
      await preflightClient.query('COMMIT');
      return replay;
    }
    if (!existing) {
      try {
        await createIdempotency(preflightClient, userId, idempotencyKey, requestHash);
      } catch (err) {
        if (isDuplicateIdempotencyError(err)) {
          throw createHttpError(409, 'REQUEST_IN_PROGRESS', 'A request with this Idempotency-Key is still processing.');
        }
        throw err;
      }
      ownsIdempotencyAttempt = true;
    } else if (replay?.retryable) {
      await refreshIdempotencyAttempt(preflightClient, userId, idempotencyKey, requestHash);
      ownsIdempotencyAttempt = true;
    }

    await getReviewForUpload(preflightClient, userId, data.reviewId, data.restaurantId);
    await assertNoActiveReceipt(preflightClient, data.reviewId);
    await assertReceiptHashIsUnique(preflightClient, fileHash);
    await preflightClient.query('COMMIT');
  } catch (err) {
    await preflightClient.query('ROLLBACK');
    await failOwnedIdempotencyAttempt();
    await handleDuplicateReceiptError(err);
    throw err;
  } finally {
    preflightClient.release();
  }

  try {
    const objectKey = buildReceiptObjectKey({
      userId,
      reviewId: data.reviewId,
      contentType: file.mimetype,
    });
    uploadedFileUrl = await uploadReceiptObject({
      key: objectKey,
      body: file.buffer,
      contentType: file.mimetype,
    });
  } catch (err) {
    await failOwnedIdempotencyAttempt();
    throw err;
  }

  const persistClient = await pool.connect();
  let receiptVerificationId;
  let responseBody;
  try {
    await persistClient.query('BEGIN');
    const review = await getReviewForUpload(persistClient, userId, data.reviewId, data.restaurantId);
    await assertNoActiveReceipt(persistClient, data.reviewId);
    await assertReceiptHashIsUnique(persistClient, fileHash);

    const receiptResult = await persistClient.query(
      `INSERT INTO receipt_verifications (
         review_id,
         user_id,
         restaurant_id,
         branch_id,
         file_url,
         file_hash_sha256,
         status,
         gps_latitude,
         gps_longitude,
         gps_accuracy_meters,
         captured_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'UPLOADED', $7, $8, $9, $10)
       RETURNING id, status`,
      [
        data.reviewId,
        userId,
        data.restaurantId,
        review.branch_id,
        uploadedFileUrl,
        fileHash,
        data.latitude,
        data.longitude,
        data.gpsAccuracyMeters,
        data.capturedAt,
      ],
    );

    await persistClient.query(
      `UPDATE reviews
       SET verification_status = 'PROCESSING',
           trust_label = 'PROCESSING'
       WHERE id = $1`,
      [data.reviewId],
    );

    const body = {
      receiptVerificationId: receiptResult.rows[0].id,
      status: receiptResult.rows[0].status,
      processingStatus: 'HASH_CHECKING',
    };

    await markIdempotencyCompleted(persistClient, userId, idempotencyKey, body, receiptResult.rows[0].id);
    await persistClient.query('COMMIT');
    receiptVerificationId = receiptResult.rows[0].id;
    responseBody = body;
  } catch (err) {
    await persistClient.query('ROLLBACK');

    if (uploadedFileUrl) {
      await deleteReceiptObject({ fileUrl: uploadedFileUrl });
    }

    await failOwnedIdempotencyAttempt();
    await handleDuplicateReceiptError(err);
    throw err;
  } finally {
    persistClient.release();
  }

  try {
    await enqueueReceiptOcr(receiptVerificationId);
  } catch (err) {
    responseBody = await markReceiptPendingAdminReviewForQueueFailure({
      receiptVerificationId,
      userId,
      idempotencyKey,
      responseBody,
      reason: OCR_ENQUEUE_FAILURE_PUBLIC_REASON,
    });
  }

  return { statusCode: 202, body: responseBody };
}
