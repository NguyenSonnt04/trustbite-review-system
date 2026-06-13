/**
 * ocrService.js — receipt OCR pipeline (Task 4.3).
 *
 * Drives a receipt through Status_Mapping §4.3:
 *   UPLOADED -> HASH_CHECKING -> (DUPLICATE_DETECTED ->) OCR_PROCESSING
 *            -> OCR_SUCCESS | OCR_FAILED
 *
 * Layer-1 file-hash duplicate (Anti-Fraud §7.1) is a hard rule checked BEFORE
 * OCR using the stored file_hash_sha256 (computed at upload); a collision rejects
 * the receipt and raises a DUPLICATE_RECEIPT_HASH fraud flag. On OCR success the
 * extracted fields + line items are written in one transaction, then Task 4.4's
 * verifyReceipt() runs the fraud decision. All AWS access is via the injected
 * provider; this service never instantiates a provider client.
 */

import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { getOcrConfig } from '../config/ocr.js';
import { validateReceiptFile } from './providers/ocrMapping.js';
import { verifyReceipt, NotFoundError } from './receiptVerificationService.js';

export { NotFoundError };

const TERMINAL_RECEIPT_STATUSES = new Set(['VERIFIED', 'REJECTED', 'REFERENCE_ONLY', 'PENDING_ADMIN_REVIEW']);

function terminalResult(receipt) {
  return { status: receipt.status, skipped: true, reason: 'Receipt already has a terminal OCR decision.' };
}

async function loadReceipt(receiptVerificationId) {
  const loaded = await pool.query(`SELECT * FROM receipt_verifications WHERE id = $1`, [receiptVerificationId]);
  if (loaded.rows.length === 0) throw new NotFoundError('Receipt verification not found.');
  return loaded.rows[0];
}

export function computeFileHash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function setStatus(client, receiptId, status) {
  await client.query(`UPDATE receipt_verifications SET status = $2 WHERE id = $1`, [receiptId, status]);
}

async function writeAudit(client, { receiptId, previousStatus, newStatus, reason, metadata = {} }) {
  await client.query(
    `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, previous_status, new_status, reason, metadata)
     VALUES (NULL, 'SYSTEM', $1, 'RECEIPT_VERIFICATION', $2, $3, $4, $5, $6)`,
    ['RECEIPT_OCR', receiptId, previousStatus, newStatus, reason, JSON.stringify(metadata)],
  );
}

async function rejectAsDuplicate(client, receipt) {
  const reason = 'Duplicate receipt file hash (layer-1 hard rule).';

  await client.query(
    `UPDATE receipt_verifications
     SET status = 'REJECTED', decision = 'REJECTED', fraud_risk_score = 100,
         decision_reason = $2, decided_at = NOW()
     WHERE id = $1`,
    [receipt.id, reason],
  );

  await client.query(
    `UPDATE reviews
     SET status = 'REJECTED', verification_status = 'DUPLICATE_REJECTED',
         trust_label = 'REJECTED', public_visibility = 'PRIVATE', trust_weight_bucket = 'NONE'
     WHERE id = $1`,
    [receipt.review_id],
  );

  const flag = await client.query(
    `INSERT INTO fraud_flags (flag_code, risk_score, status) VALUES ('DUPLICATE_RECEIPT_HASH', 100, 'OPEN') RETURNING id`,
  );
  const flagId = flag.rows[0].id;
  const entities = [
    ['RECEIPT_VERIFICATION', receipt.id],
    ['REVIEW', receipt.review_id],
  ];
  if (receipt.user_id) entities.push(['USER', receipt.user_id]);
  for (const [type, id] of entities) {
    await client.query(
      `INSERT INTO fraud_flag_entities (fraud_flag_id, entity_type, entity_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [flagId, type, id],
    );
  }

  await writeAudit(client, {
    receiptId: receipt.id,
    previousStatus: 'DUPLICATE_DETECTED',
    newStatus: 'REJECTED',
    reason,
  });
}

async function persistOcrResult(client, receipt, struct) {
  await client.query(
    `UPDATE receipt_verifications
     SET status = 'OCR_SUCCESS',
         ocr_text = $2,
         ocr_restaurant_name = $3,
         ocr_receipt_time = $4,
         ocr_invoice_no = $5,
         ocr_total_amount = $6
     WHERE id = $1`,
    [
      receipt.id,
      struct.rawText ?? null,
      struct.restaurantName ?? null,
      struct.receiptTime ?? null,
      struct.invoiceNo ?? null,
      struct.totalAmount ?? null,
    ],
  );

  await client.query('DELETE FROM receipt_line_items WHERE receipt_verification_id = $1', [receipt.id]);

  const items = Array.isArray(struct.lineItems) ? struct.lineItems : [];
  for (const item of items) {
    if (!item?.name) continue;
    const quantity = item.quantity != null && item.quantity > 0 ? item.quantity : 1;
    const unitPrice = item.unitPrice != null && item.unitPrice >= 0 ? item.unitPrice : 0;
    const totalPrice = item.totalPrice != null && item.totalPrice >= 0 ? item.totalPrice : 0;
    await client.query(
      `INSERT INTO receipt_line_items (receipt_verification_id, raw_item_name, quantity, unit_price, total_price)
       VALUES ($1, $2, $3, $4, $5)`,
      [receipt.id, item.name, quantity, unitPrice, totalPrice],
    );
  }
}

/**
 * Run the OCR pipeline for one receipt. Provider errors/timeouts are rethrown so
 * the worker's retry policy applies; this function does not park the receipt at
 * PENDING_ADMIN_REVIEW (the worker does that after retries are exhausted).
 *
 * @param {string} receiptVerificationId
 * @param {object} deps
 * @param {object} deps.provider - OCR provider with extract({ fileUrl })
 * @param {Date}   [deps.now]
 */
export async function processReceiptOcr(receiptVerificationId, { provider, now = new Date() } = {}) {
  const ocrConfig = getOcrConfig();

  // Load the receipt (short transaction; provider call happens outside any tx).
  const receipt = await loadReceipt(receiptVerificationId);
  if (TERMINAL_RECEIPT_STATUSES.has(receipt.status)) return terminalResult(receipt);
  if (receipt.status === 'OCR_SUCCESS') {
    const decision = await verifyReceipt(receipt.id, { now });
    return { status: 'OCR_SUCCESS', resumed: true, decision };
  }

  // 1. File format/size guard — reject before any hashing/scoring.
  const fileCheck = validateReceiptFile({ fileUrl: receipt.file_url, sizeBytes: receipt.file_size_bytes }, ocrConfig);
  if (!fileCheck.ok) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await setStatus(client, receipt.id, 'OCR_FAILED');
      await writeAudit(client, {
        receiptId: receipt.id,
        previousStatus: receipt.status,
        newStatus: 'OCR_FAILED',
        reason: `File rejected: ${fileCheck.reason}`,
      });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return { status: 'OCR_FAILED', reason: fileCheck.reason };
  }

  // 2. Load the file bytes and compute the SHA-256 (Anti-Fraud §7.1) BEFORE the
  //    billable OCR call. Errors here propagate to the worker's retry policy.
  const bytes = await provider.loadFile({ fileUrl: receipt.file_url });
  const fileHash = computeFileHash(bytes);

  // 3. HASH_CHECKING + layer-1 duplicate hard rule against the computed hash.
  //    We compare by the computed value (parameter) and only persist it to the
  //    column on the non-duplicate path — the partial unique index
  //    idx_receipts_hash_uniq forbids two non-failed rows sharing a hash, so the
  //    rejected loser keeps its own upload hash rather than the colliding one.
  const dupClient = await pool.connect();
  try {
    await dupClient.query('BEGIN');
    await setStatus(dupClient, receipt.id, 'HASH_CHECKING');

    const dup = await dupClient.query(
      `SELECT id FROM receipt_verifications
       WHERE file_hash_sha256 = $1 AND id <> $2 AND status NOT IN ('OCR_FAILED')
       LIMIT 1`,
      [fileHash, receipt.id],
    );

    if (dup.rows.length > 0) {
      await setStatus(dupClient, receipt.id, 'DUPLICATE_DETECTED');
      await rejectAsDuplicate(dupClient, receipt);
      await dupClient.query('COMMIT');
      return { status: 'REJECTED', duplicate: true };
    }

    await dupClient.query(
      `UPDATE receipt_verifications SET file_hash_sha256 = $2, status = 'OCR_PROCESSING' WHERE id = $1`,
      [receipt.id, fileHash],
    );
    await dupClient.query('COMMIT');
  } catch (err) {
    await dupClient.query('ROLLBACK');
    throw err;
  } finally {
    dupClient.release();
  }

  // 4. OCR (outside any DB transaction). Errors propagate to the worker.
  const struct = await provider.analyzeExpense({ fileUrl: receipt.file_url, bytes });

  // A prior timed-out attempt may have been degraded while provider I/O was still
  // in flight. Re-check before any post-provider writes so terminal decisions are
  // not overwritten by an orphaned continuation or manual replay.
  const current = await loadReceipt(receipt.id);
  if (TERMINAL_RECEIPT_STATUSES.has(current.status)) return terminalResult(current);

  // 4. Persist extraction + line items atomically, then run the fraud decision.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await persistOcrResult(client, receipt, struct);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // 5. Task 4.4 decision (own transaction).
  const decision = await verifyReceipt(receipt.id, { now });
  return { status: 'OCR_SUCCESS', decision };
}
