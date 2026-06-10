# Từ điển dữ liệu - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Data dictionary |
| Phiên bản | v2.7.0 |
| Trạng thái | Đã cập nhật |
| Chủ sở hữu | DBA / BA |
| Ngày cập nhật | 2026-06-09 |

---

## Thực thể cốt lõi

| Bảng | Mục đích | Trường chính |
|---|---|---|
| roles | Vai trò hệ thống dạng seed data | id, label, description |
| user_roles | Liên kết nhiều-nhiều giữa người dùng và vai trò | user_id, role_id, assigned_at |
| rank_definitions | Định nghĩa cấp bậc người dùng | code, label, min_exp |
| users | Tài khoản người dùng, quản trị viên hoặc tài khoản liên kết với chủ quán | id, phone_number, status, exp_points, rank_code |
| otp_verifications | Lưu OTP và trạng thái xác thực/rate limit | phone_number, otp_hash, status, failed_attempts, expires_at |
| user_sessions | Phiên đăng nhập/refresh token hash cho mobile/web nếu dùng server-side session | user_id, refresh_token_hash, platform, revoked_at, expires_at |
| account_deletion_requests | Theo dõi yêu cầu xóa tài khoản/dữ liệu và audit tối thiểu | user_id, status, requested_at, scheduled_deletion_at, completed_at |
| restaurant_categories | Danh mục nhà hàng dạng seed data | id, code, label |
| amenities | Tiện ích nhà hàng dạng seed data | id, code, label |
| payment_methods | Phương thức thanh toán dạng seed data | id, code, label |
| restaurants | Hồ sơ quán chính | name, address, geo, status, trust_score |
| restaurant_branches | Chi nhánh quán/chuỗi | parent_restaurant_id, name, geo, status |
| restaurant_category_map | Liên kết nhà hàng với danh mục | restaurant_id, category_id |
| restaurant_amenities | Liên kết nhà hàng với tiện ích | restaurant_id, amenity_id |
| restaurant_payment_methods | Liên kết nhà hàng với phương thức thanh toán | restaurant_id, payment_method_id |
| merchants | Hồ sơ chủ quán | user_id, business_name, status |
| restaurant_claims | Yêu cầu claim quán | merchant_id, restaurant_id, status, evidence_url |
| menu_items | Menu và giá mặc định | restaurant_id, name, price_default, status |
| branch_menu_items | Giá và tình trạng món theo chi nhánh | branch_id, menu_item_id, price, is_available |
| tags | Nhãn đặc trưng dạng seed data | id, code, label, category |
| reviews | Đánh giá của người dùng | ratings, comment, status, verification_status |
| receipt_verifications | Quy trình xác minh hóa đơn | file_hash_sha256, ocr_text, gps_distance_meters, fraud_risk_score, decision |
| receipt_line_items | Chi tiết dòng hóa đơn OCR | receipt_verification_id, raw_item_name, quantity, unit_price, total_price |
| receipt_line_item_menu_maps | Liên kết dòng hóa đơn với món trong menu | receipt_line_item_id, menu_item_id, confidence_score |
| idempotency_keys | Chống tạo trùng request khi mobile retry | idempotency_key, user_id, endpoint, request_hash, status, resource_id, expires_at |
| review_media | Ảnh/video của đánh giá | review_id, media_type, url, status |
| review_votes | Bình chọn hữu ích | review_id, user_id, vote_type |
| review_translations | Cache bản dịch bình luận review | review_id, target_locale, original_text_hash, translated_text, provider, created_at |
| user_blocks | Danh sách người dùng bị chặn/hạn chế tương tác | blocker_user_id, blocked_user_id, reason_code, deleted_at |
| review_replies | Phản hồi của chủ quán cho đánh giá | review_id, merchant_id, message, status |
| badge_definitions | Định nghĩa huy hiệu dạng seed data | code, label, category |
| user_badges | Huy hiệu người dùng P1/tương lai | user_id, badge_code, awarded_at |
| exp_transactions | Lịch sử cộng/trừ EXP | user_id, delta, reason, entity_type, entity_id |
| user_saved_lists | Bộ sưu tập lưu quán ăn | user_id, name, is_public |
| user_saved_list_restaurants | Nhà hàng trong bộ sưu tập đã lưu | saved_list_id, restaurant_id |
| report_reason_codes | Lý do báo cáo vi phạm dạng seed data | code, label, entity_type |
| moderation_reports | Báo cáo vi phạm | reporter_id, entity_type, reason_code, status |
| moderation_actions | Hành động kiểm duyệt | report_id, admin_id, action_type, reason |
| fraud_rule_configs | Cấu hình luật chống gian lận | key, value_numeric, value_text |
| fraud_flags | Tín hiệu gian lận | flag_code, risk_score, status |
| fraud_flag_entities | Liên kết cờ gian lận với thực thể liên quan | fraud_flag_id, entity_type, entity_id |
| notifications | Thông báo | recipient_user_id, type, title, read_at |
| notification_delivery_logs | Nhật ký gửi push notification | notification_id, push_token_id, status |
| push_tokens | Token thông báo mobile P1 nếu dùng FCM/APNs | user_id, platform, token_ciphertext, token_fingerprint, provider, status |
| audit_logs | Lịch sử hành động quan trọng | actor_id, action, entity_type, previous_status, new_status, reason |
| admin_queues | Hàng đợi công việc quản trị | queue_type, entity_id, status |
| admin_queue_assignments | Phân công hàng đợi cho admin | queue_id, admin_user_id, assigned_at, resolved_at |

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
