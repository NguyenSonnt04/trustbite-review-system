/**
 * receiptVerificationService.js
 * Orchestrates the anti-fraud decision for an OCR'd receipt (Task 4.4).
 *
 * Responsibilities (Anti-Fraud spec §3, §4, §7, §11; Status_Mapping §3):
 *  - Load the receipt + parent review + venue inside one transaction.
 *  - Hard rule: composite transaction-hash collision against a prior VERIFIED
 *    receipt → REJECTED + DUPLICATE_TRANSACTION_HASH fraud flag.
 *  - Compute fraud signals (merchant match, receipt age, GPS proximity),
 *    score them, decide the bucket, and synchronize receipt + review states.
 *  - Write an audit_logs row for the automated decision.
 *
 * All raw DB access lives here; controllers must not touch the pool directly.
 * Only columns present in 001_init_schema.sql are written.
 */

import { pool } from '../config/db.js';
import { getFraudRules } from '../config/fraudRules.js';
import {
  haversineMeters,
  normalizeMerchantName,
  levenshteinSimilarity,
  computeTransactionHash,
  scoreReceipt,
  decideFromScore,
} from './receiptVerificationScoring.js';

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
  }
}

const num = (v) => (v != null && v !== '' ? Number(v) : null);

/**
 * Derive the GPS signals server-side. The 1-hour window is measured from the
 * receipt's server-side created_at, never from a client timestamp. A capturedAt
 * that is skewed beyond the allowed window cannot be used to claim "late"
 * submission and dodge the near-venue penalty (§4.1 GPS time rules).
 */
function deriveGpsSignals(receipt, venue, now, rules) {
  const lat = num(receipt.gps_latitude);
  const lng = num(receipt.gps_longitude);
  const accuracy = num(receipt.gps_accuracy_meters);

  if (lat == null || lng == null) {
    return { gpsProvided: false, gpsDistanceMeters: null, gpsAccuracyMeters: null, submittedNear: true };
  }
  if (venue.latitude == null || venue.longitude == null) {
    return { gpsProvided: true, gpsDistanceMeters: null, gpsAccuracyMeters: accuracy, submittedNear: true };
  }

  const distance = haversineMeters(lat, lng, num(venue.latitude), num(venue.longitude));

  // "Near" = received within the server-side 1h window. capturedAt is metadata
  // only; if it is missing or skewed > allowed from server time, we keep the
  // strict (near) interpretation so back-dating cannot lower risk.
  const createdAt = receipt.created_at ? new Date(receipt.created_at) : now;
  const ageSinceReceiptMs = now.getTime() - createdAt.getTime();
  const submittedNear = ageSinceReceiptMs <= rules.nearWindowMs;

  return {
    gpsProvided: true,
    gpsDistanceMeters: distance,
    gpsAccuracyMeters: accuracy,
    submittedNear,
  };
}

function deriveReceiptAgeHours(receipt, now) {
  if (!receipt.ocr_receipt_time) return null;
  const receiptTime = new Date(receipt.ocr_receipt_time);
  if (Number.isNaN(receiptTime.getTime())) return null;
  return (now.getTime() - receiptTime.getTime()) / (60 * 60 * 1000);
}

function deriveMerchantSimilarity(receipt, venue) {
  if (!receipt.ocr_restaurant_name) return null;
  return levenshteinSimilarity(
    normalizeMerchantName(receipt.ocr_restaurant_name),
    normalizeMerchantName(venue.name),
  );
}

async function createFraudFlag(client, { flagCode, riskScore, receiptId, reviewId, userId }) {
  const flagResult = await client.query(
    `INSERT INTO fraud_flags (flag_code, risk_score, status)
     VALUES ($1, $2, 'OPEN')
     RETURNING id`,
    [flagCode, Math.min(riskScore, 100)],
  );
  const flagId = flagResult.rows[0].id;

  const entities = [
    ['RECEIPT_VERIFICATION', receiptId],
    ['REVIEW', reviewId],
  ];
  if (userId) entities.push(['USER', userId]);

  for (const [entityType, entityId] of entities) {
    await client.query(
      `INSERT INTO fraud_flag_entities (fraud_flag_id, entity_type, entity_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [flagId, entityType, entityId],
    );
  }
  return flagId;
}

async function writeDecision(client, { receipt, review, states, riskScore, reason, transactionHash, gpsDistance }) {
  await client.query(
    `UPDATE receipt_verifications
     SET status = $2,
         decision = $3,
         fraud_risk_score = $4,
         transaction_unique_hash = COALESCE($5, transaction_unique_hash),
         gps_distance_meters = $6,
         decision_reason = $7,
         decided_at = NOW()
     WHERE id = $1`,
    [
      receipt.id,
      states.receiptStatus,
      states.decision,
      Math.min(riskScore, 100),
      transactionHash,
      gpsDistance,
      reason,
    ],
  );

  await client.query(
    `UPDATE reviews
     SET status = $2,
         verification_status = $3,
         trust_label = $4,
         public_visibility = $5,
         trust_weight_bucket = $6
     WHERE id = $1`,
    [
      review.id,
      states.reviewStatus,
      states.verificationStatus,
      states.trustLabel,
      states.publicVisibility,
      states.trustWeightBucket,
    ],
  );

  await client.query(
    `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, previous_status, new_status, reason, metadata)
     VALUES (NULL, 'SYSTEM', $1, 'RECEIPT_VERIFICATION', $2, $3, $4, $5, $6)`,
    [
      'RECEIPT_VERIFICATION_DECISION',
      receipt.id,
      receipt.status,
      states.receiptStatus,
      reason,
      JSON.stringify({ fraudRiskScore: Math.min(riskScore, 100), rawScore: riskScore }),
    ],
  );
}

/**
 * Run the automated verification decision for a receipt.
 *
 * @param {string} receiptVerificationId - UUID of the receipt_verifications row.
 * @param {object} [opts]
 * @param {Date}   [opts.now] - injectable server clock for testing.
 * @returns {Promise<object>} The decided state set plus fraudRiskScore.
 */
export async function verifyReceipt(receiptVerificationId, { now = new Date() } = {}) {
  const rules = getFraudRules();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const receiptResult = await client.query(
      `SELECT * FROM receipt_verifications WHERE id = $1 FOR UPDATE`,
      [receiptVerificationId],
    );
    if (receiptResult.rows.length === 0) {
      throw new NotFoundError('Receipt verification not found.');
    }
    const receipt = receiptResult.rows[0];

    const reviewResult = await client.query(
      `SELECT id, user_id, restaurant_id FROM reviews WHERE id = $1`,
      [receipt.review_id],
    );
    if (reviewResult.rows.length === 0) {
      throw new NotFoundError('Parent review not found.');
    }
    const review = reviewResult.rows[0];

    // Prefer branch coordinates when the receipt is tied to a branch.
    let venue;
    if (receipt.branch_id) {
      const branchResult = await client.query(
        `SELECT rb.id, r.name AS name, rb.latitude, rb.longitude
         FROM restaurant_branches rb
         JOIN restaurants r ON r.id = rb.parent_restaurant_id
         WHERE rb.id = $1`,
        [receipt.branch_id],
      );
      venue = branchResult.rows[0];
    }
    if (!venue) {
      const restaurantResult = await client.query(
        `SELECT id, name, latitude, longitude FROM restaurants WHERE id = $1`,
        [receipt.restaurant_id],
      );
      if (restaurantResult.rows.length === 0) {
        throw new NotFoundError('Receipt restaurant not found.');
      }
      venue = restaurantResult.rows[0];
    }

    // Composite transaction hash (computed from OCR fields when available).
    const transactionHash = receipt.ocr_receipt_time
      ? computeTransactionHash({
          name: receipt.ocr_restaurant_name,
          datetimeISO: new Date(receipt.ocr_receipt_time).toISOString(),
          invoiceNo: receipt.ocr_invoice_no,
          totalAmount: receipt.ocr_total_amount,
        })
      : null;

    // --- Hard rule: duplicate transaction hash vs a retained verified transaction ---
    // Intentional per TB-RECEIPT-VERIFY-001 and migration 005: REFERENCE_ONLY receipts
    // do not block resubmission, but VERIFIED and retained DELETED receipts do.
    if (transactionHash) {
      const dupResult = await client.query(
        `SELECT id FROM receipt_verifications
         WHERE transaction_unique_hash = $1
           AND status IN ('VERIFIED', 'DELETED')
           AND id <> $2
         LIMIT 1`,
        [transactionHash, receipt.id],
      );

      if (dupResult.rows.length > 0) {
        const states = {
          decision: 'REJECTED',
          reviewStatus: 'REJECTED',
          verificationStatus: 'DUPLICATE_REJECTED',
          receiptStatus: 'REJECTED',
          trustLabel: 'REJECTED',
          publicVisibility: 'PRIVATE',
          trustWeightBucket: 'NONE',
        };
        const reason = 'Duplicate transaction hash matches a previously verified or retained deleted receipt.';

        await writeDecision(client, {
          receipt,
          review,
          states,
          riskScore: 100,
          reason,
          transactionHash,
          gpsDistance: null,
        });
        await createFraudFlag(client, {
          flagCode: 'DUPLICATE_TRANSACTION_HASH',
          riskScore: 100,
          receiptId: receipt.id,
          reviewId: review.id,
          userId: receipt.user_id,
        });

        await client.query('COMMIT');
        return { ...states, fraudRiskScore: 100, breakdown: [{ code: 'DUPLICATE_TRANSACTION_HASH', points: 100 }] };
      }
    }

    // --- Signal computation + scoring ---
    const gps = deriveGpsSignals(receipt, venue, now, rules);
    const merchantSimilarity = deriveMerchantSimilarity(receipt, venue);
    const receiptAgeHours = deriveReceiptAgeHours(receipt, now);

    const signals = {
      ...gps,
      merchantSimilarity,
      receiptAgeHours,
      duplicateFileHash: false, // file-hash dedup is enforced upstream at upload
      duplicateTransactionHash: false,
      editedMetadata: false,
      newAccountFirstReview: false,
      manyRejectedReceipts: false,
      multiAccountSameDevice: false,
    };

    const { score, breakdown } = scoreReceipt(signals, rules);
    const states = decideFromScore(score, rules);
    const reason = breakdown.length
      ? `Fraud score ${score}: ${breakdown.map((b) => `${b.code}(+${b.points})`).join(', ')}`
      : 'Fraud score 0: all signals within thresholds.';

    await writeDecision(client, {
      receipt,
      review,
      states,
      riskScore: score,
      reason,
      transactionHash,
      gpsDistance: gps.gpsDistanceMeters,
    });

    // Serious-signal rejection gets a fraud flag tied to the dominant signal.
    if (states.decision === 'REJECTED' && breakdown.length) {
      const dominant = breakdown.reduce((a, b) => (b.points > a.points ? b : a));
      await createFraudFlag(client, {
        flagCode: dominant.code,
        riskScore: score,
        receiptId: receipt.id,
        reviewId: review.id,
        userId: receipt.user_id,
      });
    }

    await client.query('COMMIT');
    return { ...states, fraudRiskScore: Math.min(score, 100), breakdown };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}