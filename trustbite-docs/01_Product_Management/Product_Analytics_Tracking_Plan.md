# Kế hoạch tracking analytics sản phẩm - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Product analytics tracking plan |
| Phiên bản | v1.0.0 |
| Trạng thái | Bản nháp |
| Chủ sở hữu | Product Manager / Data Analyst |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Tracking plan giúp kiểm chứng giả thuyết MVP:

1. Người dùng có sẵn sàng tải hóa đơn để đổi lấy đánh giá đáng tin cậy không?
2. Đánh giá đã xác minh có làm tăng niềm tin khi chọn quán không?
3. Quy trình xác minh có vận hành được với chi phí và tải quản trị chấp nhận được không?

Analytics không được thu thập dữ liệu nhạy cảm như OTP, token, nội dung đầy đủ hóa đơn, GPS gốc hoặc số điện thoại đầy đủ.

---

## 2. Nguyên tắc dữ liệu

- Không gửi PII thô vào analytics.
- Sử dụng `userId` nội bộ hoặc anonymous id.
- GPS chỉ gửi dạng bucket nếu cần, ví dụ `distance_bucket = under_200m`.
- Receipt image, OCR text và phone number không được gửi vào analytics.
- Mọi event phải có `app_version`, `platform`, `environment` và timestamp.
- Event name dùng snake_case.

---

## 3. Thuộc tính chung

| Thuộc tính | Kiểu | Ghi chú |
|---|---|---|
| user_id | string/null | ID nội bộ, null nếu khách chưa đăng nhập |
| anonymous_id | string | ID ẩn danh của analytics SDK |
| platform | string | ios, android, web_admin |
| app_version | string | Mobile app version hoặc web build version |
| environment | string | staging, beta, production |
| session_id | string | Analytics session id |

---

## 4. Event MVP

| Event | Khi nào bắn | Thuộc tính chính |
|---|---|---|
| `auth_otp_requested` | Người dùng yêu cầu OTP | `phone_country_code`, `result`, `error_code` |
| `auth_otp_verified` | OTP verify thành công/thất bại | `result`, `error_code` |
| `restaurant_search_performed` | Người dùng tìm kiếm hoặc đổi bộ lọc | `has_keyword`, `has_location`, `filter_count`, `result_count_bucket` |
| `restaurant_detail_viewed` | Mở chi tiết quán | `restaurant_id`, `verified_review_count_bucket`, `trust_score_bucket` |
| `review_started` | Bắt đầu viết đánh giá | `restaurant_id` |
| `review_submitted` | Gửi đánh giá thành công/thất bại | `restaurant_id`, `result`, `error_code`, `comment_length_bucket` |
| `receipt_upload_started` | Bắt đầu upload hóa đơn | `source`, `file_type`, `file_size_bucket`, `gps_permission_state` |
| `receipt_upload_completed` | Upload API trả kết quả | `result`, `error_code`, `processing_status` |
| `receipt_verification_result_viewed` | Người dùng xem kết quả xác minh | `verification_status`, `risk_bucket`, `time_to_result_bucket` |
| `gps_permission_prompted` | App hiển thị prompt GPS | `screen`, `reason` |
| `gps_permission_result` | Người dùng cấp/từ chối GPS | `result` |
| `report_submitted` | Người dùng báo cáo đánh giá | `reason_code`, `result`, `error_code` |
| `profile_viewed` | Người dùng mở hồ sơ | `rank_code`, `exp_bucket` |
| `admin_case_opened` | Admin mở case | `case_type`, `status`, `risk_bucket` |
| `admin_case_decided` | Admin ra quyết định | `case_type`, `decision`, `time_in_queue_bucket` |

---

## 5. Funnel MVP

### 5.1. Funnel đánh giá đã xác minh

```text
restaurant_detail_viewed
→ review_started
→ review_submitted
→ receipt_upload_started
→ receipt_upload_completed
→ receipt_verification_result_viewed
```

Chỉ số cần theo dõi:

- Tỷ lệ bắt đầu review từ trang chi tiết.
- Tỷ lệ gửi review thành công.
- Tỷ lệ bắt đầu upload hóa đơn sau khi gửi review.
- Tỷ lệ upload hóa đơn thành công.
- Tỷ lệ verified/reference/pending/rejected.
- Thời gian từ upload đến kết quả.

### 5.2. Funnel đăng nhập OTP

```text
auth_otp_requested
→ auth_otp_verified
```

Chỉ số cần theo dõi:

- Tỷ lệ verify thành công.
- Tỷ lệ OTP hết hạn.
- Tỷ lệ bị rate limit.
- Drop-off giữa request và verify.

---

## 6. Dashboard MVP

| Dashboard | Người xem | Chỉ số |
|---|---|---|
| Product activation | PO/PM | Review started, review submitted, receipt upload rate, verified rate |
| Verification operations | Ops/Admin | Pending queue size, SLA 24h, decision mix, OCR failure rate |
| Fraud quality | Security/Data | Duplicate hash, risk bucket distribution, rejected rate, admin override rate |
| Mobile quality | Engineering | Crash-free users, upload error rate, API error rate, permission denial rate |

---

## 7. Không được tracking

- OTP code.
- Access token, refresh token, session token.
- Số điện thoại đầy đủ.
- Ảnh hóa đơn.
- OCR text đầy đủ.
- GPS latitude/longitude gốc.
- Nội dung bình luận đầy đủ nếu chưa có cơ sở pháp lý rõ.
