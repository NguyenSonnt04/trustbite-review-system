# Máy trạng thái - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Máy trạng thái nghiệp vụ |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | BA / Kỹ thuật |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Nguyên tắc chuẩn hóa

- Trạng thái cần admin xử lý dùng chung tên `PENDING_ADMIN_REVIEW` trên review, receipt verification, claim và moderation khi phù hợp.
- State machine được mô tả theo nhánh thực tế, không hiểu là chuỗi tuyến tính bắt buộc.
- Mọi chuyển trạng thái do quản trị viên thực hiện phải ghi audit log.
- Mapping chi tiết giữa `reviews.status`, `reviews.verification_status`, `receipt_verifications.status`, `trustLabel`, visibility và trust weight được quy định trong `Status_Mapping.md`.
- Backend là nguồn sự thật về trạng thái. Mobile app chỉ hiển thị/refetch trạng thái từ API.
- Notification không bắt buộc trong MVP. Mobile phải polling/refetch khi app quay lại foreground hoặc người dùng mở lại màn hình kết quả xác minh.

---

## 2. Trạng thái đánh giá

```text
DRAFT
→ SUBMITTED
  → VERIFIED
  → REFERENCE_ONLY
  → PENDING_ADMIN_REVIEW
      → VERIFIED
      → REFERENCE_ONLY
      → REJECTED
  → REJECTED

VERIFIED / REFERENCE_ONLY / PENDING_ADMIN_REVIEW / REJECTED
  → HIDDEN
  → DELETED
```

| Trạng thái | Ý nghĩa |
|---|---|
| DRAFT | Đánh giá đang soạn hoặc chưa gửi đầy đủ. |
| SUBMITTED | Đánh giá đã gửi, chờ người dùng tải hóa đơn hoặc chọn bỏ qua xác minh. |
| VERIFIED | Đánh giá đủ tin cậy để tính trọng số cao. |
| REFERENCE_ONLY | Đánh giá tham khảo, hiển thị nếu không vi phạm kiểm duyệt nhưng chỉ tính trọng số thấp. |
| PENDING_ADMIN_REVIEW | Cần quản trị viên xử lý. |
| REJECTED | Không được chấp nhận để hiển thị/tính điểm theo rule. |
| HIDDEN | Bị ẩn bởi kiểm duyệt/quản trị viên. |
| DELETED | Xóa mềm theo yêu cầu của người dùng, quản trị viên hoặc quyền riêng tư. |

### 2.1. Quy tắc review không có hóa đơn

| Tình huống | Trạng thái review | Ghi chú |
|---|---|---|
| Người dùng gửi review hợp lệ | `SUBMITTED` | API trả `nextStep = UPLOAD_RECEIPT` hoặc `SKIP_VERIFICATION`. |
| Người dùng chọn bỏ qua hóa đơn | `REFERENCE_ONLY` | Hiển thị nhãn tham khảo, trọng số thấp, có thể cộng EXP thấp. |
| Review `SUBMITTED` không có receipt sau 24 giờ | `REFERENCE_ONLY` | Job backend chuyển tự động để tránh trạng thái treo. |
| Review có receipt đang xử lý | `SUBMITTED` hoặc `PENDING_ADMIN_REVIEW` | Mobile hiển thị trạng thái xác minh từ receipt API. |

---

## 3. Trạng thái xác minh hóa đơn

```text
UPLOADED
→ DUPLICATE_CHECKING
  → DUPLICATE_DETECTED
      → REJECTED
  → OCR_PROCESSING
      → OCR_FAILED
          → PENDING_ADMIN_REVIEW
          → REFERENCE_ONLY
      → OCR_SUCCESS
          → VERIFIED
          → PENDING_ADMIN_REVIEW
          → REFERENCE_ONLY
          → REJECTED
```

| Trạng thái | Ý nghĩa |
|---|---|
| UPLOADED | File đã được lưu riêng tư. |
| DUPLICATE_CHECKING | Đang kiểm tra trùng lặp (SHA-256 ảnh và Composite Transaction Hash). |
| OCR_PROCESSING | Đang OCR. |
| OCR_SUCCESS | OCR hoàn tất. |
| OCR_FAILED | OCR lỗi kỹ thuật hoặc không đọc được. |
| DUPLICATE_DETECTED | Trùng file hash hoặc trùng khóa thông tin giao dịch (Composite Hash). |
| VERIFIED | Hóa đơn đã xác minh. |
| PENDING_ADMIN_REVIEW | Cần quản trị viên rà soát. |
| REFERENCE_ONLY | Không đủ xác minh, nhưng review có thể giữ dạng tham khảo theo rule. |
| REJECTED | Hóa đơn bị từ chối. |

---

## 4. Decision/state mapping P0

### 4.1. Xác minh hóa đơn tự động

| Sự kiện/điều kiện | Receipt status | Review status | Fraud flag | Audit log | Mobile behavior |
|---|---|---|---|---|---|
| Upload thành công | `UPLOADED` | `SUBMITTED` | Không | Không bắt buộc | Hiển thị processing. |
| Bắt đầu hash | `HASH_CHECKING` | `SUBMITTED` | Không | Không bắt buộc | Poll/refetch `GET /receipts/{receiptVerificationId}`. |
| Hash trùng | `DUPLICATE_DETECTED` → `REJECTED` | `REJECTED` hoặc `REFERENCE_ONLY` theo rule sản phẩm, mặc định `REJECTED` | `DUPLICATE_RECEIPT_HASH` | Có audit hệ thống | Hiển thị rejected, giải thích không đổ lỗi. |
| OCR/risk 0-30 | `VERIFIED` | `VERIFIED` | Không | Audit hệ thống khuyến nghị | Hiển thị verified, refetch review. |
| OCR/risk 31-60 | `PENDING_ADMIN_REVIEW` | `PENDING_ADMIN_REVIEW` | Có thể tạo flag nếu có tín hiệu cụ thể | Audit hệ thống khuyến nghị | Hiển thị pending admin review. |
| OCR/risk 61-99 | `REFERENCE_ONLY` | `REFERENCE_ONLY` | Có thể tạo flag nếu có tín hiệu cụ thể | Audit hệ thống khuyến nghị | Hiển thị reference only. |
| OCR/risk >=100 | `REJECTED` | `REJECTED` | Có | Audit hệ thống | Hiển thị rejected. |
| OCR timeout/lỗi provider sau retry | `PENDING_ADMIN_REVIEW` | `PENDING_ADMIN_REVIEW` | Không mặc định | Audit hệ thống khuyến nghị | Hiển thị pending, không kết luận gian lận. |

### 4.2. Quyết định quản trị viên với hóa đơn

| Admin decision | Receipt status mới | Review status mới | Audit action | Notification/refetch |
|---|---|---|---|---|
| `APPROVE_VERIFIED` | `VERIFIED` | `VERIFIED` | `RECEIPT_APPROVED` | MVP: refetch; P1: `RECEIPT_VERIFIED`. |
| `MARK_REFERENCE_ONLY` | `REFERENCE_ONLY` | `REFERENCE_ONLY` | `RECEIPT_MARKED_REFERENCE` | MVP: refetch; P1: `RECEIPT_REFERENCE_ONLY`. |
| `REJECT` | `REJECTED` | `REJECTED` hoặc `REFERENCE_ONLY` nếu admin chọn giữ review tham khảo | `RECEIPT_REJECTED` | MVP: refetch; P1: `RECEIPT_REJECTED`. |
| `REQUEST_MORE_REVIEW` | `PENDING_ADMIN_REVIEW` | `PENDING_ADMIN_REVIEW` | `RECEIPT_REVIEW_EXTENDED` | Không bắt buộc. |
| Super admin override từ `REJECTED` sang `VERIFIED` | `VERIFIED` | `VERIFIED` | `RECEIPT_OVERRIDE_VERIFIED` | Bắt buộc reason chi tiết. |

### 4.3. Kiểm duyệt nội dung

| Moderation action | Report status mới | Review status mới | Audit action |
|---|---|---|---|
| `NO_ACTION` | `REJECTED` hoặc `CLOSED` | Không đổi | `MODERATION_NO_ACTION` |
| `HIDE_REVIEW` | `ACTION_TAKEN` | `HIDDEN` | `REVIEW_HIDDEN` |
| `DELETE_REVIEW` | `ACTION_TAKEN` | `DELETED` | `REVIEW_DELETED` |
| `RESTRICT_USER_REVIEW` | `ACTION_TAKEN` | Không đổi hoặc `HIDDEN` nếu cần | `USER_REVIEW_RESTRICTED` |
| Đóng sau xử lý | `CLOSED` | Không đổi | `MODERATION_CLOSED` |

### 4.4. Claim quán MVP/P1

| Admin decision | Claim status mới | Merchant/restaurant effect | Audit action |
|---|---|---|---|
| `APPROVE` | `APPROVED` | Chủ quán được gán quyền quản lý quán; portal đầy đủ vẫn P1 | `CLAIM_APPROVED` |
| `REJECT` | `REJECTED` | Không cấp quyền | `CLAIM_REJECTED` |
| `CANCEL` | `CANCELLED` | Không cấp quyền | `CLAIM_CANCELLED` |

---

## 5. Trạng thái quán

```text
DRAFT
→ PENDING_VERIFICATION
  → ACTIVE
  → REJECTED

ACTIVE
  → SUSPENDED
  → CLOSED

SUSPENDED
  → ACTIVE
  → CLOSED
```

| Trạng thái | Ý nghĩa |
|---|---|
| DRAFT | Quán mới tạo hoặc chưa đủ dữ liệu. |
| PENDING_VERIFICATION | Chờ xác minh dữ liệu/quyền quản lý. |
| ACTIVE | Được hiển thị công khai. |
| SUSPENDED | Tạm ngưng hiển thị hoặc hạn chế do vận hành/vi phạm. |
| CLOSED | Quán đóng cửa. |
| REJECTED | Không được chấp nhận. |

---

## 6. Trạng thái xác nhận quyền quản lý quán

```text
SUBMITTED
→ PENDING_ADMIN_REVIEW
  → APPROVED
  → REJECTED
  → CANCELLED
```

---

## 7. Trạng thái báo cáo kiểm duyệt

```text
SUBMITTED
→ TRIAGED
→ PENDING_ADMIN_REVIEW
  → ACTION_TAKEN
  → REJECTED
  → CLOSED
```

| Trạng thái | Ý nghĩa |
|---|---|
| SUBMITTED | Báo cáo mới được gửi. |
| TRIAGED | Đã phân loại sơ bộ. |
| PENDING_ADMIN_REVIEW | Chờ quản trị viên xử lý. |
| ACTION_TAKEN | Đã áp dụng hành động kiểm duyệt. |
| REJECTED | Báo cáo bị từ chối. |
| CLOSED | Đã đóng sau xử lý hoặc không cần hành động thêm. |

---

## 8. Trạng thái người dùng

```text
ACTIVE
→ REVIEW_RESTRICTED
→ SUSPENDED
→ DELETED

REVIEW_RESTRICTED
→ ACTIVE
```

---

## 9. Trạng thái yêu cầu xóa tài khoản

```text
REQUESTED
→ PROCESSING
  → COMPLETED
  → CANCELLED

REQUESTED
→ CANCELLED
```

| Trạng thái | Ý nghĩa |
|---|---|
| REQUESTED | Người dùng đã xác nhận yêu cầu xóa tài khoản. |
| PROCESSING | Hệ thống/Ops đang revoke session và xóa/ẩn danh hóa dữ liệu. |
| COMPLETED | Yêu cầu đã hoàn tất theo retention/legal policy. |
| CANCELLED | Người dùng hủy trong grace period hoặc request bị hủy hợp lệ theo quy trình. |

## 10. Trạng thái block người dùng

```text
ACTIVE
→ DELETED
```

| Trạng thái | Ý nghĩa |
|---|---|
| ACTIVE | Quan hệ block đang có hiệu lực. |
| DELETED | Người dùng đã bỏ chặn; bản ghi có thể giữ soft-delete nếu cần audit. |

## 11. Quy tắc chuyển trạng thái

- Đánh giá `VERIFIED` có thể chuyển `HIDDEN` nếu vi phạm nội dung.
- `HIDDEN`, `REJECTED` và `DELETED` không tính điểm tin cậy.
- `REFERENCE_ONLY` có thể hiển thị công khai nếu không vi phạm kiểm duyệt, nhưng chỉ tính trọng số thấp.
- Hóa đơn `REJECTED` không được chuyển `VERIFIED` trừ khi siêu quản trị override.
- `DUPLICATE_DETECTED` phải tạo fraud flag loại `DUPLICATE_RECEIPT_HASH`.
- Mọi chuyển trạng thái do quản trị viên thực hiện phải ghi audit log và có `reason`.
- Mobile app phải refetch trạng thái từ API khi app quay lại foreground hoặc người dùng mở lại màn hình kết quả xác minh.
- Contract test/API response phải kiểm tra enum theo `Status_Mapping.md` trước khi release.

- Account deletion request `COMPLETED` phải tương ứng với session/push token bị revoke và PII đã xóa/ẩn danh hóa theo `Data_Retention_Policy.md`.
- User block không được dùng để thay đổi trạng thái public của review; kiểm duyệt review vẫn đi qua `moderation_reports`/`moderation_actions`.
