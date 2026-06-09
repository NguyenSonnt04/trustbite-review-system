# Từ điển dữ liệu - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Data dictionary |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | DBA / BA |
| Ngày cập nhật | 2026-06-07 |

---

## Thực thể cốt lõi

| Bảng | Mục đích | Trường chính |
|---|---|---|
| users | Tài khoản người dùng, quản trị viên hoặc tài khoản liên kết với chủ quán | id, phone_number, status, role, exp_points, rank_code |
| otp_verifications | Lưu OTP và trạng thái xác thực/rate limit | phone_number, otp_hash, status, failed_attempts, expires_at |
| user_sessions | Phiên đăng nhập/refresh token hash cho mobile/web nếu dùng server-side session | user_id, refresh_token_hash, platform, revoked_at, expires_at |
| account_deletion_requests | Theo dõi yêu cầu xóa tài khoản/dữ liệu và audit tối thiểu | user_id, status, requested_at, scheduled_deletion_at, completed_at |
| restaurants | Hồ sơ quán chính | name, address, geo, status, trust_score |
| restaurant_branches | Chi nhánh quán/chuỗi | parent_restaurant_id, name, geo, status |
| merchants | Hồ sơ chủ quán | user_id, business_name, status |
| restaurant_claims | Yêu cầu claim quán | merchant_id, restaurant_id, status, evidence_url |
| menu_items | Menu và giá | restaurant_id, name, price, status |
| reviews | Đánh giá của người dùng | ratings, comment, status, verification_status |
| receipt_verifications | Quy trình xác minh hóa đơn | file_hash_sha256, ocr_text, gps_distance_meters, fraud_risk_score, decision |
| idempotency_keys | Chống tạo trùng request khi mobile retry | idempotency_key, user_id, endpoint, request_hash, status, resource_id, expires_at |
| review_media | Ảnh/video của đánh giá | review_id, media_type, url, status |
| review_votes | Bình chọn hữu ích | review_id, user_id, vote_type |
| user_blocks | Danh sách người dùng bị chặn/hạn chế tương tác | blocker_user_id, blocked_user_id, reason_code, deleted_at |
| review_replies | Phản hồi của chủ quán cho đánh giá | review_id, merchant_id, message, status |
| user_badges | Huy hiệu người dùng P1/tương lai | user_id, badge_code, awarded_at |
| favorites | Quán yêu thích | user_id, restaurant_id |
| moderation_reports | Báo cáo vi phạm | reporter_id, entity_type, reason_code, status |
| moderation_actions | Hành động kiểm duyệt | report_id, admin_id, action_type, reason |
| fraud_flags | Tín hiệu gian lận | entity_type, entity_id, flag_type, risk_score, status |
| device_fingerprints | Tín hiệu rủi ro bảo mật tùy chọn | user_id, fingerprint_hash, expires_at |
| notifications | Thông báo | recipient_user_id, type, title, read_at |
| push_tokens | Token thông báo mobile P1 nếu dùng FCM/APNs | user_id, platform, token_hash, provider, status |
| audit_logs | Lịch sử hành động quan trọng | actor_id, action, entity_type, previous_status, new_status, reason |

## Phân loại dữ liệu nhạy cảm

| Dữ liệu | Phân loại | Ghi chú |
|---|---|---|
| Số điện thoại | Dữ liệu cá nhân | Nên che trong giao diện quản trị khi không cần xem đầy đủ. |
| Ảnh hóa đơn | Bằng chứng người dùng tải lên, có thể chứa dữ liệu nhạy cảm | Lưu riêng tư và che dữ liệu trước khi hiển thị công khai. |
| Vị trí GPS | Dữ liệu vị trí nhạy cảm | Tùy chọn, cần giới hạn thời gian lưu giữ. |
| Hash thiết bị/IP | Dữ liệu bảo mật | Lưu dạng băm và chỉ giữ trong thời gian ngắn. |
| Token phiên/push | Dữ liệu bảo mật | Lưu hash hoặc bảo vệ bằng cơ chế mã hóa/quyền truy cập chặt chẽ. |
| Audit log | Hồ sơ vận hành/pháp lý | Chỉ người có quyền mới được truy cập. |
| Yêu cầu xóa tài khoản | Dữ liệu privacy/legal operations | Chỉ lưu tối thiểu để chứng minh xử lý yêu cầu và lý do giữ dữ liệu nếu có. |
| Danh sách chặn | Dữ liệu an toàn cộng đồng | Dùng để bảo vệ trải nghiệm UGC, không dùng cho quảng cáo/profiling. |