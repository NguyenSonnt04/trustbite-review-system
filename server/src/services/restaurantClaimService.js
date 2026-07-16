import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';
import {
  buildMerchantClaimObjectKey,
  deleteMerchantClaimObject,
  resolveMerchantClaimUrl,
  uploadMerchantClaimObject,
} from './s3MerchantClaimStorageService.js';
import { resolveRestaurantImageUrl } from './s3RestaurantImageStorageService.js';

const ENDPOINT = 'POST /api/v1/merchant/restaurant-claims';
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const IDEMPOTENCY_LOCK_MINUTES = 5;
const IDEMPOTENCY_TTL_HOURS = 24;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERMISSION_LEVELS = new Set(['OWNER', 'MANAGER']);
const CLAIM_STATUSES = new Set(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']);
const EVIDENCE_EXTENSIONS = {
  'application/pdf': new Set(['pdf']),
  'image/jpeg': new Set(['jpg', 'jpeg']),
  'image/png': new Set(['png']),
  'image/webp': new Set(['webp']),
};

function validateIdempotencyKey(value) {
  if (!value) {
    throw createHttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.');
  }
  if (typeof value !== 'string' || !UUID_V4_REGEX.test(value)) {
    throw createHttpError(400, 'IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key must be a UUID v4.');
  }
}

function normalizePermission(value) {
  const permission = String(value ?? '').trim().toUpperCase();
  if (!PERMISSION_LEVELS.has(permission)) {
    throw createHttpError(
      422,
      'VALIDATION_ERROR',
      'requestedPermissionLevel must be OWNER or MANAGER.',
    );
  }
  return permission;
}

function fileExtension(filename = '') {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts.at(-1) : '';
}

function hasValidMagicBytes(file) {
  const buffer = file.buffer;
  if (!Buffer.isBuffer(buffer)) return false;
  if (file.mimetype === 'application/pdf') {
    return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  if (file.mimetype === 'image/jpeg') {
    return buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff;
  }
  if (file.mimetype === 'image/png') {
    return buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (file.mimetype === 'image/webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

function validateEvidence(file) {
  if (!file) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'evidenceFile is required.');
  }
  if (!EVIDENCE_EXTENSIONS[file.mimetype]) {
    throw createHttpError(
      422,
      'VALIDATION_ERROR',
      'Evidence must be a PDF, JPEG, PNG, or WebP file.',
    );
  }
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_EVIDENCE_BYTES) {
    throw createHttpError(
      422,
      'VALIDATION_ERROR',
      'Evidence file must be non-empty and 10MB or smaller.',
    );
  }
  if (!EVIDENCE_EXTENSIONS[file.mimetype].has(fileExtension(file.originalname))) {
    throw createHttpError(
      422,
      'VALIDATION_ERROR',
      'Evidence file extension does not match its content type.',
    );
  }
  if (!hasValidMagicBytes(file)) {
    throw createHttpError(
      422,
      'VALIDATION_ERROR',
      'Evidence file signature does not match its content type.',
    );
  }
}

function requestHash({
  userId,
  restaurantId,
  requestedPermissionLevel,
  file,
}) {
  return crypto.createHash('sha256').update(JSON.stringify({
    userId,
    restaurantId,
    requestedPermissionLevel,
    fileHash: crypto.createHash('sha256').update(file.buffer).digest('hex'),
  })).digest('hex');
}

function mapClaimRow(row) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    merchantUserId: row.merchant_user_id,
    merchantName: row.merchant_name,
    businessName: row.business_name,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name,
    requestedPermissionLevel: row.requested_permission_level,
    status: row.status,
    evidenceReference: row.evidence_url,
    adminNote: row.admin_note,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function toClaimResponse(storedClaim) {
  const {
    evidenceReference,
    ...claim
  } = storedClaim;
  return {
    ...claim,
    evidenceUrl: await resolveMerchantClaimUrl(evidenceReference),
  };
}

async function getMerchantForClaim(client, userId) {
  const result = await client.query(
    `SELECT m.id, m.status
     FROM merchants m
     JOIN user_roles ur
       ON ur.user_id = m.user_id
      AND ur.role_id = 'MERCHANT'
     WHERE m.user_id = $1
       AND m.status IN ('PENDING_VERIFICATION', 'ACTIVE')
     LIMIT 1`,
    [userId],
  );
  if (result.rowCount === 0) {
    throw createHttpError(403, 'FORBIDDEN', 'An eligible merchant profile is required.');
  }
  return result.rows[0];
}

function resolveIdempotency(row, hash) {
  if (!row) return null;
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
  const leaseExpired = !row.locked_until
    || new Date(row.locked_until).getTime() <= Date.now();
  if (row.status === 'FAILED' || leaseExpired) return { retryable: true };
  throw createHttpError(
    409,
    'REQUEST_IN_PROGRESS',
    'A request with this Idempotency-Key is still processing.',
  );
}

async function prepareClaim({
  userId,
  restaurantId,
  idempotencyKey,
  hash,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const merchant = await getMerchantForClaim(client, userId);
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

    const existingResult = await client.query(
      `SELECT request_hash, status, response_status_code, response_body,
              locked_until
       FROM idempotency_keys
       WHERE user_id = $1
         AND endpoint = $2
         AND idempotency_key = $3
       FOR UPDATE`,
      [userId, ENDPOINT, idempotencyKey],
    );
    const resolution = resolveIdempotency(existingResult.rows[0] ?? null, hash);
    if (resolution?.replayed) {
      await client.query('COMMIT');
      return resolution;
    }

    const openClaim = await client.query(
      `SELECT id
       FROM restaurant_claims
       WHERE merchant_id = $1
         AND restaurant_id = $2
         AND status IN ('SUBMITTED', 'UNDER_REVIEW')
       LIMIT 1`,
      [merchant.id, restaurantId],
    );
    if (openClaim.rowCount > 0) {
      throw createHttpError(
        409,
        'RESTAURANT_CLAIM_ALREADY_OPEN',
        'An open claim already exists for this restaurant.',
      );
    }

    let leaseUntil;
    if (resolution?.retryable) {
      const refreshed = await client.query(
        `UPDATE idempotency_keys
         SET status = 'IN_PROGRESS',
             response_status_code = NULL,
             response_body = NULL,
             resource_type = NULL,
             resource_id = NULL,
             locked_until = date_trunc('milliseconds', NOW()) + ($5 || ' minutes')::interval,
             expires_at = NOW() + ($6 || ' hours')::interval
         WHERE user_id = $1
           AND endpoint = $2
           AND idempotency_key = $3
           AND request_hash = $4
         RETURNING locked_until`,
        [
          userId,
          ENDPOINT,
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
          ENDPOINT,
          hash,
          IDEMPOTENCY_LOCK_MINUTES,
          IDEMPOTENCY_TTL_HOURS,
        ],
      );
      leaseUntil = created.rows[0].locked_until;
    }

    await client.query('COMMIT');
    return {
      merchantId: merchant.id,
      leaseUntil,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function markClaimFailed({
  userId,
  idempotencyKey,
  hash,
  leaseUntil,
}) {
  try {
    await pool.query(
      `UPDATE idempotency_keys
       SET status = 'FAILED',
           locked_until = NULL
       WHERE user_id = $1
         AND endpoint = $2
         AND idempotency_key = $3
         AND request_hash = $4
         AND locked_until = $5
         AND status = 'IN_PROGRESS'`,
      [userId, ENDPOINT, idempotencyKey, hash, leaseUntil],
    );
  } catch {
    // Preserve the original provider or persistence error.
  }
}

async function persistClaim({
  userId,
  merchantId,
  restaurantId,
  requestedPermissionLevel,
  evidenceReference,
  idempotencyKey,
  hash,
  leaseUntil,
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
      [userId, ENDPOINT, idempotencyKey, hash, leaseUntil],
    );
    if (attempt.rowCount === 0) {
      throw createHttpError(409, 'REQUEST_IN_PROGRESS', 'The claim attempt was superseded.');
    }

    const inserted = await client.query(
      `INSERT INTO restaurant_claims (
         merchant_id,
         restaurant_id,
         status,
         evidence_url,
         requested_permission_level
       )
       VALUES ($1, $2, 'SUBMITTED', $3, $4)
       RETURNING *`,
      [merchantId, restaurantId, evidenceReference, requestedPermissionLevel],
    );
    const body = mapClaimRow(inserted.rows[0]);

    await client.query(
      `INSERT INTO audit_logs (
         actor_id,
         actor_role,
         action,
         entity_type,
         entity_id,
         metadata
       )
       VALUES ($1, 'MERCHANT', 'RESTAURANT_CLAIM_SUBMITTED', 'RESTAURANT_CLAIM', $2, $3::jsonb)`,
      [
        userId,
        body.id,
        JSON.stringify({ restaurantId, requestedPermissionLevel }),
      ],
    );
    const completed = await client.query(
      `UPDATE idempotency_keys
       SET status = 'COMPLETED',
           response_status_code = 201,
           response_body = $6::jsonb,
           resource_type = 'RESTAURANT_CLAIM',
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
        ENDPOINT,
        idempotencyKey,
        hash,
        leaseUntil,
        JSON.stringify(body),
        body.id,
      ],
    );
    if (completed.rowCount !== 1) {
      throw createHttpError(409, 'REQUEST_IN_PROGRESS', 'The claim attempt was superseded.');
    }

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

export async function submitRestaurantClaim({
  userId,
  restaurantId,
  requestedPermissionLevel,
  idempotencyKey,
  file,
}) {
  validateIdempotencyKey(idempotencyKey);
  if (!UUID_REGEX.test(restaurantId ?? '')) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'restaurantId must be a valid UUID.');
  }
  const permission = normalizePermission(requestedPermissionLevel);
  validateEvidence(file);
  const hash = requestHash({
    userId,
    restaurantId,
    requestedPermissionLevel: permission,
    file,
  });
  const prepared = await prepareClaim({
    userId,
    restaurantId,
    idempotencyKey,
    hash,
  });
  if (prepared.replayed) {
    return {
      ...prepared,
      body: await toClaimResponse(prepared.body),
    };
  }

  const key = buildMerchantClaimObjectKey({
    merchantId: prepared.merchantId,
    restaurantId,
    contentType: file.mimetype,
  });
  let uploaded;
  try {
    uploaded = await uploadMerchantClaimObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });
  } catch (err) {
    await deleteMerchantClaimObject({ key });
    await markClaimFailed({
      userId,
      idempotencyKey,
      hash,
      leaseUntil: prepared.leaseUntil,
    });
    throw err;
  }

  try {
    const body = await persistClaim({
      userId,
      merchantId: prepared.merchantId,
      restaurantId,
      requestedPermissionLevel: permission,
      evidenceReference: uploaded.evidenceReference,
      idempotencyKey,
      hash,
      leaseUntil: prepared.leaseUntil,
    });
    return {
      statusCode: 201,
      body: await toClaimResponse(body),
      replayed: false,
    };
  } catch (err) {
    if (!err.commitOutcomeAmbiguous) {
      await deleteMerchantClaimObject({ key: uploaded.objectKey });
      await markClaimFailed({
        userId,
        idempotencyKey,
        hash,
        leaseUntil: prepared.leaseUntil,
      });
    }
    if (err.code === '23505' && err.constraint === 'idx_restaurant_claims_open_unique') {
      throw createHttpError(
        409,
        'RESTAURANT_CLAIM_ALREADY_OPEN',
        'An open claim already exists for this restaurant.',
      );
    }
    throw err;
  }
}

export async function listMerchantClaims({ userId }) {
  const client = await pool.connect();
  let rows;
  try {
    const merchant = await getMerchantForClaim(client, userId);
    const result = await client.query(
      `SELECT
         rc.*,
         r.name AS restaurant_name
       FROM restaurant_claims rc
       JOIN restaurants r ON r.id = rc.restaurant_id
       WHERE rc.merchant_id = $1
       ORDER BY rc.created_at DESC, rc.id DESC`,
      [merchant.id],
    );
    rows = result.rows;
  } finally {
    client.release();
  }

  return {
    items: await Promise.all(rows.map((row) => toClaimResponse(mapClaimRow(row)))),
  };
}

export async function listMerchantRestaurants({ userId }) {
  const client = await pool.connect();
  let rows;
  try {
    const merchant = await getMerchantForClaim(client, userId);
    const result = await client.query(
      `SELECT
         r.id,
         r.name,
         r.slug,
         r.address,
         r.status,
         rm.permission_level,
         rm.status AS assignment_status,
         primary_image.image_url AS primary_image_reference
       FROM restaurant_merchants rm
       JOIN restaurants r ON r.id = rm.restaurant_id
       LEFT JOIN LATERAL (
         SELECT ri.image_url
         FROM restaurant_images ri
         WHERE ri.restaurant_id = r.id
           AND ri.branch_id IS NULL
           AND ri.is_primary = TRUE
         ORDER BY ri.created_at DESC, ri.id DESC
         LIMIT 1
       ) primary_image ON TRUE
       WHERE rm.merchant_id = $1
         AND rm.status = 'ACTIVE'
         AND r.is_deleted = FALSE
       ORDER BY r.name ASC, r.id ASC`,
      [merchant.id],
    );
    rows = result.rows;
  } finally {
    client.release();
  }

  return {
    items: await Promise.all(rows.map(async (row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      address: row.address,
      status: row.status,
      permissionLevel: row.permission_level,
      assignmentStatus: row.assignment_status,
      primaryImageUrl: await resolveRestaurantImageUrl(row.primary_image_reference),
    }))),
  };
}

export async function listAdminRestaurantClaims({ status }) {
  const normalizedStatus = status ? String(status).trim().toUpperCase() : null;
  if (normalizedStatus && !CLAIM_STATUSES.has(normalizedStatus)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'status is invalid.');
  }
  const values = [];
  const where = [];
  if (normalizedStatus) {
    values.push(normalizedStatus);
    where.push(`rc.status = $${values.length}`);
  }
  const result = await pool.query(
    `SELECT
       rc.*,
       r.name AS restaurant_name,
       m.user_id AS merchant_user_id,
       m.business_name,
       u.display_name AS merchant_name
     FROM restaurant_claims rc
     JOIN restaurants r ON r.id = rc.restaurant_id
     JOIN merchants m ON m.id = rc.merchant_id
     JOIN users u ON u.id = m.user_id
     ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY
       CASE rc.status
         WHEN 'SUBMITTED' THEN 0
         WHEN 'UNDER_REVIEW' THEN 1
         ELSE 2
       END,
       rc.created_at ASC,
       rc.id ASC`,
    values,
  );
  return {
    items: await Promise.all(result.rows.map((row) => toClaimResponse(mapClaimRow(row)))),
  };
}

export async function listAdminRestaurants({
  keyword = '',
  page = 1,
  pageSize = 50,
}) {
  const normalizedKeyword = String(keyword ?? '').trim();
  const normalizedPage = Number(page);
  const normalizedPageSize = Number(pageSize);
  if (!Number.isInteger(normalizedPage) || normalizedPage < 1) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'page must be a positive integer.');
  }
  if (!Number.isInteger(normalizedPageSize) || normalizedPageSize < 1 || normalizedPageSize > 100) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'pageSize must be between 1 and 100.');
  }
  if (normalizedKeyword.length > 120) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'keyword must be at most 120 characters.');
  }

  const values = [];
  const where = ['r.is_deleted = FALSE'];
  if (normalizedKeyword) {
    values.push(`%${normalizedKeyword}%`);
    where.push(`(r.name ILIKE $${values.length} OR r.address ILIKE $${values.length})`);
  }
  const countResult = await pool.query(
    `SELECT COUNT(*)::integer AS total
     FROM restaurants r
     WHERE ${where.join(' AND ')}`,
    values,
  );
  values.push(normalizedPageSize);
  const limitIndex = values.length;
  values.push((normalizedPage - 1) * normalizedPageSize);
  const offsetIndex = values.length;
  const result = await pool.query(
    `SELECT
       r.id,
       r.name,
       r.slug,
       r.address,
       r.status,
       r.trust_score,
       primary_image.image_url AS primary_image_reference
     FROM restaurants r
     LEFT JOIN LATERAL (
       SELECT ri.image_url
       FROM restaurant_images ri
       WHERE ri.restaurant_id = r.id
         AND ri.branch_id IS NULL
         AND ri.is_primary = TRUE
       ORDER BY ri.created_at DESC, ri.id DESC
       LIMIT 1
     ) primary_image ON TRUE
     WHERE ${where.join(' AND ')}
     ORDER BY r.name ASC, r.id ASC
     LIMIT $${limitIndex}
     OFFSET $${offsetIndex}`,
    values,
  );
  return {
    items: await Promise.all(result.rows.map(async (row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      address: row.address,
      status: row.status,
      trustScore: row.trust_score == null ? null : Number(row.trust_score),
      primaryImageUrl: await resolveRestaurantImageUrl(row.primary_image_reference),
    }))),
    page: normalizedPage,
    pageSize: normalizedPageSize,
    total: countResult.rows[0].total,
  };
}

function adminActorRole(roles = []) {
  const normalized = roles.map((role) => String(role).trim().toUpperCase());
  return normalized.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : 'ADMIN';
}

export async function decideRestaurantClaim({
  adminUserId,
  roles,
  claimId,
  decision,
  adminNote,
}) {
  if (!UUID_REGEX.test(claimId ?? '')) {
    throw createHttpError(400, 'VALIDATION_ERROR', 'claimId must be a valid UUID.');
  }
  const normalizedDecision = String(decision ?? '').trim().toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(normalizedDecision)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'decision must be APPROVED or REJECTED.');
  }
  const normalizedNote = adminNote == null ? null : String(adminNote).trim();
  if (normalizedNote && normalizedNote.length > 1000) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'adminNote must be at most 1000 characters.');
  }
  if (normalizedDecision === 'REJECTED' && !normalizedNote) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'adminNote is required when rejecting a claim.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const claimResult = await client.query(
      `SELECT rc.*, m.user_id AS merchant_user_id
       FROM restaurant_claims rc
       JOIN merchants m ON m.id = rc.merchant_id
       WHERE rc.id = $1
       FOR UPDATE OF rc, m`,
      [claimId],
    );
    if (claimResult.rowCount === 0) {
      throw createHttpError(404, 'RESTAURANT_CLAIM_NOT_FOUND', 'Restaurant claim not found.');
    }
    const claim = claimResult.rows[0];
    if (['APPROVED', 'REJECTED'].includes(claim.status)) {
      if (claim.status !== normalizedDecision) {
        throw createHttpError(
          409,
          'RESTAURANT_CLAIM_ALREADY_DECIDED',
          'Restaurant claim already has a different decision.',
        );
      }
      await client.query('COMMIT');
      return toClaimResponse(mapClaimRow(claim));
    }

    const updated = await client.query(
      `UPDATE restaurant_claims
       SET status = $2,
           admin_note = $3,
           decided_by = $4,
           decided_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [claimId, normalizedDecision, normalizedNote, adminUserId],
    );

    if (normalizedDecision === 'APPROVED') {
      await client.query(
        `UPDATE merchants
         SET status = 'ACTIVE',
             verified_at = COALESCE(verified_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [claim.merchant_id],
      );
      await client.query(
        `INSERT INTO roles (id, label)
         VALUES ('MERCHANT', 'MERCHANT')
         ON CONFLICT (id) DO NOTHING`,
      );
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, 'MERCHANT')
         ON CONFLICT DO NOTHING`,
        [claim.merchant_user_id],
      );
      await client.query(
        `INSERT INTO restaurant_merchants (
           restaurant_id,
           merchant_id,
           permission_level,
           status
         )
         VALUES ($1, $2, $3, 'ACTIVE')
         ON CONFLICT (restaurant_id, merchant_id) DO UPDATE
         SET permission_level = EXCLUDED.permission_level,
             status = 'ACTIVE',
             assigned_at = NOW()`,
        [
          claim.restaurant_id,
          claim.merchant_id,
          claim.requested_permission_level,
        ],
      );
    }

    await client.query(
      `INSERT INTO audit_logs (
         actor_id,
         actor_role,
         action,
         entity_type,
         entity_id,
         previous_status,
         new_status,
         reason,
         metadata
       )
       VALUES ($1, $2, 'RESTAURANT_CLAIM_DECIDED', 'RESTAURANT_CLAIM', $3, $4, $5, $6, $7::jsonb)`,
      [
        adminUserId,
        adminActorRole(roles),
        claimId,
        claim.status,
        normalizedDecision,
        normalizedNote,
        JSON.stringify({
          merchantId: claim.merchant_id,
          restaurantId: claim.restaurant_id,
          requestedPermissionLevel: claim.requested_permission_level,
        }),
      ],
    );

    await client.query('COMMIT');
    return toClaimResponse(mapClaimRow({
      ...updated.rows[0],
      merchant_user_id: claim.merchant_user_id,
    }));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
