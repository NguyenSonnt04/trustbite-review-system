INSERT INTO roles (id, label, description)
VALUES
  ('USER', 'User', 'Standard TrustBite product user'),
  ('ADMIN', 'Administrator', 'TrustBite operations administrator'),
  ('SUPER_ADMIN', 'Super administrator', 'TrustBite administrator manager')
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description;
