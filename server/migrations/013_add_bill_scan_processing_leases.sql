ALTER TABLE bill_scans
  ADD COLUMN processing_attempt_token UUID,
  ADD COLUMN processing_lease_expires_at TIMESTAMPTZ;

UPDATE bill_scans
SET processing_attempt_token = gen_random_uuid(),
    processing_lease_expires_at = updated_at
WHERE status = 'PROCESSING';

ALTER TABLE bill_scans
  ADD CONSTRAINT chk_bill_scan_processing_lease
  CHECK (
    (status = 'PROCESSING'
      AND processing_attempt_token IS NOT NULL
      AND processing_lease_expires_at IS NOT NULL)
    OR
    (status IN ('COMPLETED', 'FAILED')
      AND processing_attempt_token IS NULL
      AND processing_lease_expires_at IS NULL)
  );

CREATE INDEX idx_bill_scans_processing_lease
  ON bill_scans(processing_lease_expires_at)
  WHERE status = 'PROCESSING';
