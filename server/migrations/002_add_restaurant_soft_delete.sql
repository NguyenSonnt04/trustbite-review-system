-- 002_add_restaurant_soft_delete.sql
-- Adds dedicated logical-deletion fields for restaurants.
-- Business status CLOSED remains separate from data lifecycle deletion.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_restaurants_is_deleted_status
  ON restaurants(is_deleted, status);
