import { pool } from '../config/db.js';
import { getRetentionRules } from '../config/retentionRules.js';

/**
 * dataRetentionService — scheduled data-retention jobs (Data_Retention_Policy.md,
 * decision 0021). Each action enforces one retention window with an explicit,
 * config-driven threshold and runs in its own transaction so the actions are
 * independent (a failure in one does not roll back the others already committed).
 *
 * The cutoff is derived from an injectable `now` so the behavior is deterministic
 * and testable. Account-deletion retention is handled separately by
 * accountDeletionProcessor.js and is intentionally out of scope here.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function cutoffDate(now, days) {
  return new Date(now.getTime() - days * DAY_MS);
}

async function runInTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original error rather than masking it with a rollback failure.
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Delete OTP verification records past the retention window.
 * @returns {Promise<number>} rows deleted
 */
export async function purgeExpiredOtpVerifications(now, rules) {
  const before = cutoffDate(now, rules.otpRetentionDays);
  return runInTransaction(async (client) => {
    const result = await client.query(
      'DELETE FROM otp_verifications WHERE created_at < $1',
      [before]
    );
    return result.rowCount;
  });
}

/**
 * Anonymize raw IP/GPS signals on receipts past the retention window. The row
 * and its derived, non-PII gps_distance_meters are kept for audit.
 * @returns {Promise<number>} rows anonymized
 */
export async function anonymizeStaleReceiptSignals(now, rules) {
  const before = cutoffDate(now, rules.receiptSignalRetentionDays);
  return runInTransaction(async (client) => {
    const result = await client.query(
      `UPDATE receipt_verifications
       SET request_ip = NULL,
           gps_latitude = NULL,
           gps_longitude = NULL,
           gps_accuracy_meters = NULL
       WHERE created_at < $1
         AND (request_ip IS NOT NULL
              OR gps_latitude IS NOT NULL
              OR gps_longitude IS NOT NULL
              OR gps_accuracy_meters IS NOT NULL)`,
      [before]
    );
    return result.rowCount;
  });
}

/**
 * Delete notifications older than the retention window. This is a hard age-based
 * limit: all notifications past the window are removed regardless of read state.
 * @returns {Promise<number>} rows deleted
 */
export async function purgeExpiredNotifications(now, rules) {
  const before = cutoffDate(now, rules.notificationRetentionDays);
  return runInTransaction(async (client) => {
    const result = await client.query(
      'DELETE FROM notifications WHERE created_at < $1',
      [before]
    );
    return result.rowCount;
  });
}

/**
 * Run all data-retention actions and return a summary of affected rows.
 *
 * Actions are independent (each runs in its own transaction), so every action is
 * attempted even if an earlier one fails — a single failing retention job must
 * not indefinitely block the others, which would risk a time-based policy
 * violation. A successful action reports its affected-row count; a failed action
 * reports `null` and its message is collected under `errors`. `errors` is `null`
 * when every action succeeded. The caller (runner) decides how to signal overall
 * failure.
 */
export async function runDataRetention({ now = new Date(), rules = getRetentionRules() } = {}) {
  const actions = [
    ['otpDeleted', purgeExpiredOtpVerifications],
    ['receiptSignalsAnonymized', anonymizeStaleReceiptSignals],
    ['notificationsDeleted', purgeExpiredNotifications],
  ];

  const summary = { otpDeleted: null, receiptSignalsAnonymized: null, notificationsDeleted: null };
  const errors = {};

  for (const [key, action] of actions) {
    try {
      summary[key] = await action(now, rules);
    } catch (err) {
      errors[key] = err?.message ?? String(err);
    }
  }

  return { ...summary, errors: Object.keys(errors).length > 0 ? errors : null };
}
