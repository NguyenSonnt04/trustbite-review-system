import crypto from 'node:crypto';
import { BILL_SCAN_PRICE_TOLERANCE_VND } from '../config/antiFraud.js';
import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';
import { bedrockGemmaProvider } from './providers/bedrockGemmaProvider.js';
import { textractOcrProvider } from './providers/textractProvider.js';
import {
  buildBillScanObjectKey,
  deleteBillScanObject,
  deleteBillScanObjectStrict,
  uploadBillScanObject,
} from './s3BillScanStorageService.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PROCESSING_LEASE_MINUTES = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_EXTENSIONS = {
  'image/jpeg': new Set(['jpg', 'jpeg']),
  'image/png': new Set(['png']),
};

function detail(field, code, message) {
  return { field, code, message };
}

function fileExtension(filename = '') {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts.at(-1) : '';
}

function hasValidMagicBytes(file) {
  if (!Buffer.isBuffer(file?.buffer)) return false;
  if (file.mimetype === 'image/jpeg') {
    return file.buffer.length >= 3
      && file.buffer[0] === 0xff
      && file.buffer[1] === 0xd8
      && file.buffer[2] === 0xff;
  }
  if (file.mimetype === 'image/png') {
    return file.buffer.length >= 8
      && file.buffer.subarray(0, 8).equals(Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]));
  }
  return false;
}

function validateCreateInput({ restaurantId, branchId, idempotencyKey, file }) {
  if (!idempotencyKey) {
    throw createHttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.');
  }
  if (typeof idempotencyKey !== 'string' || !UUID_V4_RE.test(idempotencyKey)) {
    throw createHttpError(400, 'IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key must be a UUID v4.');
  }

  const details = [];
  if (typeof restaurantId !== 'string' || !UUID_RE.test(restaurantId)) {
    details.push(detail('restaurantId', 'INVALID_UUID', 'restaurantId must be a valid UUID.'));
  }
  if (typeof branchId !== 'string' || !UUID_RE.test(branchId)) {
    details.push(detail('branchId', 'INVALID_UUID', 'branchId must be a valid UUID.'));
  }
  if (details.length > 0) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'Bill scan payload is invalid.', details);
  }

  if (!file) {
    throw createHttpError(400, 'VALIDATION_ERROR', 'receiptImage is required.', [
      detail('receiptImage', 'REQUIRED', 'receiptImage is required.'),
    ]);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw createHttpError(413, 'FILE_TOO_LARGE', 'Receipt image must be 10MB or smaller.');
  }
  const extensions = ALLOWED_EXTENSIONS[file.mimetype];
  if (
    !extensions
    || !extensions.has(fileExtension(file.originalname))
    || !hasValidMagicBytes(file)
  ) {
    throw createHttpError(415, 'UNSUPPORTED_FILE_TYPE', 'Receipt image must be JPG or PNG.');
  }
}

function requestHash({ userId, restaurantId, branchId, fileHash }) {
  return crypto.createHash('sha256').update(JSON.stringify({
    userId,
    restaurantId,
    branchId,
    fileHash,
  })).digest('hex');
}

function numberOrNull(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dateOrNull(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapScanDto(scanRow, itemRows = []) {
  return {
    id: scanRow.id,
    status: scanRow.status,
    overallResult: scanRow.overall_result,
    restaurant: {
      id: scanRow.restaurant_id,
      name: scanRow.restaurant_name,
    },
    branch: {
      id: scanRow.branch_id,
      restaurantId: scanRow.restaurant_id,
      name: scanRow.branch_name,
      address: scanRow.branch_address,
      area: null,
      latitude: numberOrNull(scanRow.branch_latitude),
      longitude: numberOrNull(scanRow.branch_longitude),
    },
    items: itemRows.map((row) => ({
      lineIndex: row.line_index,
      observedName: row.observed_name,
      observedQuantity: numberOrNull(row.observed_quantity),
      observedUnitPrice: numberOrNull(row.observed_unit_price),
      observedTotalPrice: numberOrNull(row.observed_total_price),
      menuItem: row.menu_item_id ? {
        id: row.menu_item_id,
        name: row.menu_item_name,
      } : null,
      expectedUnitPrice: numberOrNull(row.expected_unit_price),
      priceDifference: numberOrNull(row.price_difference),
      mappingConfidence: numberOrNull(row.mapping_confidence),
      result: row.result,
    })),
    createdAt: dateOrNull(scanRow.created_at),
    completedAt: dateOrNull(scanRow.completed_at),
  };
}

export function compareBillScanLine({
  observedUnitPrice,
  menuItemId,
  expectedUnitPrice,
}) {
  if (observedUnitPrice === null || observedUnitPrice === undefined
    || expectedUnitPrice === null || expectedUnitPrice === undefined) {
    return {
      priceDifference: null,
      result: 'INCONCLUSIVE',
    };
  }
  const observed = Number(observedUnitPrice);
  const expected = Number(expectedUnitPrice);
  if (!menuItemId || !Number.isFinite(observed) || !Number.isFinite(expected)) {
    return {
      priceDifference: null,
      result: 'INCONCLUSIVE',
    };
  }

  const priceDifference = Math.abs(observed - expected);
  return {
    priceDifference,
    result: priceDifference > BILL_SCAN_PRICE_TOLERANCE_VND
      ? 'PRICE_MISMATCH'
      : 'MATCHED',
  };
}

export function overallBillScanResult(items) {
  if (items.some((item) => item.result === 'PRICE_MISMATCH')) return 'PRICE_MISMATCH';
  if (items.some((item) => item.result === 'INCONCLUSIVE')) return 'INCONCLUSIVE';
  return 'MATCHED';
}

async function loadScanDto(client, scanId, userId) {
  const scanResult = await client.query(
    `SELECT bs.id,
            bs.status,
            bs.overall_result,
            bs.restaurant_id,
            bs.branch_id,
            bs.created_at,
            bs.completed_at,
            r.name AS restaurant_name,
            rb.name AS branch_name,
            rb.address AS branch_address,
            rb.latitude AS branch_latitude,
            rb.longitude AS branch_longitude
     FROM bill_scans bs
     JOIN restaurants r ON r.id = bs.restaurant_id
     JOIN restaurant_branches rb ON rb.id = bs.branch_id
     WHERE bs.id = $1
       AND bs.user_id = $2`,
    [scanId, userId],
  );
  if (scanResult.rowCount === 0) return null;

  const items = await client.query(
    `SELECT li.line_index,
            li.observed_name,
            li.observed_quantity,
            li.observed_unit_price,
            li.observed_total_price,
            li.menu_item_id,
            mi.name AS menu_item_name,
            li.expected_unit_price,
            li.price_difference,
            li.mapping_confidence,
            li.result
     FROM bill_scan_line_items li
     LEFT JOIN menu_items mi ON mi.id = li.menu_item_id
     WHERE li.bill_scan_id = $1
     ORDER BY li.line_index`,
    [scanId],
  );
  return mapScanDto(scanResult.rows[0], items.rows);
}

async function markScanFailed(scanId, attemptToken, providerErrorCode) {
  try {
    await pool.query(
      `UPDATE bill_scans
       SET status = 'FAILED',
           provider_error_code = $2,
           completed_at = NOW(),
           processing_attempt_token = NULL,
           processing_lease_expires_at = NULL
       WHERE id = $1
         AND status = 'PROCESSING'
         AND processing_attempt_token = $3`,
      [scanId, providerErrorCode, attemptToken],
    );
  } catch {
    // Preserve the original safe provider/persistence error.
  }
}

function attemptSupersededError() {
  return createHttpError(
    409,
    'BILL_SCAN_ATTEMPT_SUPERSEDED',
    'This bill scan attempt was superseded by a newer retry.',
  );
}

async function expireAttemptLease(scanId, attemptToken) {
  try {
    await pool.query(
      `UPDATE bill_scans
       SET processing_lease_expires_at = NOW()
       WHERE id = $1
         AND status = 'PROCESSING'
         AND processing_attempt_token = $2`,
      [scanId, attemptToken],
    );
  } catch {
    // Preserve the original cleanup error.
  }
}

function safeProviderError(error) {
  if (
    error?.code === 'PROVIDER_UNAVAILABLE'
    || error?.code === 'BILL_SCAN_PROVIDER_FAILED'
  ) {
    return createHttpError(503, error.code, 'Bill scan processing failed.');
  }
  return createHttpError(503, 'BILL_SCAN_PROVIDER_FAILED', 'Bill scan processing failed.');
}

export async function getBillScan({ scanId, userId }) {
  if (typeof scanId !== 'string' || !UUID_RE.test(scanId)) {
    throw createHttpError(400, 'VALIDATION_ERROR', 'scanId must be a valid UUID.');
  }
  const dto = await loadScanDto(pool, scanId, userId);
  if (!dto) {
    throw createHttpError(404, 'BILL_SCAN_NOT_FOUND', 'Bill scan not found.');
  }
  return dto;
}

export async function createBillScan({
  userId,
  restaurantId,
  branchId,
  idempotencyKey,
  file,
  ocrProvider = textractOcrProvider,
  nameMappingProvider = bedrockGemmaProvider,
  storage = {
    buildObjectKey: buildBillScanObjectKey,
    uploadObject: uploadBillScanObject,
    deleteObject: deleteBillScanObject,
    deleteObjectStrict: deleteBillScanObjectStrict,
  },
}) {
  validateCreateInput({ restaurantId, branchId, idempotencyKey, file });
  const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const hash = requestHash({ userId, restaurantId, branchId, fileHash });
  let scanId;
  let attemptToken = crypto.randomUUID();
  let staleFileUrl = null;

  const client = await pool.connect();
  let clientReleased = false;
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const existing = await client.query(
      `SELECT id,
              request_hash,
              status,
              provider_error_code,
              file_url,
              processing_attempt_token,
              processing_lease_expires_at,
              processing_lease_expires_at <= NOW() AS processing_lease_expired
       FROM bill_scans
       WHERE user_id = $1
         AND idempotency_key = $2
       FOR UPDATE`,
      [userId, idempotencyKey],
    );
    if (existing.rowCount > 0) {
      const row = existing.rows[0];
      if (row.request_hash !== hash) {
        throw createHttpError(
          409,
          'IDEMPOTENCY_CONFLICT',
          'Idempotency-Key was already used with a different payload.',
        );
      }
      if (row.status === 'COMPLETED') {
        const body = await loadScanDto(client, row.id, userId);
        await client.query('COMMIT');
        transactionOpen = false;
        return { statusCode: 201, body, replayed: true };
      }
      if (row.status === 'FAILED') {
        throw createHttpError(
          503,
          row.provider_error_code || 'BILL_SCAN_PROVIDER_FAILED',
          'Bill scan processing failed.',
        );
      }
      if (!row.processing_lease_expired) {
        throw createHttpError(409, 'REQUEST_IN_PROGRESS', 'This bill scan is still processing.');
      }

      const takeover = await client.query(
        `UPDATE bill_scans
         SET processing_attempt_token = $3,
             processing_lease_expires_at = NOW() + ($4 * interval '1 minute'),
             provider_error_code = NULL,
             completed_at = NULL
         WHERE id = $1
           AND processing_attempt_token = $2
           AND status = 'PROCESSING'
           AND processing_lease_expires_at <= NOW()
         RETURNING id`,
        [
          row.id,
          row.processing_attempt_token,
          attemptToken,
          PROCESSING_LEASE_MINUTES,
        ],
      );
      if (takeover.rowCount !== 1) {
        throw createHttpError(409, 'REQUEST_IN_PROGRESS', 'This bill scan is still processing.');
      }
      await client.query(
        'DELETE FROM bill_scan_line_items WHERE bill_scan_id = $1',
        [row.id],
      );
      scanId = row.id;
      staleFileUrl = row.file_url;
    }

    const branch = await client.query(
      `SELECT rb.id
       FROM restaurant_branches rb
       JOIN restaurants r ON r.id = rb.parent_restaurant_id
       WHERE rb.id = $1
         AND rb.parent_restaurant_id = $2
         AND rb.status = 'ACTIVE'
         AND r.status = 'ACTIVE'
         AND r.is_deleted = FALSE`,
      [branchId, restaurantId],
    );
    if (branch.rowCount === 0) {
      throw createHttpError(
        422,
        'BRANCH_RESTAURANT_MISMATCH',
        'branchId must identify an active branch of the selected restaurant.',
      );
    }

    const menu = await client.query(
      `SELECT mi.id, mi.name, bmi.price
       FROM branch_menu_items bmi
       JOIN menu_items mi
         ON mi.id = bmi.menu_item_id
        AND mi.restaurant_id = $2
        AND mi.status = 'ACTIVE'
       WHERE bmi.branch_id = $1
         AND bmi.is_available = TRUE
       ORDER BY mi.name, mi.id`,
      [branchId, restaurantId],
    );
    if (menu.rowCount === 0) {
      throw createHttpError(422, 'BRANCH_MENU_UNAVAILABLE', 'The selected branch has no available menu items.');
    }

    if (!scanId) {
      const inserted = await client.query(
        `INSERT INTO bill_scans (
         user_id,
         restaurant_id,
         branch_id,
         idempotency_key,
         request_hash,
         file_hash_sha256,
         mime_type,
         file_size_bytes,
         status,
         processing_attempt_token,
         processing_lease_expires_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, 'PROCESSING',
         $9, NOW() + ($10 * interval '1 minute')
       )
       RETURNING id`,
        [
          userId,
          restaurantId,
          branchId,
          idempotencyKey,
          hash,
          fileHash,
          file.mimetype,
          file.size,
          attemptToken,
          PROCESSING_LEASE_MINUTES,
        ],
      );
      scanId = inserted.rows[0].id;
    }
    await client.query('COMMIT');
    transactionOpen = false;
    client.release();
    clientReleased = true;

    if (staleFileUrl) {
      try {
        await storage.deleteObjectStrict({ fileUrl: staleFileUrl });
        const cleared = await pool.query(
          `UPDATE bill_scans
           SET file_url = NULL
           WHERE id = $1
             AND status = 'PROCESSING'
             AND processing_attempt_token = $2`,
          [scanId, attemptToken],
        );
        if (cleared.rowCount !== 1) throw attemptSupersededError();
      } catch (error) {
        await expireAttemptLease(scanId, attemptToken);
        if (error?.code === 'BILL_SCAN_ATTEMPT_SUPERSEDED') throw error;
        throw safeProviderError(error);
      }
    }

    const menuItems = menu.rows.map((row) => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
    }));
    let fileUrl;
    let uploadedObjectNeedsCompensation = false;
    try {
      const key = storage.buildObjectKey({
        userId,
        scanId,
        contentType: file.mimetype,
      });
      fileUrl = await storage.uploadObject({
        key,
        body: file.buffer,
        contentType: file.mimetype,
      });
      uploadedObjectNeedsCompensation = true;
      const storedUpload = await pool.query(
        `UPDATE bill_scans
         SET file_url = $2
         WHERE id = $1
           AND status = 'PROCESSING'
           AND processing_attempt_token = $3`,
        [scanId, fileUrl, attemptToken],
      );
      if (storedUpload.rowCount !== 1) {
        await storage.deleteObject({ fileUrl });
        uploadedObjectNeedsCompensation = false;
        throw attemptSupersededError();
      }
      uploadedObjectNeedsCompensation = false;

      let ocr;
      try {
        ocr = await ocrProvider.analyzeExpense({
          fileUrl,
          bytes: file.buffer,
        });
      } catch {
        throw createHttpError(503, 'BILL_SCAN_PROVIDER_FAILED', 'Bill scan processing failed.');
      }
      const lines = Array.isArray(ocr?.lineItems) ? ocr.lineItems : [];
      if (lines.length === 0) {
        throw createHttpError(503, 'BILL_SCAN_PROVIDER_FAILED', 'Bill scan processing failed.');
      }
      const mappings = await nameMappingProvider.mapNames({ lines, menuItems });
      const mappingByLineIndex = new Map(
        mappings.map((mapping) => [mapping.lineIndex, mapping]),
      );
      const menuById = new Map(menuItems.map((item) => [item.id, item]));
      const normalizedItems = lines.map((line, lineIndex) => {
        const mapping = mappingByLineIndex.get(lineIndex);
        const menuItem = mapping?.menuItemId ? menuById.get(mapping.menuItemId) : null;
        const comparison = compareBillScanLine({
          observedUnitPrice: line.unitPrice,
          menuItemId: menuItem?.id ?? null,
          expectedUnitPrice: menuItem?.price ?? null,
        });
        return {
          lineIndex,
          observedName: String(line.name).trim().slice(0, 200),
          observedQuantity: numberOrNull(line.quantity),
          observedUnitPrice: numberOrNull(line.unitPrice),
          observedTotalPrice: numberOrNull(line.totalPrice),
          menuItemId: menuItem?.id ?? null,
          expectedUnitPrice: menuItem?.price ?? null,
          priceDifference: comparison.priceDifference,
          mappingConfidence: mapping?.confidence ?? null,
          result: comparison.result,
        };
      });
      const overallResult = overallBillScanResult(normalizedItems);

      const persistClient = await pool.connect();
      try {
        await persistClient.query('BEGIN');
        const ownedAttempt = await persistClient.query(
          `SELECT id
           FROM bill_scans
           WHERE id = $1
             AND status = 'PROCESSING'
             AND processing_attempt_token = $2
           FOR UPDATE`,
          [scanId, attemptToken],
        );
        if (ownedAttempt.rowCount !== 1) throw attemptSupersededError();

        for (const item of normalizedItems) {
          await persistClient.query(
            `INSERT INTO bill_scan_line_items (
               bill_scan_id,
               line_index,
               observed_name,
               observed_quantity,
               observed_unit_price,
               observed_total_price,
               menu_item_id,
               expected_unit_price,
               price_difference,
               mapping_confidence,
               result
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              scanId,
              item.lineIndex,
              item.observedName,
              item.observedQuantity,
              item.observedUnitPrice,
              item.observedTotalPrice,
              item.menuItemId,
              item.expectedUnitPrice,
              item.priceDifference,
              item.mappingConfidence,
              item.result,
            ],
          );
        }
        const completed = await persistClient.query(
          `UPDATE bill_scans
           SET status = 'COMPLETED',
               overall_result = $2,
               completed_at = NOW(),
               processing_attempt_token = NULL,
               processing_lease_expires_at = NULL
           WHERE id = $1
             AND status = 'PROCESSING'
             AND processing_attempt_token = $3`,
          [scanId, overallResult, attemptToken],
        );
        if (completed.rowCount !== 1) throw attemptSupersededError();
        const body = await loadScanDto(persistClient, scanId, userId);
        await persistClient.query('COMMIT');
        return { statusCode: 201, body, replayed: false };
      } catch (error) {
        await persistClient.query('ROLLBACK');
        await storage.deleteObject({ fileUrl });
        throw error;
      } finally {
        persistClient.release();
      }
    } catch (error) {
      if (uploadedObjectNeedsCompensation && fileUrl) {
        await storage.deleteObject({ fileUrl });
      }
      if (error?.code === 'BILL_SCAN_ATTEMPT_SUPERSEDED') {
        throw error;
      }
      const safeError = safeProviderError(error);
      await markScanFailed(scanId, attemptToken, safeError.code);
      throw safeError;
    }
  } catch (error) {
    if (transactionOpen) {
      await client.query('ROLLBACK').catch(() => {});
      transactionOpen = false;
    }
    if (
      error?.code === '23505'
      && error?.constraint === 'bill_scans_user_id_idempotency_key_key'
    ) {
      throw createHttpError(409, 'REQUEST_IN_PROGRESS', 'This bill scan is still processing.');
    }
    throw error;
  } finally {
    if (!clientReleased) client.release();
  }
}
