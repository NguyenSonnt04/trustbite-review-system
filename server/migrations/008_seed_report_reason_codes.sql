-- 008_seed_report_reason_codes.sql
-- TB-REPORT-001: provisional MVP seed for report_reason_codes so the moderation
-- report endpoint (POST /api/v1/moderation/reports) can satisfy the NOT NULL FK
-- moderation_reports.reason_code -> report_reason_codes(code).
--
-- The catalog is PROVISIONAL pending Product/Ops finalization (see decision 0020).
-- Idempotent: safe to re-run; operator-added codes are preserved.
--
-- Rollback (removes only the seeded rows, keeps any operator-added codes):
--   DELETE FROM report_reason_codes WHERE code IN (
--     'SPAM_OR_FAKE','OFFENSIVE_CONTENT','IRRELEVANT_CONTENT','OTHER_REVIEW',
--     'ABUSIVE_BEHAVIOR','IMPERSONATION','SPAM_ACCOUNT','OTHER_USER',
--     'INCORRECT_INFO','CLOSED_OR_NONEXISTENT','INAPPROPRIATE_LISTING','OTHER_RESTAURANT'
--   );

INSERT INTO report_reason_codes (code, label, entity_type) VALUES
  ('SPAM_OR_FAKE', 'Spam hoặc đánh giá giả', 'REVIEW'),
  ('OFFENSIVE_CONTENT', 'Nội dung xúc phạm hoặc không phù hợp', 'REVIEW'),
  ('IRRELEVANT_CONTENT', 'Nội dung không liên quan đến quán', 'REVIEW'),
  ('OTHER_REVIEW', 'Lý do khác (đánh giá)', 'REVIEW'),
  ('ABUSIVE_BEHAVIOR', 'Hành vi lạm dụng hoặc quấy rối', 'USER'),
  ('IMPERSONATION', 'Mạo danh người khác', 'USER'),
  ('SPAM_ACCOUNT', 'Tài khoản spam', 'USER'),
  ('OTHER_USER', 'Lý do khác (người dùng)', 'USER'),
  ('INCORRECT_INFO', 'Thông tin quán sai lệch', 'RESTAURANT'),
  ('CLOSED_OR_NONEXISTENT', 'Quán đã đóng cửa hoặc không tồn tại', 'RESTAURANT'),
  ('INAPPROPRIATE_LISTING', 'Nội dung quán không phù hợp', 'RESTAURANT'),
  ('OTHER_RESTAURANT', 'Lý do khác (quán)', 'RESTAURANT')
ON CONFLICT (code) DO NOTHING;
