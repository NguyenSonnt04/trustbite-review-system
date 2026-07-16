DROP INDEX IF EXISTS idx_notifications_recipient_created;

CREATE INDEX idx_notifications_recipient_created
  ON notifications(recipient_user_id, created_at DESC, id DESC);

CREATE TEMP TABLE notification_migration_duplicate_exp
ON COMMIT DROP
AS
SELECT user_id, SUM(delta)::int AS duplicate_delta
FROM (
  SELECT
    user_id,
    delta,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, entity_id
      ORDER BY created_at, id
    ) AS row_number
  FROM exp_transactions
  WHERE reason = 'REVIEW_VERIFIED'
    AND entity_type = 'REVIEW'
    AND entity_id IS NOT NULL
) ranked
WHERE row_number > 1
GROUP BY user_id;

WITH duplicates AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, entity_id
        ORDER BY created_at, id
      ) AS row_number
    FROM exp_transactions
    WHERE reason = 'REVIEW_VERIFIED'
      AND entity_type = 'REVIEW'
      AND entity_id IS NOT NULL
  ) ranked
  WHERE row_number > 1
)
DELETE FROM exp_transactions
WHERE id IN (SELECT id FROM duplicates);

UPDATE users
SET exp_points = GREATEST(
  0,
  users.exp_points - duplicate_exp.duplicate_delta
)
FROM notification_migration_duplicate_exp duplicate_exp
WHERE users.id = duplicate_exp.user_id;

UPDATE users
SET rank_code = CASE
  WHEN exp_points >= 2000 AND (
    SELECT COUNT(*) FROM reviews
    WHERE user_id = users.id AND status = 'VERIFIED'
  ) >= 25 THEN 'TRUSTED_FOODIE'
  WHEN exp_points >= 500 AND (
    SELECT COUNT(*) FROM reviews
    WHERE user_id = users.id AND status = 'VERIFIED'
  ) >= 10 THEN 'FOODIE'
  WHEN exp_points >= 100 AND (
    SELECT COUNT(*) FROM reviews
    WHERE user_id = users.id AND status = 'VERIFIED'
  ) >= 2 THEN 'APPRENTICE'
  ELSE 'NEWBIE'
END
WHERE id IN (
  SELECT user_id
  FROM notification_migration_duplicate_exp
);

WITH review_weights AS (
  SELECT
    reviews.restaurant_id,
    COUNT(*) FILTER (
      WHERE reviews.trust_weight_bucket = 'HIGH'
    )::int AS verified_count,
    COUNT(*) FILTER (
      WHERE reviews.trust_weight_bucket = 'LOW'
    )::int AS reference_count,
    SUM(
      reviews.average_rating * CASE
        WHEN reviews.trust_weight_bucket = 'LOW' THEN 0.1
        WHEN reviews.trust_weight_bucket = 'HIGH' THEN CASE users.rank_code
          WHEN 'APPRENTICE' THEN 0.8
          WHEN 'FOODIE' THEN 1.0
          WHEN 'TRUSTED_FOODIE' THEN 1.5
          ELSE 0.5
        END
        ELSE 0
      END
    ) AS weighted_rating,
    SUM(
      CASE
        WHEN reviews.trust_weight_bucket = 'LOW' THEN 0.1
        WHEN reviews.trust_weight_bucket = 'HIGH' THEN CASE users.rank_code
          WHEN 'APPRENTICE' THEN 0.8
          WHEN 'FOODIE' THEN 1.0
          WHEN 'TRUSTED_FOODIE' THEN 1.5
          ELSE 0.5
        END
        ELSE 0
      END
    ) AS total_weight
  FROM reviews
  JOIN users ON users.id = reviews.user_id
  WHERE reviews.trust_weight_bucket IN ('HIGH', 'LOW')
  GROUP BY reviews.restaurant_id
)
UPDATE restaurants
SET trust_score = COALESCE(
      LEAST(
        5.0,
        GREATEST(
          1.0,
          ROUND(review_weights.weighted_rating / review_weights.total_weight, 2)
        )
      ),
      5.0
    ),
    verified_review_count = COALESCE(review_weights.verified_count, 0),
    reference_review_count = COALESCE(review_weights.reference_count, 0),
    updated_at = NOW()
FROM review_weights
WHERE restaurants.id = review_weights.restaurant_id
  AND EXISTS (
    SELECT 1
    FROM notification_migration_duplicate_exp
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_exp_transactions_review_verified_uniq
  ON exp_transactions(user_id, entity_id)
  WHERE reason = 'REVIEW_VERIFIED'
    AND entity_type = 'REVIEW'
    AND entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_user_recent_final
  ON reviews(user_id, created_at DESC, id DESC)
  WHERE status IN ('VERIFIED', 'REFERENCE_ONLY', 'REJECTED', 'HIDDEN');

CREATE INDEX IF NOT EXISTS idx_reviews_user_verified
  ON reviews(user_id, restaurant_id, created_at, id)
  WHERE status = 'VERIFIED';

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_verified_chronology
  ON reviews(restaurant_id, created_at, id)
  WHERE status = 'VERIFIED';

CREATE INDEX IF NOT EXISTS idx_receipts_restaurant_verified_decision
  ON receipt_verifications(restaurant_id, decided_at, id)
  WHERE decision = 'VERIFIED';
