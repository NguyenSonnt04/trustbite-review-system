/**
 * retentionRules.js
 * Single source of truth for data retention windows (Data_Retention_Policy.md).
 *
 * Decision 0021: thresholds ship as frozen constants exposed through
 * getRetentionRules(), the same pattern as fraudRules.js (decision 0014), so a
 * future config-backed loader can replace the accessor body without touching
 * call sites. Retention jobs receive the returned object as a parameter; they
 * never read env or the DB directly. All values are in days.
 */

const RETENTION_RULES = Object.freeze({
  // OTP records: 30 days, then delete (Data_Retention_Policy.md).
  otpRetentionDays: 30,

  // Device/IP hash + GPS coordinates: 30-90 days. We anonymize the raw request
  // IP and GPS coordinates on receipt_verifications at the conservative upper
  // bound; the derived gps_distance_meters (non-PII) is retained for audit.
  receiptSignalRetentionDays: 90,

  // Notifications: 1 year, then delete read/expired records.
  notificationRetentionDays: 365,
});

export function getRetentionRules() {
  return RETENTION_RULES;
}
