-- 006_add_failed_account_deletion_cleanup_state.sql
-- Adds a terminal cleanup state for deletion requests that exhaust automatic retries.

ALTER TABLE account_deletion_requests
  DROP CONSTRAINT IF EXISTS chk_account_deletion_cleanup_state;

ALTER TABLE account_deletion_requests
  ADD CONSTRAINT chk_account_deletion_cleanup_state
  CHECK (cleanup_state IN ('PENDING', 'CLEANUP_IN_PROGRESS', 'RETRYABLE', 'COMPLETED', 'LEGAL_HOLD', 'FAILED'));
