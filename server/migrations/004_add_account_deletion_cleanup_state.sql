-- 004_add_account_deletion_cleanup_state.sql
-- Adds durable cleanup state for account deletion processor retries, leases, and legal holds.

ALTER TABLE account_deletion_requests
  ADD COLUMN IF NOT EXISTS cleanup_state VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS cleanup_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleanup_last_error_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS cleanup_last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cleanup_lease_token UUID,
  ADD COLUMN IF NOT EXISTS cleanup_lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS legal_hold_reason TEXT;

ALTER TABLE account_deletion_requests
  ADD CONSTRAINT chk_account_deletion_cleanup_state
  CHECK (cleanup_state IN ('PENDING', 'CLEANUP_IN_PROGRESS', 'RETRYABLE', 'COMPLETED', 'LEGAL_HOLD'));

ALTER TABLE account_deletion_requests
  ADD CONSTRAINT chk_account_deletion_cleanup_attempts
  CHECK (cleanup_attempts >= 0);

CREATE INDEX IF NOT EXISTS idx_account_deletion_cleanup_due
  ON account_deletion_requests(status, cleanup_state, scheduled_deletion_at, requested_at)
  WHERE status IN ('REQUESTED', 'PROCESSING');
