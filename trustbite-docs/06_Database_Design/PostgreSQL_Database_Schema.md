# Đặc tả schema PostgreSQL - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Đặc tả schema cơ sở dữ liệu |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | DBA / Kiến trúc sư hệ thống |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Nguyên tắc thiết kế

- PostgreSQL 15+ với PostGIS cho truy vấn địa lý.
- Xác minh hóa đơn là quy trình độc lập, không nhét toàn bộ vào `reviews`.
- Mọi bảng vận hành quan trọng có `created_at`, `updated_at`.
- Dùng enum/status rõ ràng và đồng bộ với `State_Machines.md`.
- Hành động quan trọng của quản trị viên/chủ quán phải có audit log.

---

## 2. Bảng cốt lõi

## 2.1. users - người dùng

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  display_name VARCHAR(120),
  avatar_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  role VARCHAR(30) NOT NULL DEFAULT 'USER',
  exp_points INTEGER NOT NULL DEFAULT 0,
  rank_code VARCHAR(50) NOT NULL DEFAULT 'NEWBIE',
  review_restricted_until TIMESTAMPTZ,
  deletion_requested_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2.2. otp_verifications - xác thực OTP

```sql
CREATE TABLE otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2.3. user_sessions - phiên đăng nhập mobile/web

```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  refresh_token_hash TEXT NOT NULL,
  device_label VARCHAR(120),
  platform VARCHAR(30),
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Ghi chú: bảng này dùng nếu auth strategy chọn refresh/session token có trạng thái phía server. Token thô không được lưu trong DB.

## 2.4. restaurants - quán

```sql
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(220) UNIQUE,
  description TEXT,
  phone_number VARCHAR(30),
  address TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  geo GEOGRAPHY(Point, 4326),
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  trust_score NUMERIC(3,2),
  verified_review_count INTEGER NOT NULL DEFAULT 0,
  reference_review_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2.5. restaurant_branches - chi nhánh quán

```sql
CREATE TABLE restaurant_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_restaurant_id UUID REFERENCES restaurants(id),
  name VARCHAR(200) NOT NULL,
  address TEXT NOT NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  geo GEOGRAPHY(Point, 4326),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2.6. merchants - chủ quán

```sql
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  business_name VARCHAR(200),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_VERIFICATION',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2.7. restaurant_claims - claim quán

```sql
CREATE TABLE restaurant_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
  evidence_url TEXT,
  admin_note TEXT,
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2.8. menu_items - món trong menu

```sql
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  name VARCHAR(200) NOT NULL,
  price NUMERIC(12,2),
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2.9. reviews - đánh giá

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
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
```

## 2.10. receipt_verifications - xác minh hóa đơn

```sql
CREATE TABLE receipt_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id),
  user_id UUID NOT NULL REFERENCES users(id),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  file_url TEXT NOT NULL,
  file_hash_sha256 CHAR(64) NOT NULL,
  transaction_unique_hash CHAR(64),
  status VARCHAR(40) NOT NULL DEFAULT 'UPLOADED',
  ocr_text TEXT,
  ocr_restaurant_name VARCHAR(200),
  ocr_similarity NUMERIC(5,2),
  ocr_receipt_time TIMESTAMPTZ,
  gps_latitude NUMERIC(10,7),
  gps_longitude NUMERIC(10,7),
  gps_accuracy_meters NUMERIC(10,2),
  gps_distance_meters NUMERIC(10,2),
  fraud_risk_score INTEGER NOT NULL DEFAULT 0,
  decision VARCHAR(40),
  redacted_file_url TEXT,
  decision_reason TEXT,
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2.11. review_media - media đánh giá

```sql
CREATE TABLE review_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id),
  media_type VARCHAR(30) NOT NULL,
  url TEXT NOT NULL,
  mime_type VARCHAR(80),
  file_size_bytes INTEGER,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2.12. review_votes - bình chọn đánh giá

```sql
CREATE TABLE review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id),
  user_id UUID NOT NULL REFERENCES users(id),
  vote_type VARCHAR(30) NOT NULL DEFAULT 'HELPFUL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id, vote_type)
);
```

## 2.13. review_replies - phản hồi chủ quán

```sql
CREATE TABLE review_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id),
  merchant_id UUID NOT NULL REFERENCES merchants(id),
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2.14. user_badges - huy hiệu người dùng

```sql
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  badge_code VARCHAR(80) NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_code)
);
```

Ghi chú: huy hiệu chi tiết là P1/tương lai; bảng có thể trì hoãn nếu MVP chỉ dùng `exp_points` và `rank_code`.

## 2.15. favorites - quán yêu thích

```sql
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);
```

## 2.16. moderation_reports - báo cáo kiểm duyệt

```sql
CREATE TABLE moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id),
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID NOT NULL,
  reason_code VARCHAR(60) NOT NULL,
  description TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'SUBMITTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2.17. moderation_actions - hành động kiểm duyệt

```sql
CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES moderation_reports(id),
  admin_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2.18. fraud_flags - cờ gian lận

```sql
CREATE TABLE fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES users(id),
  flag_type VARCHAR(80) NOT NULL,
  risk_score INTEGER NOT NULL,
  reason TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
```

## 2.19. device_fingerprints - fingerprint thiết bị

```sql
CREATE TABLE device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  fingerprint_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64),
  user_agent_hash CHAR(64),
  purpose VARCHAR(50) NOT NULL DEFAULT 'SECURITY_RISK_SIGNAL',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Ghi chú: bảng này chỉ dùng nếu có sự đồng ý/cơ sở pháp lý phù hợp. MVP có thể chỉ lưu hash IP/user-agent ngắn hạn cho giới hạn tần suất.

## 2.20. notifications - thông báo

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2.21. push_tokens - token thông báo mobile

```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  platform VARCHAR(30) NOT NULL,
  token_hash TEXT NOT NULL,
  provider VARCHAR(30),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token_hash)
);
```

Ghi chú: push notification là P1. Không lưu raw token nếu không cần thiết cho provider integration; nếu cần raw token, phải mã hóa hoặc bảo vệ theo chính sách secret/data access.

## 2.22. idempotency_keys - khóa chống tạo trùng request

```sql
CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  endpoint VARCHAR(120) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
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
```

Ghi chú: bảng này bắt buộc cho `POST /receipts` và khuyến nghị cho `POST /reviews`. Xem `04_Software_Engineering/Idempotency_and_Retry_Design.md`.

## 2.23. audit_logs - nhật ký kiểm toán

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
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
```

## 2.24. account_deletion_requests - yêu cầu xóa tài khoản/dữ liệu

```sql
CREATE TABLE account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(40) NOT NULL DEFAULT 'REQUESTED',
  reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_deletion_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  retained_data_reason TEXT,
  processed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Ghi chú: chỉ cho phép một request mở trên mỗi user. Khi hoàn tất, phải revoke session/push token và xóa hoặc ẩn danh hóa PII theo `Data_Retention_Policy.md`.

## 2.25. user_blocks - danh sách người dùng bị chặn

```sql
CREATE TABLE user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id UUID NOT NULL REFERENCES users(id),
  blocked_user_id UUID NOT NULL REFERENCES users(id),
  reason_code VARCHAR(60),
  source_review_id UUID REFERENCES reviews(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(blocker_user_id, blocked_user_id)
);
```

Ghi chú: không cho phép `blocker_user_id = blocked_user_id`. Soft delete bằng `deleted_at` nếu cần audit/bỏ chặn.

---

## 3. Chiến lược index

```sql
CREATE INDEX idx_users_phone_number ON users(phone_number);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id, revoked_at);
CREATE INDEX idx_account_deletion_requests_user_status ON account_deletion_requests(user_id, status);
CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_user_id, deleted_at);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_user_id, deleted_at);
CREATE INDEX idx_restaurants_status ON restaurants(status);
CREATE INDEX idx_restaurants_geo ON restaurants USING GIST(geo);
CREATE INDEX idx_reviews_restaurant_status ON reviews(restaurant_id, status);
CREATE INDEX idx_reviews_public_trust ON reviews(restaurant_id, public_visibility, trust_weight_bucket);
CREATE INDEX idx_reviews_user_restaurant ON reviews(user_id, restaurant_id);
CREATE UNIQUE INDEX idx_receipts_hash_unique ON receipt_verifications(file_hash_sha256);
CREATE UNIQUE INDEX idx_receipts_transaction_unique ON receipt_verifications(transaction_unique_hash) WHERE transaction_unique_hash IS NOT NULL;
CREATE INDEX idx_receipts_review ON receipt_verifications(review_id);
CREATE INDEX idx_receipts_status ON receipt_verifications(status);
CREATE INDEX idx_review_replies_review ON review_replies(review_id);
CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_reports_status ON moderation_reports(status);
CREATE INDEX idx_fraud_flags_entity ON fraud_flags(entity_type, entity_id);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_user_id, read_at);
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id, status);
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_resource ON idempotency_keys(resource_type, resource_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
```

---

## 4. Giá trị trạng thái

Trạng thái chi tiết xem `02_Business_Analysis/State_Machines.md` và mapping API/DB/UI xem `02_Business_Analysis/Status_Mapping.md`. Database dùng varchar ở MVP để linh hoạt, sau khi ổn định có thể chuyển sang PostgreSQL enum.

---

## 5. Khuyến nghị trigger / job

| Job/Trigger | Mục tiêu |
|---|---|
| `updated_at` trigger | Tự động cập nhật timestamp. |
| Job tính lại điểm tin cậy | Chạy khi trạng thái đánh giá đổi sang VERIFIED/HIDDEN/DELETED. |
| Job OCR hóa đơn bất đồng bộ | Xử lý OCR ngoài request chính. |
| Job hết hạn review chưa có receipt | Chuyển review `SUBMITTED` không có receipt sau 24 giờ sang `REFERENCE_ONLY`. |
| Job dọn idempotency key | Xóa hoặc đánh dấu hết hạn key theo TTL trong `Idempotency_and_Retry_Design.md`. |
| Job thông báo | P1/feature flag; MVP dùng refetch/polling. |
| Job dọn dữ liệu retention | Xóa/ẩn dữ liệu theo `Data_Retention_Policy.md`. |
| Job xử lý account deletion | Thực thi xóa/ẩn danh hóa PII, revoke session/push token và ghi audit cho `account_deletion_requests`. |
