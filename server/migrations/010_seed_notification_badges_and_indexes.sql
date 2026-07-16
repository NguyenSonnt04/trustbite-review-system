INSERT INTO rank_definitions (code, label, min_exp, description)
VALUES
  ('APPRENTICE', 'Apprentice', 100, 'Reached 100 EXP with at least 2 verified reviews.'),
  ('FOODIE', 'Foodie', 500, 'Reached 500 EXP with at least 10 verified reviews.'),
  ('TRUSTED_FOODIE', 'Trusted Foodie', 2000, 'Reached 2000 EXP with at least 25 verified reviews.')
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    min_exp = EXCLUDED.min_exp,
    description = EXCLUDED.description;

INSERT INTO badge_definitions (code, label, description, category)
VALUES
  (
    'RECEIPT_MASTER',
    'Bậc thầy hóa đơn',
    'Đạt 10 đánh giá đã xác minh liên tiếp.',
    'ACHIEVEMENT'
  ),
  (
    'EXPLORER',
    'Người khám phá',
    'Là người đầu tiên có đánh giá đã xác minh cho 5 quán.',
    'ACHIEVEMENT'
  )
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications(recipient_user_id, created_at DESC);

WITH duplicates AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY recipient_user_id, payload ->> 'reviewId'
        ORDER BY created_at, id
      ) AS row_number
    FROM notifications
    WHERE type = 'REVIEW_VERIFIED' AND payload ? 'reviewId'
  ) ranked
  WHERE row_number > 1
)
DELETE FROM notifications
WHERE id IN (SELECT id FROM duplicates);

WITH duplicates AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY recipient_user_id, payload ->> 'badgeCode'
        ORDER BY created_at, id
      ) AS row_number
    FROM notifications
    WHERE type = 'BADGE_EARNED' AND payload ? 'badgeCode'
  ) ranked
  WHERE row_number > 1
)
DELETE FROM notifications
WHERE id IN (SELECT id FROM duplicates);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_review_verified_uniq
  ON notifications(recipient_user_id, ((payload ->> 'reviewId')))
  WHERE type = 'REVIEW_VERIFIED' AND payload ? 'reviewId';

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_badge_earned_uniq
  ON notifications(recipient_user_id, ((payload ->> 'badgeCode')))
  WHERE type = 'BADGE_EARNED' AND payload ? 'badgeCode';
