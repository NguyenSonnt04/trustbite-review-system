import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';
import {
  buildRestaurantImageObjectKey,
  deleteRestaurantImageObject,
  deleteRestaurantImageReference,
  resolveRestaurantImageUrl,
  uploadRestaurantImageObject,
} from './s3RestaurantImageStorageService.js';
import { authorizeRestaurantMedia } from './restaurantMediaAuthorizationService.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const UPLOAD_ENDPOINT = 'POST /api/v1/admin-web/restaurants/:restaurantId/images';
const REPLACEMENT_ENDPOINT = (
  'POST /api/v1/admin-web/restaurants/:restaurantId/images/:imageId/replace'
);
const IDEMPOTENCY_TTL_HOURS = 24;
const IDEMPOTENCY_LOCK_MINUTES = 5;
const IDEMPOTENCY_UNIQUE_CONSTRAINT = 'idempotency_keys_user_id_endpoint_idempotency_key_key';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_EXTENSIONS = {
  'image/jpeg': new Set(['jpg', 'jpeg']),
  'image/png': new Set(['png']),
  'image/webp': new Set(['webp']),
};

function validationError(message, details) {
  return createHttpError(422, 'VALIDATION_ERROR', message, details);
}

function validateIdempotencyKey(value) {
  if (!value) {
    throw createHttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.');
  }
  if (typeof value !== 'string' || !UUID_V4_REGEX.test(value)) {
    throw createHttpError(400, 'IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key must be a UUID v4.');
  }
}

function normalizeCaption(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw validationError('Restaurant image payload is invalid.', [{
      field: 'caption',
      code: 'INVALID_TYPE',
      message: 'caption must be a string.',
    }]);
  }

  const caption = value.trim();
  if (caption.length === 0) return null;
  if (caption.length > 255) {
    throw validationError('Restaurant image payload is invalid.', [{
      field: 'caption',
      code: 'MAX_LENGTH',
      message: 'caption must be at most 255 characters.',
    }]);
  }
  return caption;
}

function parseIsPrimary(value) {
  if (value === undefined || value === null || value === '') return true;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;

  throw validationError('Restaurant image payload is invalid.', [{
    field: 'isPrimary',
    code: 'INVALID_BOOLEAN',
    message: 'isPrimary must be true or false.',
  }]);
}

function fileExtension(filename = '') {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts.at(-1) : '';
}

function hasMatchingMagicBytes(file) {
  const buffer = file.buffer;
  if (!Buffer.isBuffer(buffer)) return false;

  if (file.mimetype === 'image/jpeg') {
    return buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff;
  }
  if (file.mimetype === 'image/png') {
    return buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]));
  }
  if (file.mimetype === 'image/webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

function validateFile(file) {
  if (!file) {
    throw createHttpError(400, 'VALIDATION_ERROR', 'restaurantImage is required.', [{
      field: 'restaurantImage',
      code: 'REQUIRED',
      message: 'restaurantImage is required.',
    }]);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw createHttpError(413, 'FILE_TOO_LARGE', 'Restaurant image must be 5MB or smaller.');
  }

  const allowedExtensions = ALLOWED_EXTENSIONS[file.mimetype];
  if (
    !allowedExtensions
    || !allowedExtensions.has(fileExtension(file.originalname))
    || !hasMatchingMagicBytes(file)
  ) {
    throw createHttpError(
      415,
      'UNSUPPORTED_FILE_TYPE',
      'Restaurant image must be JPG, PNG, or WebP.',
    );
  }
}

function requestHash({
  userId,
  restaurantId,
  caption,
  isPrimary,
  file,
  operationContext = null,
}) {
  const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  return crypto.createHash('sha256').update(JSON.stringify({
    userId,
    restaurantId,
    caption,
    isPrimary,
    fileHash,
    operationContext,
  })).digest('hex');
}

function mapImageRow(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    branchId: row.branch_id,
    imageReference: row.image_url,
    caption: row.caption,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
  };
}

async function toImageResponse(storedImage) {
  const imageReference = storedImage.imageReference ?? storedImage.imageUrl;
  const {
    imageReference: _imageReference,
    imageUrl: _legacyImageUrl,
    ...body
  } = storedImage;

  return {
    ...body,
    imageUrl: await resolveRestaurantImageUrl(imageReference),
  };
}

async function getIdempotency(client, userId, endpoint, idempotencyKey) {
  const result = await client.query(
    `SELECT request_hash, status, response_status_code, response_body,
            locked_until, expires_at
     FROM idempotency_keys
     WHERE user_id = $1
       AND endpoint = $2
       AND idempotency_key = $3
     FOR UPDATE`,
    [userId, endpoint, idempotencyKey],
  );
  return result.rows[0] ?? null;
}

function resolveIdempotency(row, hash) {
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return { retryable: true };
  }
  if (row.request_hash !== hash) {
    throw createHttpError(
      409,
      'IDEMPOTENCY_CONFLICT',
      'Idempotency-Key was already used with a different payload.',
    );
  }
  if (row.status === 'COMPLETED') {
    return {
      statusCode: row.response_status_code ?? 201,
      body: row.response_body,
      replayed: true,
    };
  }
  if (row.status === 'FAILED') {
    return { retryable: true };
  }
  if (
    row.status === 'IN_PROGRESS'
    && (!row.locked_until || new Date(row.locked_until).getTime() <= Date.now())
  ) {
    return { retryable: true };
  }
  throw createHttpError(
    409,
    'REQUEST_IN_PROGRESS',
    'A request with this Idempotency-Key is still processing.',
  );
}

async function createIdempotency(client, userId, endpoint, idempotencyKey, hash) {
  const result = await client.query(
    `INSERT INTO idempotency_keys (
       idempotency_key,
       user_id,
       endpoint,
       request_hash,
       status,
       locked_until,
       expires_at
     )
     VALUES ($1, $2, $3, $4, 'IN_PROGRESS', date_trunc('milliseconds', NOW()) + ($5 || ' minutes')::interval, NOW() + ($6 || ' hours')::interval)
     RETURNING locked_until`,
    [
      idempotencyKey,
      userId,
      endpoint,
      hash,
      IDEMPOTENCY_LOCK_MINUTES,
      IDEMPOTENCY_TTL_HOURS,
    ],
  );
  return result.rows[0].locked_until;
}

async function refreshIdempotency(client, userId, endpoint, idempotencyKey, hash) {
  const result = await client.query(
    `UPDATE idempotency_keys
     SET request_hash = $4,
         status = 'IN_PROGRESS',
         response_status_code = NULL,
         response_body = NULL,
         resource_type = NULL,
         resource_id = NULL,
         locked_until = date_trunc('milliseconds', NOW()) + ($5 || ' minutes')::interval,
         expires_at = NOW() + ($6 || ' hours')::interval
     WHERE user_id = $1
       AND endpoint = $2
       AND idempotency_key = $3
     RETURNING locked_until`,
    [
      userId,
      endpoint,
      idempotencyKey,
      hash,
      IDEMPOTENCY_LOCK_MINUTES,
      IDEMPOTENCY_TTL_HOURS,
    ],
  );
  return result.rows[0].locked_until;
}

async function completeIdempotency(
  client,
  userId,
  endpoint,
  idempotencyKey,
  hash,
  leaseUntil,
  body,
) {
  const result = await client.query(
    `UPDATE idempotency_keys
     SET status = 'COMPLETED',
         response_status_code = 201,
         response_body = $6::jsonb,
         resource_type = 'RESTAURANT_IMAGE',
         resource_id = $7,
         locked_until = NULL
     WHERE user_id = $1
       AND endpoint = $2
       AND idempotency_key = $3
       AND request_hash = $4
       AND locked_until = $5
       AND status = 'IN_PROGRESS'`,
    [
      userId,
      endpoint,
      idempotencyKey,
      hash,
      leaseUntil,
      JSON.stringify(body),
      body.id,
    ],
  );
  if (result.rowCount !== 1) {
    throw createHttpError(409, 'REQUEST_IN_PROGRESS', 'The upload attempt was superseded.');
  }
}

async function markIdempotencyFailed(
  userId,
  endpoint,
  idempotencyKey,
  hash,
  leaseUntil,
) {
  let client;
  try {
    client = await pool.connect();
    await client.query(
      `UPDATE idempotency_keys
       SET status = 'FAILED',
           locked_until = NULL
       WHERE user_id = $1
         AND endpoint = $2
         AND idempotency_key = $3
         AND request_hash = $4
         AND locked_until = $5
         AND status = 'IN_PROGRESS'`,
      [userId, endpoint, idempotencyKey, hash, leaseUntil],
    );
  } catch {
    // Preserve the original provider or persistence error.
  } finally {
    client?.release();
  }
}

async function prepareUpload({
  userId,
  roles,
  restaurantId,
  endpoint,
  idempotencyKey,
  hash,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await getIdempotency(client, userId, endpoint, idempotencyKey);
    const restaurant = await client.query(
      `SELECT id
       FROM restaurants
       WHERE id = $1
         AND is_deleted = FALSE`,
      [restaurantId],
    );
    if (restaurant.rowCount === 0) {
      throw createHttpError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found.');
    }

    await authorizeRestaurantMedia(client, {
      userId,
      roles,
      restaurantId,
    });

    const resolution = resolveIdempotency(existing, hash);
    if (resolution?.replayed) {
      await client.query('COMMIT');
      return resolution;
    }

    let leaseUntil;
    if (resolution?.retryable) {
      leaseUntil = await refreshIdempotency(
        client,
        userId,
        endpoint,
        idempotencyKey,
        hash,
      );
    } else {
      leaseUntil = await createIdempotency(
        client,
        userId,
        endpoint,
        idempotencyKey,
        hash,
      );
    }
    await client.query('COMMIT');
    return { leaseUntil };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505' && err.constraint === IDEMPOTENCY_UNIQUE_CONSTRAINT) {
      throw createHttpError(
        409,
        'REQUEST_IN_PROGRESS',
        'A request with this Idempotency-Key is still processing.',
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

async function persistImage({
  userId,
  roles,
  restaurantId,
  endpoint,
  idempotencyKey,
  hash,
  leaseUntil,
  caption,
  isPrimary,
  imageReference,
}) {
  const client = await pool.connect();
  let commitStarted = false;

  try {
    await client.query('BEGIN');
    const attempt = await client.query(
      `SELECT id
       FROM idempotency_keys
       WHERE user_id = $1
         AND endpoint = $2
         AND idempotency_key = $3
         AND request_hash = $4
         AND locked_until = $5
         AND status = 'IN_PROGRESS'
       FOR UPDATE`,
      [userId, endpoint, idempotencyKey, hash, leaseUntil],
    );
    if (attempt.rowCount === 0) {
      throw createHttpError(409, 'REQUEST_IN_PROGRESS', 'The upload attempt was superseded.');
    }

    const restaurant = await client.query(
      `SELECT id
       FROM restaurants
       WHERE id = $1
         AND is_deleted = FALSE
       FOR UPDATE`,
      [restaurantId],
    );
    if (restaurant.rowCount === 0) {
      throw createHttpError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found.');
    }

    const authorization = await authorizeRestaurantMedia(client, {
      userId,
      roles,
      restaurantId,
    });

    if (isPrimary) {
      await client.query(
        `UPDATE restaurant_images
         SET is_primary = FALSE
         WHERE restaurant_id = $1
           AND branch_id IS NULL
           AND is_primary = TRUE`,
        [restaurantId],
      );
    }

    const inserted = await client.query(
      `INSERT INTO restaurant_images (
         restaurant_id,
         branch_id,
         image_url,
         caption,
         is_primary
       )
       VALUES ($1, NULL, $2, $3, $4)
       RETURNING *`,
      [restaurantId, imageReference, caption, isPrimary],
    );
    const body = mapImageRow(inserted.rows[0]);

    await client.query(
      `INSERT INTO audit_logs (
         actor_id,
         actor_role,
         action,
         entity_type,
         entity_id,
         metadata
       )
       VALUES ($1, $2, 'RESTAURANT_IMAGE_UPLOADED', 'RESTAURANT_IMAGE', $3, $4::jsonb)`,
      [
        userId,
        authorization.actorRole,
        body.id,
        JSON.stringify({ restaurantId, isPrimary }),
      ],
    );

    await completeIdempotency(
      client,
      userId,
      endpoint,
      idempotencyKey,
      hash,
      leaseUntil,
      body,
    );
    commitStarted = true;
    await client.query('COMMIT');
    return body;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // A COMMIT transport failure has an ambiguous outcome.
    }
    err.commitOutcomeAmbiguous = commitStarted;
    throw err;
  } finally {
    client.release();
  }
}

export async function uploadRestaurantImage({
  userId,
  roles,
  restaurantId,
  idempotencyKey,
  fields = {},
  file,
  idempotencyEndpoint = UPLOAD_ENDPOINT,
  operationContext = null,
}) {
  validateIdempotencyKey(idempotencyKey);
  const caption = normalizeCaption(fields.caption);
  const isPrimary = parseIsPrimary(fields.isPrimary);
  validateFile(file);
  const hash = requestHash({
    userId,
    restaurantId,
    caption,
    isPrimary,
    file,
    operationContext,
  });

  const prepared = await prepareUpload({
    userId,
    roles,
    restaurantId,
    endpoint: idempotencyEndpoint,
    idempotencyKey,
    hash,
  });
  if (prepared.replayed) {
    return {
      ...prepared,
      body: await toImageResponse(prepared.body),
    };
  }
  const { leaseUntil } = prepared;

  const objectKey = buildRestaurantImageObjectKey({
    restaurantId,
    contentType: file.mimetype,
  });
  let uploaded;
  try {
    uploaded = await uploadRestaurantImageObject({
      key: objectKey,
      body: file.buffer,
      contentType: file.mimetype,
    });
  } catch (err) {
    await deleteRestaurantImageObject({ key: objectKey });
    await markIdempotencyFailed(
      userId,
      idempotencyEndpoint,
      idempotencyKey,
      hash,
      leaseUntil,
    );
    throw err;
  }

  let body;
  try {
    body = await persistImage({
      userId,
      roles,
      restaurantId,
      endpoint: idempotencyEndpoint,
      idempotencyKey,
      hash,
      leaseUntil,
      caption,
      isPrimary,
      imageReference: uploaded.imageReference,
    });
  } catch (err) {
    if (!err.commitOutcomeAmbiguous) {
      await deleteRestaurantImageObject({ key: uploaded.objectKey });
      await markIdempotencyFailed(
        userId,
        idempotencyEndpoint,
        idempotencyKey,
        hash,
        leaseUntil,
      );
    }
    throw err;
  }
  return {
    statusCode: 201,
    body: await toImageResponse(body),
    replayed: false,
  };
}

export async function listRestaurantImages({
  userId,
  roles,
  restaurantId,
}) {
  const client = await pool.connect();
  let rows;
  try {
    const restaurant = await client.query(
      `SELECT id
       FROM restaurants
       WHERE id = $1
         AND is_deleted = FALSE`,
      [restaurantId],
    );
    if (restaurant.rowCount === 0) {
      throw createHttpError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found.');
    }

    await authorizeRestaurantMedia(client, {
      userId,
      roles,
      restaurantId,
    });

    const images = await client.query(
      `SELECT *
       FROM restaurant_images
       WHERE restaurant_id = $1
         AND branch_id IS NULL
       ORDER BY is_primary DESC, created_at DESC, id DESC`,
      [restaurantId],
    );

    rows = images.rows;
  } finally {
    client.release();
  }

  return {
    restaurantId,
    items: await Promise.all(rows.map((row) => toImageResponse(mapImageRow(row)))),
  };
}

const deleteEndpoint = (restaurantId, imageId) => (
  `DELETE /api/v1/restaurants/${restaurantId}/images/${imageId}`
);

function deleteRequestHash({ userId, restaurantId, imageId }) {
  return crypto.createHash('sha256').update(JSON.stringify({
    userId,
    restaurantId,
    imageId,
  })).digest('hex');
}

function validateDeleteIdentifiers(restaurantId, imageId) {
  if (!UUID_REGEX.test(restaurantId ?? '')) {
    throw createHttpError(400, 'VALIDATION_ERROR', 'restaurantId must be a valid UUID.');
  }
  if (!UUID_REGEX.test(imageId ?? '')) {
    throw createHttpError(400, 'VALIDATION_ERROR', 'imageId must be a valid UUID.');
  }
}

async function markDeleteFailed({
  userId,
  endpoint,
  idempotencyKey,
  hash,
  leaseUntil,
}) {
  let client;
  try {
    client = await pool.connect();
    await client.query(
      `UPDATE idempotency_keys
       SET status = 'FAILED',
           locked_until = NULL
       WHERE user_id = $1
         AND endpoint = $2
         AND idempotency_key = $3
         AND request_hash = $4
         AND locked_until = $5
         AND status = 'IN_PROGRESS'`,
      [userId, endpoint, idempotencyKey, hash, leaseUntil],
    );
  } catch {
    // Preserve the provider error so a later retry can reclaim the expired lease.
  } finally {
    client?.release();
  }
}

async function completeDelete({
  userId,
  endpoint,
  idempotencyKey,
  hash,
  leaseUntil,
  response,
  imageId,
}) {
  const result = await pool.query(
    `UPDATE idempotency_keys
     SET status = 'COMPLETED',
         response_status_code = 200,
         response_body = $6::jsonb,
         resource_type = 'RESTAURANT_IMAGE',
         resource_id = $7,
         locked_until = NULL
     WHERE user_id = $1
       AND endpoint = $2
       AND idempotency_key = $3
       AND request_hash = $4
       AND locked_until = $5
       AND status = 'IN_PROGRESS'`,
    [
      userId,
      endpoint,
      idempotencyKey,
      hash,
      leaseUntil,
      JSON.stringify(response),
      imageId,
    ],
  );
  if (result.rowCount !== 1) {
    throw createHttpError(409, 'REQUEST_IN_PROGRESS', 'The delete attempt was superseded.');
  }
}

async function prepareDelete({
  userId,
  roles,
  restaurantId,
  imageId,
  idempotencyKey,
  endpoint,
  hash,
}) {
  const client = await pool.connect();
  let commitStarted = false;
  try {
    await client.query('BEGIN');
    const restaurant = await client.query(
      `SELECT id
       FROM restaurants
       WHERE id = $1
         AND is_deleted = FALSE
       FOR UPDATE`,
      [restaurantId],
    );
    if (restaurant.rowCount === 0) {
      throw createHttpError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found.');
    }

    const authorization = await authorizeRestaurantMedia(client, {
      userId,
      roles,
      restaurantId,
    });

    const existingResult = await client.query(
      `SELECT request_hash, status, response_status_code, response_body,
              locked_until, expires_at
       FROM idempotency_keys
       WHERE user_id = $1
         AND endpoint = $2
         AND idempotency_key = $3
       FOR UPDATE`,
      [userId, endpoint, idempotencyKey],
    );
    const existing = existingResult.rows[0] ?? null;
    let cleanupPlan = null;

    if (existing) {
      if (existing.request_hash !== hash) {
        throw createHttpError(
          409,
          'IDEMPOTENCY_CONFLICT',
          'Idempotency-Key was already used with a different payload.',
        );
      }
      if (existing.status === 'COMPLETED') {
        await client.query('COMMIT');
        return {
          statusCode: existing.response_status_code ?? 200,
          body: existing.response_body,
          replayed: true,
        };
      }

      const leaseExpired = !existing.locked_until
        || new Date(existing.locked_until).getTime() <= Date.now();
      if (existing.status === 'IN_PROGRESS' && !leaseExpired) {
        throw createHttpError(
          409,
          'REQUEST_IN_PROGRESS',
          'A request with this Idempotency-Key is still processing.',
        );
      }
      cleanupPlan = existing.response_body;
    }

    let leaseUntil;
    if (existing) {
      const refreshed = await client.query(
        `UPDATE idempotency_keys
         SET status = 'IN_PROGRESS',
             locked_until = date_trunc('milliseconds', NOW()) + ($5 || ' minutes')::interval,
             expires_at = NOW() + ($6 || ' hours')::interval
         WHERE user_id = $1
           AND endpoint = $2
           AND idempotency_key = $3
           AND request_hash = $4
         RETURNING locked_until`,
        [
          userId,
          endpoint,
          idempotencyKey,
          hash,
          IDEMPOTENCY_LOCK_MINUTES,
          IDEMPOTENCY_TTL_HOURS,
        ],
      );
      leaseUntil = refreshed.rows[0].locked_until;
    } else {
      const created = await client.query(
        `INSERT INTO idempotency_keys (
           idempotency_key,
           user_id,
           endpoint,
           request_hash,
           status,
           locked_until,
           expires_at
         )
         VALUES (
           $1,
           $2,
           $3,
           $4,
           'IN_PROGRESS',
           date_trunc('milliseconds', NOW()) + ($5 || ' minutes')::interval,
           NOW() + ($6 || ' hours')::interval
         )
         RETURNING locked_until`,
        [
          idempotencyKey,
          userId,
          endpoint,
          hash,
          IDEMPOTENCY_LOCK_MINUTES,
          IDEMPOTENCY_TTL_HOURS,
        ],
      );
      leaseUntil = created.rows[0].locked_until;
    }

    if (cleanupPlan?.cleanup?.imageReference && cleanupPlan.response) {
      commitStarted = true;
      await client.query('COMMIT');
      return {
        cleanup: cleanupPlan.cleanup,
        response: cleanupPlan.response,
        leaseUntil,
        replayed: false,
      };
    }

    const imageResult = await client.query(
      `SELECT *
       FROM restaurant_images
       WHERE id = $1
         AND restaurant_id = $2
         AND branch_id IS NULL
       FOR UPDATE`,
      [imageId, restaurantId],
    );
    if (imageResult.rowCount === 0) {
      throw createHttpError(404, 'RESTAURANT_IMAGE_NOT_FOUND', 'Restaurant image not found.');
    }

    const image = imageResult.rows[0];
    let promotedPrimaryImageId = null;
    if (image.is_primary) {
      const nextPrimary = await client.query(
        `SELECT id
         FROM restaurant_images
         WHERE restaurant_id = $1
           AND branch_id IS NULL
           AND id <> $2
         ORDER BY created_at DESC, id DESC
         LIMIT 1
         FOR UPDATE`,
        [restaurantId, imageId],
      );
      promotedPrimaryImageId = nextPrimary.rows[0]?.id ?? null;
    }

    await client.query(
      `DELETE FROM restaurant_images
       WHERE id = $1`,
      [imageId],
    );
    if (promotedPrimaryImageId) {
      await client.query(
        `UPDATE restaurant_images
         SET is_primary = TRUE
         WHERE id = $1`,
        [promotedPrimaryImageId],
      );
    }

    const response = {
      id: imageId,
      restaurantId,
      deleted: true,
      wasPrimary: image.is_primary,
      promotedPrimaryImageId,
    };
    const plan = {
      cleanup: {
        imageReference: image.image_url,
      },
      response,
    };

    await client.query(
      `INSERT INTO audit_logs (
         actor_id,
         actor_role,
         action,
         entity_type,
         entity_id,
         metadata
       )
       VALUES ($1, $2, 'RESTAURANT_IMAGE_DELETED', 'RESTAURANT_IMAGE', $3, $4::jsonb)`,
      [
        userId,
        authorization.actorRole,
        imageId,
        JSON.stringify({
          restaurantId,
          wasPrimary: image.is_primary,
          promotedPrimaryImageId,
        }),
      ],
    );
    await client.query(
      `UPDATE idempotency_keys
       SET response_body = $6::jsonb,
           resource_type = 'RESTAURANT_IMAGE',
           resource_id = $7
       WHERE user_id = $1
         AND endpoint = $2
         AND idempotency_key = $3
         AND request_hash = $4
         AND locked_until = $5
         AND status = 'IN_PROGRESS'`,
      [
        userId,
        endpoint,
        idempotencyKey,
        hash,
        leaseUntil,
        JSON.stringify(plan),
        imageId,
      ],
    );

    commitStarted = true;
    await client.query('COMMIT');
    return {
      cleanup: plan.cleanup,
      response,
      leaseUntil,
      replayed: false,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // A COMMIT transport failure has an ambiguous outcome.
    }
    err.commitOutcomeAmbiguous = commitStarted;
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteRestaurantImage({
  userId,
  roles,
  restaurantId,
  imageId,
  idempotencyKey,
}) {
  validateDeleteIdentifiers(restaurantId, imageId);
  validateIdempotencyKey(idempotencyKey);
  const endpoint = deleteEndpoint(restaurantId, imageId);
  const hash = deleteRequestHash({ userId, restaurantId, imageId });
  const prepared = await prepareDelete({
    userId,
    roles,
    restaurantId,
    imageId,
    idempotencyKey,
    endpoint,
    hash,
  });
  if (prepared.replayed) return prepared;

  try {
    await deleteRestaurantImageReference(prepared.cleanup.imageReference);
    await completeDelete({
      userId,
      endpoint,
      idempotencyKey,
      hash,
      leaseUntil: prepared.leaseUntil,
      response: prepared.response,
      imageId,
    });
    return {
      statusCode: 200,
      body: prepared.response,
      replayed: false,
    };
  } catch (err) {
    await markDeleteFailed({
      userId,
      endpoint,
      idempotencyKey,
      hash,
      leaseUntil: prepared.leaseUntil,
    });
    throw err;
  }
}

export async function updateRestaurantImage({
  userId,
  roles,
  restaurantId,
  imageId,
  fields = {},
}) {
  validateDeleteIdentifiers(restaurantId, imageId);
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw validationError('Restaurant image payload is invalid.', [{
      field: 'body',
      code: 'INVALID_TYPE',
      message: 'Request body must be an object.',
    }]);
  }
  const unknownField = Object.keys(fields).find(
    (field) => field !== 'caption' && field !== 'isPrimary',
  );
  if (unknownField) {
    throw validationError('Restaurant image payload is invalid.', [{
      field: unknownField,
      code: 'UNSUPPORTED_FIELD',
      message: `${unknownField} is not supported.`,
    }]);
  }
  const hasCaption = Object.prototype.hasOwnProperty.call(fields, 'caption');
  const hasPrimary = Object.prototype.hasOwnProperty.call(fields, 'isPrimary');
  if (!hasCaption && !hasPrimary) {
    throw validationError('Restaurant image payload is invalid.', [{
      field: 'body',
      code: 'REQUIRED',
      message: 'caption or isPrimary is required.',
    }]);
  }

  const caption = hasCaption ? normalizeCaption(fields.caption) : undefined;
  const isPrimary = hasPrimary ? parseIsPrimary(fields.isPrimary) : undefined;
  if (isPrimary === false) {
    throw validationError('Restaurant image payload is invalid.', [{
      field: 'isPrimary',
      code: 'INVALID_VALUE',
      message: 'A primary image can only be replaced by selecting another image.',
    }]);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const restaurant = await client.query(
      `SELECT id
       FROM restaurants
       WHERE id = $1
         AND is_deleted = FALSE
       FOR UPDATE`,
      [restaurantId],
    );
    if (restaurant.rowCount === 0) {
      throw createHttpError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found.');
    }

    const authorization = await authorizeRestaurantMedia(client, {
      userId,
      roles,
      restaurantId,
    });
    const existing = await client.query(
      `SELECT *
       FROM restaurant_images
       WHERE id = $1
         AND restaurant_id = $2
         AND branch_id IS NULL
       FOR UPDATE`,
      [imageId, restaurantId],
    );
    if (existing.rowCount === 0) {
      throw createHttpError(404, 'RESTAURANT_IMAGE_NOT_FOUND', 'Restaurant image not found.');
    }

    if (isPrimary === true) {
      await client.query(
        `UPDATE restaurant_images
         SET is_primary = FALSE
         WHERE restaurant_id = $1
           AND branch_id IS NULL
           AND id <> $2
           AND is_primary = TRUE`,
        [restaurantId, imageId],
      );
    }

    const updated = await client.query(
      `UPDATE restaurant_images
       SET caption = CASE WHEN $3::boolean THEN $4::text ELSE caption END,
           is_primary = CASE WHEN $5::boolean IS TRUE THEN TRUE ELSE is_primary END
       WHERE id = $1
         AND restaurant_id = $2
       RETURNING *`,
      [imageId, restaurantId, hasCaption, caption ?? null, isPrimary ?? null],
    );
    await client.query(
      `INSERT INTO audit_logs (
         actor_id, actor_role, action, entity_type, entity_id, metadata
       )
       VALUES ($1, $2, 'RESTAURANT_IMAGE_UPDATED', 'RESTAURANT_IMAGE', $3, $4::jsonb)`,
      [
        userId,
        authorization.actorRole,
        imageId,
        JSON.stringify({
          restaurantId,
          captionChanged: hasCaption,
          setPrimary: isPrimary === true,
        }),
      ],
    );
    await client.query('COMMIT');
    return toImageResponse(mapImageRow(updated.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function findCompletedUpload(userId, endpoint, idempotencyKey) {
  const result = await pool.query(
    `SELECT request_hash, response_body
     FROM idempotency_keys
     WHERE user_id = $1
       AND endpoint = $2
       AND idempotency_key = $3
       AND status = 'COMPLETED'`,
    [userId, endpoint, idempotencyKey],
  );
  return result.rows[0] ?? null;
}

async function deleteReplacedImage(input) {
  try {
    await deleteRestaurantImage(input);
  } catch (err) {
    if (err?.code !== 'RESTAURANT_IMAGE_NOT_FOUND') {
      throw err;
    }
  }
}

export async function replaceRestaurantImage({
  userId,
  roles,
  restaurantId,
  imageId,
  idempotencyKey,
  fields = {},
  file,
}) {
  validateDeleteIdentifiers(restaurantId, imageId);
  validateIdempotencyKey(idempotencyKey);
  validateFile(file);
  const endpoint = REPLACEMENT_ENDPOINT;
  const operationContext = { operation: 'replace', restaurantId, imageId };
  const completedUpload = await findCompletedUpload(userId, endpoint, idempotencyKey);
  if (completedUpload) {
    const caption = Object.prototype.hasOwnProperty.call(fields, 'caption')
      ? normalizeCaption(fields.caption)
      : completedUpload.response_body.caption;
    const hash = requestHash({
      userId,
      restaurantId,
      caption,
      isPrimary: completedUpload.response_body.isPrimary,
      file,
      operationContext,
    });
    if (hash !== completedUpload.request_hash) {
      throw createHttpError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'Idempotency-Key was already used with a different replacement payload.',
      );
    }
    const uploaded = await uploadRestaurantImage({
      userId,
      roles,
      restaurantId,
      idempotencyKey,
      fields: {
        caption: Object.prototype.hasOwnProperty.call(fields, 'caption')
          ? fields.caption
          : completedUpload.response_body.caption,
        isPrimary: completedUpload.response_body.isPrimary,
      },
      file,
      idempotencyEndpoint: endpoint,
      operationContext,
    });
    await deleteReplacedImage({
      userId,
      roles,
      restaurantId,
      imageId,
      idempotencyKey,
    });
    return {
      statusCode: 200,
      body: uploaded.body,
      replayed: true,
    };
  }

  const client = await pool.connect();
  let existing;
  try {
    const restaurant = await client.query(
      `SELECT id
       FROM restaurants
       WHERE id = $1
         AND is_deleted = FALSE`,
      [restaurantId],
    );
    if (restaurant.rowCount === 0) {
      throw createHttpError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found.');
    }
    await authorizeRestaurantMedia(client, { userId, roles, restaurantId });
    const result = await client.query(
      `SELECT *
       FROM restaurant_images
       WHERE id = $1
         AND restaurant_id = $2
         AND branch_id IS NULL`,
      [imageId, restaurantId],
    );
    if (result.rowCount === 0) {
      throw createHttpError(404, 'RESTAURANT_IMAGE_NOT_FOUND', 'Restaurant image not found.');
    }
    existing = result.rows[0];
  } finally {
    client.release();
  }

  const uploaded = await uploadRestaurantImage({
    userId,
    roles,
    restaurantId,
    idempotencyKey,
    fields: {
      caption: Object.prototype.hasOwnProperty.call(fields, 'caption')
        ? fields.caption
        : existing.caption,
      isPrimary: existing.is_primary,
    },
    file,
    idempotencyEndpoint: endpoint,
    operationContext,
  });

  await deleteReplacedImage({
    userId,
    roles,
    restaurantId,
    imageId,
    idempotencyKey,
  });
  return {
    statusCode: 200,
    body: uploaded.body,
    replayed: uploaded.replayed,
  };
}
