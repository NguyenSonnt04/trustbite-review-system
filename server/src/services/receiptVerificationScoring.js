/**
 * receiptVerificationScoring.js
 * Pure, DB-free anti-fraud scoring functions (Anti-Fraud spec §4, §5, §6, §7).
 *
 * These functions take all inputs as parameters (including the rules object from
 * getFraudRules()) and have no side effects, so they are exhaustively unit
 * testable against the spec's scoring table and decision buckets.
 */

import crypto from 'crypto';

const EARTH_RADIUS_METERS = 6_371_000;

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in meters (Haversine). R = 6,371,000m (§5).
 */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lng2 - lng1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

const BUSINESS_SUFFIXES = [
  /\bco\.?\s*,?\s*ltd\.?\b/g,
  /\bchi\s*nhanh\b/g,
  /\bcn\b/g,
];

/**
 * Normalize a merchant name for matching/hashing (§6, §7.2):
 * lowercase, strip Vietnamese diacritics, drop common business suffixes,
 * remove punctuation, collapse whitespace.
 */
export function normalizeMerchantName(name) {
  if (!name) return '';

  let out = String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/đ/gi, 'd')
    .toLowerCase();

  for (const re of BUSINESS_SUFFIXES) {
    out = out.replace(re, ' ');
  }

  return out
    .replace(/[^a-z0-9\s]/g, ' ') // drop punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Levenshtein-based similarity as a 0-100 percentage (§6).
 * Both empty → 100; exactly one empty → 0.
 */
export function levenshteinSimilarity(a, b) {
  const s1 = a ?? '';
  const s2 = b ?? '';
  if (s1.length === 0 && s2.length === 0) return 100;
  if (s1.length === 0 || s2.length === 0) return 0;

  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshteinDistance(s1, s2);
  return Math.round((1 - dist / maxLen) * 100);
}

/**
 * Composite transaction hash (§7.2):
 *   SHA256(normalizedName + "|" + datetimeISO + "|" + invoiceNo + "|" + totalAmount)
 */
export function computeTransactionHash({ name, datetimeISO, invoiceNo, totalAmount }) {
  const canonical = [
    normalizeMerchantName(name),
    datetimeISO ?? '',
    invoiceNo ?? '',
    totalAmount ?? '',
  ].join('|');
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Score a set of pre-computed signals (§4.1). Returns { score, breakdown }.
 * Signals are derived upstream (orchestrator) so this stays pure and testable.
 *
 * @param {object} signals
 * @param {boolean} signals.gpsProvided
 * @param {number|null} signals.gpsDistanceMeters
 * @param {number|null} signals.gpsAccuracyMeters
 * @param {boolean} signals.submittedNear - within the server-side 1h window
 * @param {number|null} signals.merchantSimilarity - 0-100, or null if unreadable
 * @param {number|null} signals.receiptAgeHours - or null if unreadable
 * @param {boolean} signals.duplicateFileHash
 * @param {boolean} signals.duplicateTransactionHash
 * @param {boolean} signals.editedMetadata
 * @param {boolean} signals.newAccountFirstReview
 * @param {boolean} signals.manyRejectedReceipts
 * @param {boolean} signals.multiAccountSameDevice
 * @param {object} rules - from getFraudRules()
 */
export function scoreReceipt(signals, rules) {
  const p = rules.points;
  const breakdown = [];
  const add = (code, points) => {
    if (points > 0) breakdown.push({ code, points });
  };

  // GPS proximity
  if (!signals.gpsProvided) {
    add('GPS_ABSENT', p.gpsAbsent);
  } else {
    if (signals.gpsDistanceMeters != null && signals.gpsDistanceMeters > rules.gpsNearRadiusMeters) {
      add(
        signals.submittedNear ? 'GPS_FAR_NEAR' : 'GPS_FAR_LATE',
        signals.submittedNear ? p.gpsFarNear : p.gpsFarLate,
      );
    }
    if (signals.gpsAccuracyMeters != null && signals.gpsAccuracyMeters > rules.gpsAccuracyMaxMeters) {
      add('GPS_ACCURACY_LOW', p.gpsAccuracyLow);
    }
  }

  // Merchant-name match
  if (signals.merchantSimilarity == null) {
    add('MERCHANT_UNREADABLE', p.merchantUnreadable);
  } else if (signals.merchantSimilarity < rules.merchantLowMatch) {
    add('MERCHANT_MATCH_LOW', p.merchantLow);
  } else if (signals.merchantSimilarity < rules.merchantHighMatch) {
    add('MERCHANT_MATCH_MID', p.merchantMid);
  }

  // Receipt age
  if (signals.receiptAgeHours == null) {
    add('RECEIPT_TIME_UNREADABLE', p.receiptUnreadable);
  } else if (signals.receiptAgeHours > rules.receiptStaleHours) {
    add('RECEIPT_AGE_OVER_168H', p.receiptStale);
  } else if (signals.receiptAgeHours > rules.receiptFreshHours) {
    add('RECEIPT_AGE_49_168H', p.receiptMid);
  }

  // Hard duplicate signals
  if (signals.duplicateFileHash) add('DUPLICATE_FILE_HASH', p.duplicateFileHash);
  if (signals.duplicateTransactionHash) add('DUPLICATE_TRANSACTION_HASH', p.duplicateTransactionHash);

  // Soft behavioral signals
  if (signals.editedMetadata) add('EDITED_METADATA', p.editedMetadata);
  if (signals.newAccountFirstReview) add('NEW_ACCOUNT_FIRST_REVIEW', p.newAccount);
  if (signals.manyRejectedReceipts) add('MANY_REJECTED_RECEIPTS', p.manyRejectedReceipts);
  if (signals.multiAccountSameDevice) add('MULTI_ACCOUNT_SAME_DEVICE', p.multiAccountSameDevice);

  const score = breakdown.reduce((sum, b) => sum + b.points, 0);
  return { score, breakdown };
}

/**
 * Map a raw fraud risk score to the decision bucket and the full set of
 * lifecycle states (Status_Mapping §3, Anti-Fraud §4.2).
 *
 * `decision` is the receipt_verifications.decision value, constrained by schema
 * to VERIFIED | REJECTED | REFERENCE_ONLY. The PENDING_ADMIN_REVIEW bucket
 * leaves decision NULL (the status columns carry that state).
 */
export function decideFromScore(score, rules) {
  const { verifiedMax, pendingMax, referenceMax } = rules.buckets;

  if (score <= verifiedMax) {
    return {
      decision: 'VERIFIED',
      reviewStatus: 'VERIFIED',
      verificationStatus: 'VERIFIED',
      receiptStatus: 'VERIFIED',
      trustLabel: 'VERIFIED',
      publicVisibility: 'PUBLIC',
      trustWeightBucket: 'HIGH',
    };
  }
  if (score <= pendingMax) {
    return {
      decision: null,
      reviewStatus: 'PENDING_ADMIN_REVIEW',
      verificationStatus: 'PENDING_ADMIN_REVIEW',
      receiptStatus: 'PENDING_ADMIN_REVIEW',
      trustLabel: 'PENDING_ADMIN_REVIEW',
      publicVisibility: 'PRIVATE_UNTIL_DECISION',
      trustWeightBucket: 'NONE',
    };
  }
  if (score <= referenceMax) {
    return {
      decision: 'REFERENCE_ONLY',
      reviewStatus: 'REFERENCE_ONLY',
      verificationStatus: 'REFERENCE_ONLY',
      receiptStatus: 'REFERENCE_ONLY',
      trustLabel: 'REFERENCE_ONLY',
      publicVisibility: 'PUBLIC',
      trustWeightBucket: 'LOW',
    };
  }
  return {
    decision: 'REJECTED',
    reviewStatus: 'REJECTED',
    verificationStatus: 'REJECTED',
    receiptStatus: 'REJECTED',
    trustLabel: 'REJECTED',
    publicVisibility: 'PRIVATE',
    trustWeightBucket: 'NONE',
  };
}