-- 005_retain_deleted_receipt_transaction_hash.sql
-- Keep deleted verified receipt transaction hashes in the duplicate policy.

DROP INDEX IF EXISTS idx_receipts_trx_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_trx_uniq
  ON receipt_verifications(transaction_unique_hash)
  WHERE transaction_unique_hash IS NOT NULL
    AND status IN ('VERIFIED', 'DELETED');
