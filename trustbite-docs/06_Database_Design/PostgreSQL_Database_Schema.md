# Đặc tả schema PostgreSQL - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Đặc tả schema cơ sở dữ liệu |
| Phiên bản | v2.7.0 (Nested Models & Extended Relations) |
| Trạng thái | Đã cập nhật |
| Chủ sở hữu | DBA / Kiến trúc sư hệ thống |
| Ngày cập nhật | 2026-06-09 |

---

## 1. Nguyên tắc thiết kế

- PostgreSQL 15+ với PostGIS cho truy vấn địa lý.
- Xác minh hóa đơn là quy trình độc lập, không nhét toàn bộ vào `reviews`.
- Mọi bảng vận hành quan trọng có `created_at`, `updated_at`.
- Dùng enum/status rõ ràng và đồng bộ với `State_Machines.md`.
- Hành động quan trọng của quản trị viên/chủ quán phải có audit log.
- Áp dụng các bảng liên kết Nhiều-Nhiều (Junction tables) để phân cấp cấu trúc thư mục Models Backend (`auth`, `user`, `restaurant`, `review`, `moderation`, `gamification`, `system`).

---

## 2. Các bảng Danh mục tĩnh (Seed Data)

Các bảng cấu hình hệ thống, được cài đặt sẵn một lần lúc deploy.

```sql
-- 2.1. roles - vai trò hệ thống
CREATE TABLE roles (
  id VARCHAR(30) PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2. rank_definitions - định nghĩa cấp bậc người dùng
CREATE TABLE rank_definitions (
  code VARCHAR(50) PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  min_exp INTEGER NOT NULL CHECK (min_exp >= 0),
  icon_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.3. badge_definitions - định nghĩa huy hiệu thành tựu
CREATE TABLE badge_definitions (
  code VARCHAR(80) PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  description TEXT,
  icon_url TEXT,
  category VARCHAR(40) NOT NULL CHECK (category IN ('ACHIEVEMENT', 'TRUST', 'GAMIFICATION')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.4. fraud_rule_configs - cấu hình chống gian lận
CREATE TABLE fraud_rule_configs (
  key VARCHAR(80) PRIMARY KEY,
  value_numeric NUMERIC(10,4),
  value_text TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.5. otp_purposes - mục đích OTP và TTL
CREATE TABLE otp_purposes (
  code VARCHAR(30) PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  ttl_seconds INTEGER NOT NULL CHECK (ttl_seconds > 0),
  max_attempts INTEGER NOT NULL CHECK (max_attempts > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.6. report_reason_codes - lý do báo cáo vi phạm
CREATE TABLE report_reason_codes (
  code VARCHAR(60) PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  entity_type VARCHAR(40) NOT NULL CHECK (entity_type IN ('REVIEW', 'USER', 'RESTAURANT')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.7. restaurant_categories - danh mục nhà hàng
CREATE TABLE restaurant_categories (
  id SERIAL PRIMARY KEY,
  code VARCHAR(60) UNIQUE NOT NULL,
  label VARCHAR(120) NOT NULL,
  icon_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.8. amenities - tiện ích đi kèm của quán
CREATE TABLE amenities (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(80) NOT NULL,
  icon_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.9. payment_methods - phương thức thanh toán
CREATE TABLE payment_methods (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.10. tags - nhãn đặc trưng
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(80) NOT NULL,
  category VARCHAR(40) NOT NULL CHECK (category IN ('REVIEW', 'MENU_ITEM')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 3. Các bảng vận hành cốt lõi (Runtime Data)

### 3.1. Người dùng & Xác thực

```sql
-- users - người dùng
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE,
  cognito_sub VARCHAR(255),
  display_name VARCHAR(120),
  date_of_birth DATE,
  avatar_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED')),
  exp_points INTEGER NOT NULL DEFAULT 0 CHECK (exp_points >= 0),
  rank_code VARCHAR(50) NOT NULL REFERENCES rank_definitions(code) DEFAULT 'NEWBIE',
  review_restricted_until TIMESTAMPTZ,
  deletion_requested_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_roles - liên kết quyền (N-N)
CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id VARCHAR(30) NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

-- otp_verifications - lịch sử OTP
CREATE TABLE otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose VARCHAR(30) NOT NULL REFERENCES otp_purposes(code),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED')),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_sessions - phiên đăng nhập
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  device_label VARCHAR(120),
  platform VARCHAR(30) CHECK (platform IN ('ANDROID', 'IOS', 'WEB')),
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_follows - mạng xã hội theo dõi chéo
CREATE TABLE user_follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT chk_not_self_follow CHECK (follower_id <> following_id)
);
```

### 3.2. Nhà hàng & Quản lý thực đơn

```sql
-- restaurants - thông tin chuỗi/quán mẹ
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(220) UNIQUE NOT NULL,
  description TEXT,
  phone_number VARCHAR(30),
  address TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  geo GEOGRAPHY(Point, 4326),
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED')),
  trust_score NUMERIC(3,2) DEFAULT 5.00 CHECK (trust_score BETWEEN 1.00 AND 5.00),
  verified_review_count INTEGER NOT NULL DEFAULT 0 CHECK (verified_review_count >= 0),
  reference_review_count INTEGER NOT NULL DEFAULT 0 CHECK (reference_review_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- restaurant_branches - các chi nhánh tọa độ GPS thực tế
CREATE TABLE restaurant_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  address TEXT NOT NULL,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  geo GEOGRAPHY(Point, 4326) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- menu_items - món trong thực đơn chuỗi mẹ
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  price_default NUMERIC(12,2) NOT NULL CHECK (price_default >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- branch_menu_items - món chi nhánh kèm giá và tình trạng riêng (N-N)
CREATE TABLE branch_menu_items (
  branch_id UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (branch_id, menu_item_id)
);

-- restaurant_operating_hours - giờ mở cửa của từng chi nhánh
CREATE TABLE restaurant_operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- restaurant_images - bộ sưu tập ảnh quán ăn
CREATE TABLE restaurant_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption VARCHAR(255),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.3. Đối tác (Merchant)

```sql
-- merchants - hồ sơ đối tác
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) UNIQUE ON DELETE RESTRICT,
  business_name VARCHAR(200) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (status IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- restaurant_merchants - phân quyền sở hữu/quản lý chi nhánh (N-N)
CREATE TABLE restaurant_merchants (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  permission_level VARCHAR(30) NOT NULL DEFAULT 'OWNER' CHECK (permission_level IN ('OWNER', 'MANAGER', 'STAFF')),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, merchant_id)
);

-- restaurant_claims - nhận quyền kinh doanh
CREATE TABLE restaurant_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
  evidence_url TEXT NOT NULL,
  admin_note TEXT,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ánh xạ Phân loại & Tiện ích & Thanh toán (Junction tables N-N)
CREATE TABLE restaurant_category_map (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES restaurant_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (restaurant_id, category_id)
);

CREATE TABLE restaurant_amenities (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  amenity_id INTEGER NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (restaurant_id, amenity_id)
);

CREATE TABLE restaurant_payment_methods (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
  PRIMARY KEY (restaurant_id, payment_method_id)
);
```

### 3.4. Đánh giá & Quy trình xác minh hóa đơn (Anti-Fraud)

```sql
-- reviews - đánh giá của khách hàng
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES restaurant_branches(id) ON DELETE SET NULL,
  food_rating SMALLINT NOT NULL CHECK (food_rating BETWEEN 1 AND 5),
  price_rating SMALLINT NOT NULL CHECK (price_rating BETWEEN 1 AND 5),
  service_rating SMALLINT NOT NULL CHECK (service_rating BETWEEN 1 AND 5),
  ambience_rating SMALLINT NOT NULL CHECK (ambience_rating BETWEEN 1 AND 5),
  average_rating NUMERIC(3,2) GENERATED ALWAYS AS ((food_rating + price_rating + service_rating + ambience_rating) / 4.0) STORED,
  comment TEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  verification_status VARCHAR(40) NOT NULL DEFAULT 'UNVERIFIED',
  trust_label VARCHAR(40) NOT NULL DEFAULT 'PENDING_VERIFICATION',
  public_visibility VARCHAR(40) NOT NULL DEFAULT 'PRIVATE_UNTIL_DECISION',
  trust_weight_bucket VARCHAR(20) NOT NULL DEFAULT 'NONE',
  visited_at TIMESTAMPTZ,
  hidden_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- review_tags - gắn nhãn review (N-N)
CREATE TABLE review_tags (
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (review_id, tag_id)
);

-- review_replies - phản hồi của chủ quán
CREATE TABLE review_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'HIDDEN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- receipt_verifications - xác minh hóa đơn (OCR & GPS)
CREATE TABLE receipt_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES restaurant_branches(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_hash_sha256 CHAR(64) NOT NULL,
  transaction_unique_hash CHAR(64),
  status VARCHAR(40) NOT NULL DEFAULT 'UPLOADED',
  ocr_text TEXT,
  ocr_restaurant_name VARCHAR(200),
  ocr_similarity NUMERIC(5,2),
  ocr_receipt_time TIMESTAMPTZ,
  ocr_invoice_no VARCHAR(120),
  ocr_total_amount NUMERIC(14,2),
  gps_latitude NUMERIC(10,7),
  gps_longitude NUMERIC(10,7),
  gps_accuracy_meters NUMERIC(10,2),
  gps_distance_meters NUMERIC(10,2),
  fraud_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (fraud_risk_score BETWEEN 0 AND 100),
  decision VARCHAR(40) CHECK (decision IN ('VERIFIED', 'REJECTED', 'REFERENCE_ONLY')),
  redacted_file_url TEXT,
  decision_reason TEXT,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- receipt_line_items - các dòng chi tiết trên hóa đơn (OCR)
CREATE TABLE receipt_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_verification_id UUID NOT NULL REFERENCES receipt_verifications(id) ON DELETE CASCADE,
  raw_item_name VARCHAR(200) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1.00 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- receipt_line_item_menu_maps - ánh xạ món ăn từ bill sang menu hệ thống (N-N)
CREATE TABLE receipt_line_item_menu_maps (
  receipt_line_item_id UUID NOT NULL REFERENCES receipt_line_items(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  confidence_score NUMERIC(5,2) NOT NULL CHECK (confidence_score BETWEEN 0.00 AND 100.00),
  PRIMARY KEY (receipt_line_item_id, menu_item_id)
);

-- review_media - media của review
CREATE TABLE review_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  media_type VARCHAR(30) NOT NULL CHECK (media_type IN ('IMAGE', 'VIDEO')),
  url TEXT NOT NULL,
  mime_type VARCHAR(80),
  file_size_bytes INTEGER,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- review_votes - bầu chọn hữu ích
CREATE TABLE review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  vote_type VARCHAR(30) NOT NULL DEFAULT 'HELPFUL' CHECK (vote_type IN ('HELPFUL', 'NOT_HELPFUL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id, vote_type)
);

-- review_reactions - một cảm xúc công khai cho mỗi user/review
CREATE TABLE review_reactions (
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(10) NOT NULL CHECK (reaction_type IN ('LOVE', 'HAHA', 'ANGRY')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

-- review_translations - cache bản dịch bình luận review
CREATE TABLE review_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  target_locale VARCHAR(10) NOT NULL,
  source_locale VARCHAR(10),
  original_text_hash VARCHAR(64) NOT NULL,
  translated_text TEXT NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'GOOGLE_TRANSLATE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, target_locale, original_text_hash)
);

CREATE INDEX idx_review_translations_review_locale_created
  ON review_translations (review_id, target_locale, created_at DESC);

-- price_history - lịch sử giá món ăn
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES restaurant_branches(id) ON DELETE SET NULL,
  observed_price NUMERIC(12,2) NOT NULL CHECK (observed_price >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  source VARCHAR(40) NOT NULL CHECK (source IN ('OCR_RECEIPT', 'MERCHANT_UPDATE', 'MANUAL')),
  review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- review_summaries - tóm tắt AI (P2)
CREATE TABLE review_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  model_version VARCHAR(80) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_count INTEGER NOT NULL CHECK (review_count >= 0),
  avg_rating NUMERIC(3,2) NOT NULL
);
```

### 3.5. Gamification & Bộ sưu tập

```sql
-- user_badges - huy hiệu của người dùng (N-N)
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_code VARCHAR(80) NOT NULL REFERENCES badge_definitions(code) ON DELETE RESTRICT,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_code)
);

-- exp_transactions - lịch sử nhận EXP
CREATE TABLE exp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) CHECK (entity_type IN ('REVIEW', 'RECEIPT')),
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_saved_lists - bộ sưu tập lưu quán ăn
CREATE TABLE user_saved_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_saved_list_restaurants - chi tiết các nhà hàng trong danh sách lưu (N-N)
CREATE TABLE user_saved_list_restaurants (
  saved_list_id UUID NOT NULL REFERENCES user_saved_lists(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (saved_list_id, restaurant_id)
);
```

### 3.6. Báo cáo vi phạm & Chống gian lận

```sql
-- moderation_reports - báo cáo vi phạm từ user
CREATE TABLE moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entity_type VARCHAR(40) NOT NULL CHECK (entity_type IN ('REVIEW', 'USER', 'RESTAURANT')),
  entity_id UUID NOT NULL,
  reason_code VARCHAR(60) NOT NULL REFERENCES report_reason_codes(code),
  description TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'CLOSED', 'ACTION_TAKEN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- moderation_actions - hành động xử lý của Admin
CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES moderation_reports(id) ON DELETE SET NULL,
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action_type VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- fraud_flags - cờ gian lận
CREATE TABLE fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_code VARCHAR(50) NOT NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  status VARCHAR(40) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- fraud_flag_entities - các thực thể bị gắn cờ (N-N)
CREATE TABLE fraud_flag_entities (
  fraud_flag_id UUID NOT NULL REFERENCES fraud_flags(id) ON DELETE CASCADE,
  entity_type VARCHAR(40) NOT NULL CHECK (entity_type IN ('USER', 'REVIEW', 'RECEIPT_VERIFICATION')),
  entity_id UUID NOT NULL,
  PRIMARY KEY (fraud_flag_id, entity_type, entity_id)
);
```

### 3.7. Đẩy tin, Bảo mật & Hạ tầng

```sql
-- push_tokens - token đẩy thông báo mobile
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(30) NOT NULL CHECK (platform IN ('ANDROID', 'IOS')),
  token_ciphertext TEXT NOT NULL,
  token_fingerprint TEXT NOT NULL,
  provider VARCHAR(30) NOT NULL CHECK (provider IN ('FCM', 'APNS')),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token_fingerprint)
);

-- notifications - hộp thư thông báo
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- notification_delivery_logs - nhật ký gửi push notification
CREATE TABLE notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  push_token_id UUID NOT NULL REFERENCES push_tokens(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL CHECK (status IN ('SENT', 'FAILED', 'BOUNCED')),
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- idempotency_keys - khóa chống lặp request
CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint VARCHAR(120) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
  response_status_code INTEGER,
  response_body JSONB,
  resource_type VARCHAR(60),
  resource_id UUID,
  locked_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint, idempotency_key)
);

-- audit_logs - nhật ký kiểm toán (Append-Only)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(40),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID,
  previous_status VARCHAR(40),
  new_status VARCHAR(40),
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- account_deletion_requests - yêu cầu xóa tài khoản
CREATE TABLE account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(40) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'PROCESSING', 'COMPLETED', 'CANCELLED')),
  reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_deletion_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  retained_data_reason TEXT,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_blocks - danh sách người dùng bị chặn
CREATE TABLE user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason_code VARCHAR(60),
  source_review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(blocker_user_id, blocked_user_id),
  CONSTRAINT chk_not_self_block CHECK (blocker_user_id <> blocked_user_id)
);
```

### 3.8. Hàng đợi kiểm duyệt dành cho Quản trị viên (Admin Queues)

```sql
-- admin_queues - hàng đợi công việc của admin
CREATE TABLE admin_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_type VARCHAR(40) NOT NULL CHECK (queue_type IN ('CLAIM_VERIFICATION', 'RECEIPT_AUDIT', 'USER_REPORT')),
  entity_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ASSIGNED', 'COMPLETED', 'ESCALATED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- admin_queue_assignments - phân công hàng đợi cho admin (N-N)
CREATE TABLE admin_queue_assignments (
  queue_id UUID NOT NULL REFERENCES admin_queues(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  PRIMARY KEY (queue_id, admin_user_id)
);
```

---

## 4. Triggers cập nhật thời gian (`updated_at`) tự động

Mọi bảng vận hành có cột `updated_at` sẽ áp dụng trigger Set Timestamp trước khi update:

```sql
-- Hàm trigger set timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gán trigger cho các bảng vận hành
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_user_sessions_updated_at BEFORE UPDATE ON user_sessions FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_restaurant_branches_updated_at BEFORE UPDATE ON restaurant_branches FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_branch_menu_items_updated_at BEFORE UPDATE ON branch_menu_items FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_restaurant_operating_hours_updated_at BEFORE UPDATE ON restaurant_operating_hours FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_merchants_updated_at BEFORE UPDATE ON merchants FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_restaurant_claims_updated_at BEFORE UPDATE ON restaurant_claims FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_review_replies_updated_at BEFORE UPDATE ON review_replies FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_receipt_verifications_updated_at BEFORE UPDATE ON receipt_verifications FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_user_saved_lists_updated_at BEFORE UPDATE ON user_saved_lists FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_moderation_reports_updated_at BEFORE UPDATE ON moderation_reports FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_push_tokens_updated_at BEFORE UPDATE ON push_tokens FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_idempotency_keys_updated_at BEFORE UPDATE ON idempotency_keys FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_account_deletion_requests_updated_at BEFORE UPDATE ON account_deletion_requests FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER trg_admin_queues_updated_at BEFORE UPDATE ON admin_queues FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
```

---

## 5. Chiến lược đặt Index tối ưu hóa truy vấn

```sql
-- 5.1. Định vị địa lý không gian (PostGIS GIST)
CREATE INDEX idx_restaurants_geo ON restaurants USING GIST(geo);
CREATE INDEX idx_restaurant_branches_geo ON restaurant_branches USING GIST(geo);

-- 5.2. Khóa ngoại và bảng junction Nhiều-Nhiều
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_restaurant_merchants_merchant ON restaurant_merchants(merchant_id);
CREATE INDEX idx_branch_menu_items_item ON branch_menu_items(menu_item_id);
CREATE INDEX idx_review_tags_tag ON review_tags(tag_id);
CREATE INDEX idx_user_saved_list_rest ON user_saved_list_restaurants(restaurant_id);
CREATE INDEX idx_fraud_flag_entities_entity ON fraud_flag_entities(entity_type, entity_id);

-- 5.3. Tối ưu tìm kiếm và an toàn giao dịch
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id, revoked_at);
CREATE INDEX idx_reviews_restaurant_status ON reviews(restaurant_id, status);
CREATE INDEX idx_reviews_public_trust ON reviews(restaurant_id, public_visibility, trust_weight_bucket);
CREATE INDEX idx_receipt_verifications_review ON receipt_verifications(review_id);
CREATE INDEX idx_receipt_verifications_status ON receipt_verifications(status);

-- 5.4. Các điều kiện độc nhất riêng lẻ (Unique Partial Indexes)
CREATE UNIQUE INDEX idx_receipts_hash_uniq ON receipt_verifications(file_hash_sha256) 
  WHERE status NOT IN ('OCR_FAILED');
CREATE UNIQUE INDEX idx_receipts_trx_uniq ON receipt_verifications(transaction_unique_hash) 
  WHERE transaction_unique_hash IS NOT NULL AND status = 'VERIFIED';
CREATE UNIQUE INDEX idx_reports_open_uniq ON moderation_reports(reporter_id, entity_type, entity_id)
  WHERE status NOT IN ('CLOSED', 'ACTION_TAKEN');
CREATE UNIQUE INDEX idx_account_deletion_open_uniq ON account_deletion_requests(user_id)
  WHERE status IN ('REQUESTED', 'PROCESSING');
```
