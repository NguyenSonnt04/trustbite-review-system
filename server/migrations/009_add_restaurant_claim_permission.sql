ALTER TABLE restaurant_claims
ADD COLUMN requested_permission_level VARCHAR(30) NOT NULL DEFAULT 'OWNER'
CHECK (requested_permission_level IN ('OWNER', 'MANAGER'));

CREATE UNIQUE INDEX idx_restaurant_claims_open_unique
ON restaurant_claims (merchant_id, restaurant_id)
WHERE status IN ('SUBMITTED', 'UNDER_REVIEW');
