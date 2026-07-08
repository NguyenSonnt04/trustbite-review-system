/**
 * fraudRules.js
 * Single source of truth for receipt anti-fraud thresholds (Anti-Fraud spec §4).
 *
 * Decision 0014: thresholds ship as frozen constants now, exposed through
 * getFraudRules() so a future fraud_rule_configs-backed loader can replace the
 * accessor body without changing call sites. Domain scoring functions receive
 * the returned object as a parameter; they never read env or the DB directly.
 */

const FRAUD_RULES = Object.freeze({
  // GPS proximity (Anti-Fraud §4.1, §5)
  gpsNearRadiusMeters: 200,
  gpsAccuracyMaxMeters: 100,
  nearWindowMs: 60 * 60 * 1000, // 1 hour, measured server-side
  capturedAtSkewMaxMs: 5 * 60 * 1000, // 5 minutes

  // Merchant-name match bands (§4.1, §6), Levenshtein similarity 0-100
  merchantHighMatch: 80,
  merchantLowMatch: 60,

  // Receipt age bands in hours (§4.1)
  receiptFreshHours: 48,
  receiptStaleHours: 168,

  // Signal points (§4.1)
  points: Object.freeze({
    gpsFarNear: 40, // >200m, submitted at venue within 1h
    gpsFarLate: 10, // >200m, submitted remotely/after 1h
    gpsAbsent: 30, // GPS off / permission not granted
    gpsAccuracyLow: 15, // accuracy >100m
    merchantMid: 25, // similarity 60-79
    merchantLow: 60, // similarity <60
    merchantUnreadable: 50, // OCR could not read merchant name
    receiptMid: 40, // 49-168h
    receiptStale: 70, // >168h
    receiptUnreadable: 30, // could not read receipt time
    duplicateFileHash: 100,
    duplicateTransactionHash: 100,
    editedMetadata: 50,
    newAccount: 15,
    manyRejectedReceipts: 40,
    multiAccountSameDevice: 50,
  }),

  // Decision buckets (§4.2). Inclusive upper bounds.
  buckets: Object.freeze({
    verifiedMax: 30, // 0-30
    pendingMax: 60, // 31-60
    referenceMax: 99, // 61-99
    // >=100 → REJECTED
  }),
});

export function getFraudRules() {
  return FRAUD_RULES;
}