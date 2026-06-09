# Mapping trạng thái production-ready - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Mapping trạng thái nghiệp vụ/API/DB/UI |
| Phiên bản | v1.1.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | BA / Backend Lead / Mobile Lead / QA Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Tài liệu này là bảng quy chiếu bắt buộc giữa trạng thái nghiệp vụ, trường DB, response API và nhãn UI. Khi triển khai, backend là nguồn sự thật; mobile/admin chỉ hiển thị trạng thái trả về từ API.

Nếu tài liệu này khác `State_Machines.md`, phải cập nhật đồng bộ trước khi đưa story vào sprint.

---

## 2. Quy tắc chung

- `reviews.status` mô tả vòng đời public/moderation của review.
- `reviews.verification_status` mô tả kết quả xác minh bằng hóa đơn/GPS/OCR hoặc skip.
- `receipt_verifications.status` mô tả pipeline xử lý hóa đơn.
- `trustLabel` là nhãn API/UI để client hiển thị đơn giản cho người dùng.
- Review chỉ được public khi `publicVisibility = PUBLIC` và không vi phạm kiểm duyệt.
- Trust score chỉ tính theo `trustWeightBucket`; không tính trực tiếp theo màu/badge UI.

---

## 3. Mapping review/receipt/trust label P0

| Tình huống | `reviews.status` | `reviews.verification_status` | `receipt_verifications.status` | `trustLabel` API/UI | `publicVisibility` | `trustWeightBucket` | Ghi chú |
|---|---|---|---|---|---|---|---|
| Review mới tạo, chưa upload receipt | `SUBMITTED` | `UNVERIFIED` | N/A | `PENDING_VERIFICATION` | `PRIVATE_UNTIL_DECISION` | `NONE` | API trả `nextStep`. |
| Người dùng chọn bỏ qua receipt | `REFERENCE_ONLY` | `SKIPPED` | N/A | `REFERENCE_ONLY` | `PUBLIC` | `LOW` | Không tạo fraud flag. |
| Review quá hạn 24h không có receipt | `REFERENCE_ONLY` | `EXPIRED_NO_RECEIPT` | N/A | `REFERENCE_ONLY` | `PUBLIC` | `LOW` | Job backend idempotent. |
| Receipt vừa upload | `SUBMITTED` | `PROCESSING` | `UPLOADED` | `PROCESSING` | `PRIVATE_UNTIL_DECISION` | `NONE` | Mobile polling/refetch. |
| Đang kiểm tra hash | `SUBMITTED` | `PROCESSING` | `HASH_CHECKING` | `PROCESSING` | `PRIVATE_UNTIL_DECISION` | `NONE` | Không hiển thị public. |
| Đang OCR | `SUBMITTED` | `PROCESSING` | `OCR_PROCESSING` | `PROCESSING` | `PRIVATE_UNTIL_DECISION` | `NONE` | Không chặn app foreground/background. |
| OCR/risk 0-30 | `VERIFIED` | `VERIFIED` | `VERIFIED` | `VERIFIED` | `PUBLIC` | `HIGH` | Ghi audit/system event khuyến nghị. |
| OCR/risk 31-60 | `PENDING_ADMIN_REVIEW` | `PENDING_ADMIN_REVIEW` | `PENDING_ADMIN_REVIEW` | `PENDING_ADMIN_REVIEW` | `PRIVATE_UNTIL_DECISION` | `NONE` | Admin quyết định sau. |
| OCR/risk 61-99 | `REFERENCE_ONLY` | `REFERENCE_ONLY` | `REFERENCE_ONLY` | `REFERENCE_ONLY` | `PUBLIC` | `LOW` | Không đổ lỗi gian lận nếu không có flag cụ thể. |
| OCR/risk >=100 | `REJECTED` | `REJECTED` | `REJECTED` | `REJECTED` | `PRIVATE` | `NONE` | Tạo fraud flag nếu có tín hiệu nghiêm trọng. |
| Hash duplicate | `REJECTED` | `DUPLICATE_REJECTED` | `REJECTED` | `REJECTED` | `PRIVATE` | `NONE` | Bắt buộc fraud flag `DUPLICATE_RECEIPT_HASH`. |
| OCR timeout/lỗi provider sau retry | `PENDING_ADMIN_REVIEW` | `PENDING_ADMIN_REVIEW` | `PENDING_ADMIN_REVIEW` | `PENDING_ADMIN_REVIEW` | `PRIVATE_UNTIL_DECISION` | `NONE` | Không mặc định kết luận gian lận. |
| Admin duyệt verified | `VERIFIED` | `VERIFIED` | `VERIFIED` | `VERIFIED` | `PUBLIC` | `HIGH` | Reason/audit bắt buộc. |
| Admin mark reference | `REFERENCE_ONLY` | `REFERENCE_ONLY` | `REFERENCE_ONLY` | `REFERENCE_ONLY` | `PUBLIC` | `LOW` | Reason/audit bắt buộc. |
| Admin reject và không giữ review | `REJECTED` | `REJECTED` | `REJECTED` | `REJECTED` | `PRIVATE` | `NONE` | Reason/audit bắt buộc. |
| Admin reject receipt nhưng giữ review tham khảo | `REFERENCE_ONLY` | `RECEIPT_REJECTED_REFERENCE_ALLOWED` | `REJECTED` | `REFERENCE_ONLY` | `PUBLIC` | `LOW` | Admin phải chọn rõ side effect. |
| Review bị report và admin ẩn | `HIDDEN` | Giữ nguyên giá trị trước đó | Giữ nguyên/N/A | `HIDDEN` | `PRIVATE` | `NONE` | Không tính trust score. |
| Review bị xóa mềm | `DELETED` | Giữ nguyên hoặc `DELETED` | Giữ nguyên/N/A | `DELETED` | `PRIVATE` | `NONE` | Theo privacy/retention policy. |

---

## 4. Giá trị enum khuyến nghị

### 4.1. `reviews.status`

`DRAFT`, `SUBMITTED`, `VERIFIED`, `REFERENCE_ONLY`, `PENDING_ADMIN_REVIEW`, `REJECTED`, `HIDDEN`, `DELETED`.

### 4.2. `reviews.verification_status`

`UNVERIFIED`, `PROCESSING`, `SKIPPED`, `EXPIRED_NO_RECEIPT`, `VERIFIED`, `PENDING_ADMIN_REVIEW`, `REFERENCE_ONLY`, `REJECTED`, `DUPLICATE_REJECTED`, `RECEIPT_REJECTED_REFERENCE_ALLOWED`, `DELETED`.

### 4.3. `receipt_verifications.status`

`UPLOADED`, `HASH_CHECKING`, `DUPLICATE_DETECTED`, `OCR_PROCESSING`, `OCR_SUCCESS`, `OCR_FAILED`, `VERIFIED`, `PENDING_ADMIN_REVIEW`, `REFERENCE_ONLY`, `REJECTED`.

### 4.4. `trustLabel`

`PENDING_VERIFICATION`, `PROCESSING`, `VERIFIED`, `PENDING_ADMIN_REVIEW`, `REFERENCE_ONLY`, `REJECTED`, `HIDDEN`, `DELETED`.

### 4.5. `publicVisibility`

`PUBLIC`, `PRIVATE`, `PRIVATE_UNTIL_DECISION`.

### 4.6. `trustWeightBucket`

`HIGH`, `LOW`, `NONE`.

---

## 5. Account deletion và user block

### 5.1. `account_deletion_requests.status`

| DB/API status | UI label | Side effect bắt buộc |
|---|---|---|
| `REQUESTED` | Đã ghi nhận yêu cầu xóa tài khoản | Tạo audit tối thiểu; chặn request trùng đang mở. |
| `PROCESSING` | Đang xử lý xóa tài khoản | Revoke session/push token; bắt đầu xóa/ẩn danh hóa PII. |
| `COMPLETED` | Đã xóa tài khoản | `users.deleted_at` có giá trị; PII đã xóa/ẩn danh hóa theo retention. |
| `CANCELLED` | Đã hủy yêu cầu | Chỉ hợp lệ nếu còn grace period hoặc chưa xử lý dữ liệu. |

### 5.2. `user_blocks`

| DB field | API/UI meaning | Ghi chú |
|---|---|---|
| `deleted_at IS NULL` | Đang chặn | UI hạn chế tương tác với user bị chặn trong phạm vi TrustBite. |
| `deleted_at IS NOT NULL` | Đã bỏ chặn | Không tự động xóa review/report đã tồn tại. |

---

## 6. API response contract tối thiểu

Mọi API trả review public hoặc review detail cho owner/admin phải có tối thiểu:

```json
{
  "id": "uuid",
  "status": "VERIFIED",
  "verificationStatus": "VERIFIED",
  "trustLabel": "VERIFIED",
  "publicVisibility": "PUBLIC",
  "trustWeightBucket": "HIGH"
}
```

`GET /receipts/{receiptVerificationId}` phải trả cả `receipt.status` và `reviewStatusSnapshot` để mobile không tự suy luận:

```json
{
  "id": "uuid",
  "status": "PENDING_ADMIN_REVIEW",
  "reviewStatusSnapshot": "PENDING_ADMIN_REVIEW",
  "trustLabel": "PENDING_ADMIN_REVIEW"
}
```

---

## 7. Tiêu chí nghiệm thu mapping

- Backend unit test bao phủ mọi dòng mapping P0 trong mục 3.
- Contract test kiểm tra API không trả enum ngoài danh sách mục 4.
- Mobile/admin không tự chuyển trạng thái local, chỉ refetch và hiển thị theo API.
- QA có test data cho `VERIFIED`, `REFERENCE_ONLY`, `PENDING_ADMIN_REVIEW`, `REJECTED`, `HIDDEN`, `DELETED`, account deletion status và user block/unblock.
