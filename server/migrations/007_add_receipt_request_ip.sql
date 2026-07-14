-- 007_add_receipt_request_ip.sql
-- TB-FRAUD-005: basic IP request-signal tracking for the multi-account
-- same-IP behavioral anti-fraud rule (Anti_Fraud_Specification §4.1, §9 MVP).
--
-- Scope: a single nullable INET column plus a supporting composite index for the
-- "same IP + same restaurant within 24h by another account" lookup. GPS/IP are
-- optional signals; the column stays nullable and no persisted device-fingerprint
-- table is introduced (device fingerprint SDK remains a future V1.1 concern).
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_receipts_request_ip_restaurant;
--   ALTER TABLE receipt_verifications DROP COLUMN IF EXISTS request_ip;

ALTER TABLE receipt_verifications
  ADD COLUMN IF NOT EXISTS request_ip INET;

CREATE INDEX IF NOT EXISTS idx_receipts_request_ip_restaurant
  ON receipt_verifications (request_ip, restaurant_id, created_at)
  WHERE request_ip IS NOT NULL;
