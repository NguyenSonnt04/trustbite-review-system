# Hướng dẫn OpenAPI và API contract - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | API contract guidelines |
| Phiên bản | v1.1.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Backend Lead / Mobile Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

API của TrustBite phải đủ rõ để mobile, admin web, backend và QA làm việc song song. `API_Specification.md` là tài liệu đọc chính; OpenAPI 3.0/3.1 phải được tạo trước khi implementation production bắt đầu.

---

## 2. Quy ước chung

| Nhóm | Quy ước |
|---|---|
| Base URL | `/api/v1` |
| Format | JSON UTF-8, riêng upload hóa đơn MVP dùng multipart; signed URL là P1 khi cần scale |
| ID | UUID |
| Time | ISO-8601 kèm timezone |
| Auth | Bearer access token, refresh/session token theo auth strategy |
| Pagination | `page`, `pageSize`, `total` cho MVP; cursor có thể dùng khi dữ liệu lớn |
| Error | Một format duy nhất cho toàn API |
| Idempotency | Bắt buộc cho mutation có rủi ro tạo trùng nếu mobile retry, tối thiểu `POST /receipts` và khuyến nghị cho `POST /reviews` |

---

## 3. Status code bắt buộc

| Code | Dùng khi |
|---:|---|
| 200 | GET/PATCH/POST xử lý thành công nhưng không tạo resource mới |
| 201 | Tạo resource mới thành công |
| 202 | Nhận request bất đồng bộ, ví dụ upload hóa đơn đã nhận và OCR đang xử lý |
| 400 | Request sai format hoặc thiếu field |
| 401 | Chưa đăng nhập hoặc token hết hạn/không hợp lệ |
| 403 | Đã đăng nhập nhưng thiếu quyền |
| 404 | Resource không tồn tại hoặc không được phép thấy |
| 409 | Xung đột nghiệp vụ, ví dụ report trùng, claim trùng, duplicate receipt hash |
| 413 | File quá dung lượng |
| 415 | File type không hỗ trợ |
| 422 | Validation nghiệp vụ thất bại |
| 429 | Rate limit |
| 500 | Lỗi hệ thống |
| 503 | Provider ngoài hoặc worker/service tạm không sẵn sàng |

---

## 4. Error response chuẩn

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Comment must be at least 50 characters.",
    "details": [
      {
        "field": "comment",
        "code": "MIN_LENGTH",
        "message": "Minimum length is 50."
      }
    ],
    "requestId": "req_abc123"
  }
}
```

Error code phải ổn định để mobile mapping sang copy/localization.

---

## 5. Error code MVP

| Code | Ý nghĩa |
|---|---|
| `VALIDATION_ERROR` | Request không đạt schema hoặc business validation |
| `AUTH_REQUIRED` | Cần đăng nhập |
| `TOKEN_EXPIRED` | Access token hết hạn |
| `FORBIDDEN` | Thiếu quyền |
| `NOT_FOUND` | Không tìm thấy resource |
| `RATE_LIMITED` | Vượt giới hạn tần suất |
| `OTP_INVALID` | OTP sai |
| `OTP_EXPIRED` | OTP hết hạn |
| `FILE_TOO_LARGE` | File vượt dung lượng |
| `UNSUPPORTED_FILE_TYPE` | File type không hỗ trợ |
| `DUPLICATE_RECEIPT_HASH` | Hóa đơn trùng hash |
| `REVIEW_NOT_EDITABLE` | Review không còn được sửa |
| `RESTAURANT_NOT_ACTIVE` | Quán không ở trạng thái ACTIVE |
| `CLAIM_CONFLICT` | Claim quán xung đột |
| `REPORT_DUPLICATE` | Báo cáo trùng |
| `PROVIDER_UNAVAILABLE` | OCR/SMS/provider ngoài lỗi tạm thời |
| `IDEMPOTENCY_KEY_REQUIRED` | Thiếu Idempotency-Key ở endpoint bắt buộc |
| `IDEMPOTENCY_KEY_INVALID` | Idempotency-Key sai định dạng |
| `IDEMPOTENCY_CONFLICT` | Idempotency key được dùng lại với payload khác |
| `REQUEST_IN_PROGRESS` | Request cùng idempotency key đang xử lý |
| `REVIEW_VERIFICATION_EXPIRED` | Review SUBMITTED đã quá hạn upload và chuyển REFERENCE_ONLY |
| `ADMIN_REASON_REQUIRED` | Quyết định admin thiếu reason |

---

## 6. Upload hóa đơn

MVP chốt dùng **multipart API** để giảm độ phức tạp mobile/backend trong beta.

```text
POST /receipts
Content-Type: multipart/form-data
Idempotency-Key: <uuid-v4>
```

Signed upload chuyển sang P1 khi có một trong các tín hiệu: upload timeout thường xuyên, chi phí API tăng, file lớn, hoặc cần tải trực tiếp vào object storage.

### Quy tắc multipart MVP

- Backend luôn validate lại file type và size.
- Mobile retry bắt buộc gửi cùng `Idempotency-Key` cho cùng một intent upload.
- Nếu cùng `Idempotency-Key` và cùng user/review được gửi lại, API trả lại receipt verification đã tạo thay vì tạo bản ghi mới.
- Nếu cùng `Idempotency-Key` nhưng payload khác, API trả `409 IDEMPOTENCY_CONFLICT`.
- API trả `202` nếu OCR xử lý bất đồng bộ.
- Response phải có `receiptVerificationId`, `status`, `processingStatus` và polling endpoint.
- Hash duplicate vẫn phải tạo fraud flag/audit system event; không chỉ trả lỗi DB unique constraint.

---

## 7. Auth lifecycle cho mobile

- Access token thời gian ngắn.
- Refresh/session token lưu trong secure storage.
- Logout phải revoke session nếu backend hỗ trợ.
- Khi tài khoản bị khóa, refresh phải thất bại và app đưa người dùng về auth/session expired state.
- Không lưu token trong log, analytics hoặc crash breadcrumb.

---

## 8. OpenAPI Definition of Done

File OpenAPI chính thức đặt tại `04_Software_Engineering/openapi.yaml`. Tài liệu markdown có thể diễn giải nghiệp vụ, nhưng implementation và contract test phải bám theo OpenAPI đã review.

Một endpoint chỉ được xem là sẵn sàng dev khi có:

- request schema,
- response schema thành công,
- error response có status code và error code,
- auth requirement,
- permission requirement,
- rate limit nếu có,
- ví dụ request/response,
- test case QA liên quan,
- mapping tới user story/feature code,
- idempotency requirement cho mutation nếu có,
- enum/status dùng chung với `State_Machines.md`,
- quyết định side effect: audit log, fraud flag, notification/refetch.
