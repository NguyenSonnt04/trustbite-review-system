CREATE TABLE bill_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE RESTRICT,
  idempotency_key UUID NOT NULL,
  request_hash CHAR(64) NOT NULL,
  file_url TEXT,
  file_hash_sha256 CHAR(64) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
  status VARCHAR(30) NOT NULL DEFAULT 'PROCESSING'
    CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  overall_result VARCHAR(30)
    CHECK (overall_result IN ('MATCHED', 'PRICE_MISMATCH', 'INCONCLUSIVE')),
  provider_error_code VARCHAR(80),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE bill_scan_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_scan_id UUID NOT NULL REFERENCES bill_scans(id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL CHECK (line_index >= 0),
  observed_name VARCHAR(200) NOT NULL,
  observed_quantity NUMERIC(10,2) CHECK (observed_quantity > 0),
  observed_unit_price NUMERIC(12,2) CHECK (observed_unit_price >= 0),
  observed_total_price NUMERIC(12,2) CHECK (observed_total_price >= 0),
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  expected_unit_price NUMERIC(12,2) CHECK (expected_unit_price >= 0),
  price_difference NUMERIC(12,2) CHECK (price_difference >= 0),
  mapping_confidence NUMERIC(5,4) CHECK (mapping_confidence BETWEEN 0 AND 1),
  result VARCHAR(30) NOT NULL
    CHECK (result IN ('MATCHED', 'PRICE_MISMATCH', 'INCONCLUSIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bill_scan_id, line_index)
);

CREATE INDEX idx_bill_scans_owner_created
  ON bill_scans(user_id, created_at DESC);
CREATE INDEX idx_bill_scans_status
  ON bill_scans(status, created_at);
CREATE INDEX idx_bill_scan_line_items_scan
  ON bill_scan_line_items(bill_scan_id, line_index);

CREATE TRIGGER trg_bill_scans_updated_at
  BEFORE UPDATE ON bill_scans
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
