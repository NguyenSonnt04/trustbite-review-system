-- 003_add_missing_restaurant_indexes.sql
-- Add indexes on foreign keys to optimize joins and filters

CREATE INDEX IF NOT EXISTS idx_restaurant_branches_parent_restaurant_id
  ON restaurant_branches(parent_restaurant_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id
  ON menu_items(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_operating_hours_branch_id
  ON restaurant_operating_hours(branch_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_images_restaurant_id
  ON restaurant_images(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_images_branch_id
  ON restaurant_images(branch_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_category_map_category_id
  ON restaurant_category_map(category_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_amenities_amenity_id
  ON restaurant_amenities(amenity_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_payment_methods_payment_method_id
  ON restaurant_payment_methods(payment_method_id);
