# Đặc tả API - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Đặc tả API |
| Phiên bản | v1.4.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Trưởng nhóm Backend / Mobile Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Quy ước API

- Base URL: `/api/v1`.
- Định dạng: JSON, UTF-8; upload hóa đơn MVP dùng multipart theo `OpenAPI_Guidelines.md`. Signed upload là P1 khi cần scale.
- Auth: Bearer access token + refresh/session token, trừ public endpoints.
- IDs: UUID.
- Thời gian: ISO-8601 kèm timezone.
- API P0 phải được chuẩn hóa trong `04_Software_Engineering/openapi.yaml` trước khi implementation production.
- Endpoint P1/feature flag không được đưa vào sprint MVP nếu chưa có quyết định PO và traceability cập nhật.
- Error code phải ổn định để mobile app mapping sang copy/localization.
- Mapping trạng thái API/DB/UI phải theo `02_Business_Analysis/Status_Mapping.md`.
- Mutation có rủi ro tạo trùng khi mobile retry phải dùng `Idempotency-Key`; bắt buộc cho `POST /receipts`, khuyến nghị cho `POST /reviews`. Thiết kế chi tiết xem `Idempotency_and_Retry_Design.md`.
- Status code tối thiểu theo `OpenAPI_Guidelines.md`: 200, 201, 202, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503.
- Phản hồi lỗi:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Comment must be at least 50 characters.",
    "details": [],
    "requestId": "req_abc123"
  }
}
```

---

## 2. Xác thực

### POST /auth/otp/request

Yêu cầu:

```json
{
  "phoneNumber": "+84901234567"
}
```

Phản hồi:

```json
{
  "requestId": "uuid",
  "expiresInSeconds": 120,
  "nextAllowedRequestAt": "2026-06-07T12:10:00+07:00"
}
```

### POST /auth/otp/verify

Yêu cầu:

```json
{
  "phoneNumber": "+84901234567",
  "otpCode": "123456"
}
```

Phản hồi:

```json
{
  "accessToken": "jwt-or-session-token",
  "user": {
    "id": "uuid",
    "displayName": "Nguyen Van A",
    "role": "USER",
    "rankCode": "NEWBIE"
  }
}
```

### POST /auth/refresh

Yêu cầu phụ thuộc auth strategy. Mobile app dùng endpoint này hoặc session refresh tương đương khi access token hết hạn.

Phản hồi:

```json
{
  "accessToken": "new-access-token",
  "expiresInSeconds": 900
}
```

### POST /auth/logout

Phản hồi:

```json
{ "success": true }
```

Ghi chú mobile: logout phải xóa token local và revoke refresh/session token nếu backend hỗ trợ.

---

## 3. Người dùng

### GET /users/me

Phản hồi:

```json
{
  "id": "uuid",
  "phoneNumber": "+84901234567",
  "displayName": "Nguyen Van A",
  "status": "ACTIVE",
  "expPoints": 120,
  "rankCode": "APPRENTICE"
}
```

### PATCH /users/me

Yêu cầu:

```json
{
  "displayName": "Tên hiển thị",
  "avatarUrl": "https://..."
}
```

### POST /users/me/deletion-request

Auth: người dùng hiện tại. Endpoint P0 cho public beta/store release.

Yêu cầu:

```json
{
  "confirmationText": "XÓA TÀI KHOẢN",
  "reason": "Không còn nhu cầu sử dụng"
}
```

Phản hồi: `202 Accepted`

```json
{
  "deletionRequestId": "uuid",
  "status": "REQUESTED",
  "scheduledDeletionAt": "2026-06-14T12:30:00+07:00"
}
```

Ghi chú: backend phải revoke session theo chính sách triển khai, xóa/ẩn danh hóa PII theo `Data_Retention_Policy.md`, và chỉ giữ audit/fraud/legal record tối thiểu khi có cơ sở. Nếu đã có request mở, API trả `409 DELETION_REQUEST_ALREADY_EXISTS`.

### GET /users/me/deletion-request

Trả trạng thái yêu cầu xóa tài khoản đang mở của người dùng hiện tại. Nếu không có request, trả `404 DELETION_REQUEST_NOT_FOUND`.

### POST /users/me/deletion-request/cancel

Tùy chọn nếu sản phẩm áp dụng grace period. Chỉ cho phép hủy khi trạng thái còn `REQUESTED` và chưa chạy job xóa dữ liệu.

---

## 4. Quán

### GET /restaurants

Tham số truy vấn:

```text
keyword, lat, lng, radiusMeters, minTrustScore, sort, page, pageSize
```

Phản hồi:

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Phở Thật 100",
      "address": "Quận 1, TP.HCM",
      "latitude": 10.776,
      "longitude": 106.700,
      "trustScore": 4.4,
      "verifiedReviewCount": 35,
      "referenceReviewCount": 12,
      "status": "ACTIVE"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

### GET /restaurants/nearby

Tham số truy vấn:

```text
northEastLat, northEastLng, southWestLat, southWestLng
```

### GET /restaurants/{restaurantId}

Response gồm hồ sơ quán, phân rã điểm đánh giá và trạng thái chủ quán.

### GET /restaurants/{restaurantId}/reviews

Tham số truy vấn:

```text
status=VERIFIED|REFERENCE_ONLY|ALL&page=1&pageSize=20
```

Phản hồi phải phân biệt rõ review `VERIFIED` và `REFERENCE_ONLY` để mobile hiển thị trust badge.

---

## 5. Đánh giá

### POST /reviews

Auth: `USER`.

Header khuyến nghị:

```text
Idempotency-Key: uuid-v4
```

Yêu cầu:

```json
{
  "restaurantId": "uuid",
  "foodRating": 5,
  "priceRating": 4,
  "serviceRating": 4,
  "ambienceRating": 5,
  "comment": "Đồ ăn ngon, phục vụ tốt, giá hợp lý. Không gian sạch sẽ và dễ chịu.",
  "visitedAt": "2026-06-07T12:30:00+07:00"
}
```

Phản hồi:

```json
{
  "reviewId": "uuid",
  "status": "SUBMITTED",
  "nextStep": "UPLOAD_RECEIPT"
}
```

### GET /reviews/{reviewId}

Response gồm điểm đánh giá, bình luận, trạng thái, trạng thái xác minh và media.

### PATCH /reviews/{reviewId}

Chỉ cho phép khi đánh giá ở `DRAFT` hoặc `SUBMITTED` và chưa có receipt verification đã chốt. Nếu review đã `VERIFIED`, `REFERENCE_ONLY`, `REJECTED`, `HIDDEN` hoặc `DELETED`, API trả `REVIEW_NOT_EDITABLE`.

### POST /reviews/{reviewId}/skip-verification

Cho phép người dùng bỏ qua upload hóa đơn và chuyển review sang `REFERENCE_ONLY`.

Auth: chủ sở hữu review.

Yêu cầu:

```json
{
  "reason": "USER_SKIPPED_RECEIPT"
}
```

Phản hồi:

```json
{
  "reviewId": "uuid",
  "status": "REFERENCE_ONLY",
  "verificationStatus": "SKIPPED",
  "trustLabel": "REFERENCE_ONLY"
}
```

Ghi chú: backend cũng chạy job chuyển review `SUBMITTED` không có receipt sau 24 giờ sang `REFERENCE_ONLY`.

### DELETE /reviews/{reviewId}

Xóa mềm theo chính sách của chủ sở hữu hoặc quản trị viên.

### POST /reviews/{reviewId}/votes

Mức ưu tiên: **P1**, không thuộc MVP nếu chưa bật feature flag.

Yêu cầu:

```json
{ "voteType": "HELPFUL" }
```

### POST /reviews/{reviewId}/gps

Endpoint tùy chọn nếu GPS không gửi kèm `POST /receipts`.

Yêu cầu:

```json
{
  "latitude": 10.776,
  "longitude": 106.700,
  "accuracyMeters": 45,
  "capturedAt": "2026-06-07T12:30:00+07:00"
}
```

Phản hồi:

```json
{
  "reviewId": "uuid",
  "gpsSignalAccepted": true
}
```

---

## 6. Hóa đơn

### POST /receipts

Auth: chủ sở hữu review.

Content-Type: `multipart/form-data`

Header bắt buộc:

```text
Idempotency-Key: uuid-v4
```

Fields:

```text
reviewId: uuid
restaurantId: uuid
receiptImage: file
latitude: optional number
longitude: optional number
gpsAccuracyMeters: optional number
capturedAt: optional datetime
```

Phản hồi: `202 Accepted`

```json
{
  "receiptVerificationId": "uuid",
  "status": "UPLOADED",
  "processingStatus": "HASH_CHECKING"
}
```

Ghi chú:

- Nếu mobile retry upload với cùng `Idempotency-Key`, backend trả lại receipt verification đã tạo thay vì tạo bản ghi mới.
- Nếu cùng `Idempotency-Key` nhưng payload khác, backend trả `409 IDEMPOTENCY_CONFLICT`.
- Backend validate file type/size dù mobile đã kiểm tra sơ bộ.
- Hash duplicate phải tạo fraud flag `DUPLICATE_RECEIPT_HASH` và cập nhật trạng thái theo `State_Machines.md`.

### GET /receipts/{receiptVerificationId}

Phản hồi:

```json
{
  "id": "uuid",
  "reviewId": "uuid",
  "status": "VERIFIED",
  "ocrSimilarity": 92.5,
  "gpsDistanceMeters": 80,
  "fraudRiskScore": 10,
  "decision": "AUTO_VERIFIED"
}
```

Giá trị `status` hợp lệ: `UPLOADED`, `HASH_CHECKING`, `OCR_PROCESSING`, `OCR_SUCCESS`, `OCR_FAILED`, `DUPLICATE_DETECTED`, `VERIFIED`, `PENDING_ADMIN_REVIEW`, `REFERENCE_ONLY`, `REJECTED`.

---

## 7. Kiểm duyệt

### POST /moderation/reports

Yêu cầu:

```json
{
  "entityType": "REVIEW",
  "entityId": "uuid",
  "reasonCode": "SPAM_OR_FAKE",
  "description": "Review có dấu hiệu seeding."
}
```

Phản hồi:

```json
{
  "reportId": "uuid",
  "status": "SUBMITTED"
}
```

### POST /users/{userId}/block

Auth: người dùng hiện tại. Dùng để hạn chế tương tác từ người dùng lạm dụng trong phạm vi TrustBite.

Yêu cầu:

```json
{
  "reasonCode": "ABUSIVE_LANGUAGE",
  "sourceReviewId": "uuid"
}
```

Phản hồi:

```json
{
  "blockedUserId": "uuid",
  "blockedAt": "2026-06-07T12:30:00+07:00"
}
```

Lỗi: `400 CANNOT_BLOCK_SELF`, `409 USER_ALREADY_BLOCKED`.

### DELETE /users/{userId}/block

Bỏ chặn người dùng. Phản hồi `{ "success": true }`.

---

## 8. Chủ quán

### POST /merchant/claims

Mức ưu tiên: MVP chỉ dùng khi bật claim tối thiểu/manual beta; merchant portal đầy đủ là **P1/V1.1**.

Yêu cầu:

```json
{
  "restaurantId": "uuid",
  "businessName": "Công ty ABC",
  "evidenceUrl": "https://..."
}
```

Phản hồi:

```json
{
  "claimId": "uuid",
  "status": "SUBMITTED"
}
```

### PATCH /merchant/restaurants/{restaurantId}

Mức ưu tiên: **P1/V1.1**. Chỉ cho phép với claim đã được duyệt.

### POST /merchant/reviews/{reviewId}/reply

Mức ưu tiên: **P1/V1.1**, không thuộc MVP P0.

Yêu cầu:

```json
{
  "message": "Cảm ơn bạn đã góp ý, quán sẽ cải thiện."
}
```

---

## 9. Quản trị viên

### GET /admin/queues/receipts

Tham số truy vấn:

```text
status, minRiskScore, maxRiskScore, page, pageSize
```

### POST /admin/receipt-verifications/{receiptVerificationId}/decision

Auth: `ADMIN` hoặc `SUPER_ADMIN`.

Decision hợp lệ: `APPROVE_VERIFIED`, `MARK_REFERENCE_ONLY`, `REJECT`, `REQUEST_MORE_REVIEW`.

Yêu cầu:

```json
{
  "decision": "APPROVE_VERIFIED",
  "reason": "Receipt name and timestamp match restaurant records."
}
```

`reason` bắt buộc. Thiếu reason trả `422 ADMIN_REASON_REQUIRED`.

Phản hồi:

```json
{
  "receiptVerificationId": "uuid",
  "newStatus": "VERIFIED",
  "reviewStatus": "VERIFIED",
  "auditLogId": "uuid"
}
```

### GET /admin/moderation/reports

### POST /admin/moderation/reports/{reportId}/decision

Auth: `ADMIN` hoặc `SUPER_ADMIN`.

Action hợp lệ: `NO_ACTION`, `HIDE_REVIEW`, `DELETE_REVIEW`, `RESTRICT_USER_REVIEW`, `CLOSE_REPORT`.

Yêu cầu:

```json
{
  "action": "HIDE_REVIEW",
  "reason": "Contains abusive language."
}
```

`reason` bắt buộc với mọi action trừ `CLOSE_REPORT` kỹ thuật sau khi đã có action trước đó.

### POST /admin/restaurant-claims/{id}/decision

Auth: `ADMIN` hoặc `SUPER_ADMIN`.

Yêu cầu:

```json
{
  "decision": "APPROVE",
  "reason": "Business ownership documents verified."
}
```

MVP ghi nhận claim/ownership tối thiểu để kiểm chứng vận hành chủ quán; merchant portal đầy đủ vẫn thuộc P1/V1.1.

---

## 10. Thông báo

### GET /notifications

Mức ưu tiên: **P1/feature flag**. MVP dùng polling/refetch `GET /receipts/{receiptVerificationId}` và `GET /reviews/{reviewId}`.

Phản hồi:

```json
{
  "items": [
    {
      "id": "uuid",
      "type": "RECEIPT_VERIFIED",
      "title": "Review của bạn đã được xác minh",
      "readAt": null,
      "createdAt": "2026-06-07T12:30:00+07:00"
    }
  ]
}
```

### PATCH /notifications/{id}/read

Mức ưu tiên: **P1/feature flag**.

Phản hồi:

```json
{ "success": true }
```

---

## 11. Game hóa

### GET /gamification/me

Phản hồi:

```json
{
  "expPoints": 120,
  "rankCode": "APPRENTICE",
  "badges": []
}
```
