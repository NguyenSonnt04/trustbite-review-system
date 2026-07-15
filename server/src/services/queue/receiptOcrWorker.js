/**
 * receiptOcrWorker.js — BullMQ worker for receipt OCR jobs.
 *
 * The job processor wraps processReceiptOcr in a per-job timeout. Transient
 * failures (provider error/timeout on a non-final attempt) are rethrown so
 * BullMQ retries with backoff. On the FINAL attempt, the receipt degrades to
 * PENDING_ADMIN_REVIEW (Status_Mapping: OCR timeout/provider error after retry)
 * with no fraud flag and no automatic fraud verdict.
 *
 * The Worker is created via a factory and started explicitly from server.js —
 * never at import time — so tests and the syntax check do not open Redis.
 */

import { Worker } from 'bullmq';
import { pool } from '../../config/db.js';
import { getOcrConfig } from '../../config/ocr.js';
import { getRedisConnection } from '../../config/redis.js';
import { processReceiptOcr } from '../ocrService.js';
import { getOcrProvider } from '../providers/index.js';

class TimeoutError extends Error {
  constructor(ms) {
    super(`OCR job timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Park a receipt + its review at PENDING_ADMIN_REVIEW. No fraud flag is created;
 * a provider/timeout failure is not evidence of fraud.
 */
export async function markPendingAdminReview(receiptVerificationId, reason) {
  const loaded = await pool.query(`SELECT id, review_id, status FROM receipt_verifications WHERE id = $1`, [receiptVerificationId]);
  if (loaded.rows.length === 0) return;
  const receipt = loaded.rows[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE receipt_verifications
       SET status = 'PENDING_ADMIN_REVIEW', decision_reason = $2
       WHERE id = $1
         AND status NOT IN ('VERIFIED', 'REJECTED', 'REFERENCE_ONLY', 'PENDING_ADMIN_REVIEW')
       RETURNING id, review_id, status`,
      [receipt.id, reason ?? null],
    );
    if (updated.rows.length === 0) {
      await client.query('COMMIT');
      return { skipped: true, status: receipt.status };
    }

    await client.query(
      `UPDATE reviews
       SET status = 'PENDING_ADMIN_REVIEW', verification_status = 'PENDING_ADMIN_REVIEW',
           trust_label = 'PENDING_ADMIN_REVIEW', public_visibility = 'PRIVATE_UNTIL_DECISION',
           trust_weight_bucket = 'NONE'
       WHERE id = $1`,
      [receipt.review_id],
    );
    await client.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, previous_status, new_status, reason)
       VALUES (NULL, 'SYSTEM', 'RECEIPT_OCR_DEGRADED', 'RECEIPT_VERIFICATION', $1, $2, 'PENDING_ADMIN_REVIEW', $3)`,
      [receipt.id, receipt.status, reason ?? 'OCR failed after retries'],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function isFinalAttempt(job) {
  const attempts = job?.opts?.attempts ?? 1;
  // attemptsMade is the count of attempts already failed (0 on first run).
  return (job?.attemptsMade ?? 0) + 1 >= attempts;
}

/**
 * Run a single OCR job. Used directly by tests and by the Worker processor.
 *
 * @param {object} job - { data: { receiptVerificationId }, attemptsMade, opts: { attempts } }
 * @param {object} deps - { provider, timeoutMs }
 */
export async function runReceiptOcrJob(job, { provider, timeoutMs } = {}) {
  const { receiptVerificationId } = job.data;
  const resolvedProvider = provider ?? getOcrProvider();
  const ms = timeoutMs ?? getOcrConfig().jobTimeoutMs;

  try {
    return await withTimeout(processReceiptOcr(receiptVerificationId, { provider: resolvedProvider }), ms);
  } catch (err) {
    if (isFinalAttempt(job)) {
      // Retries exhausted (or timed out on the last attempt): degrade, don't fail.
      await markPendingAdminReview(receiptVerificationId, `OCR failed after retries: ${err.message}`);
      return { status: 'PENDING_ADMIN_REVIEW', degraded: true };
    }
    // Non-final attempt: rethrow so BullMQ retries with backoff.
    throw err;
  }
}

/**
 * Create (but the caller starts) the BullMQ Worker. server.js owns its lifecycle.
 */
export function createReceiptOcrWorker({ provider } = {}) {
  const { queueName, jobTimeoutMs } = getOcrConfig();
  const resolvedProvider = provider ?? getOcrProvider();
  return new Worker(
    queueName,
    (job) => runReceiptOcrJob(job, { provider: resolvedProvider, timeoutMs: jobTimeoutMs }),
    { connection: getRedisConnection() },
  );
}
