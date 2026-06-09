# Đặc tả màn hình admin portal - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Admin portal screen specification |
| Phiên bản | v1.0.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | UX Lead / Ops Lead / Product Manager |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Phạm vi

Tài liệu này mô tả màn hình admin portal bắt buộc cho MVP. Admin portal là web app riêng, dùng cho vận hành, kiểm duyệt, xử lý receipt verification và audit. Merchant portal đầy đủ thuộc P1/V1.1.

Tài liệu không chốt visual style cuối cùng; chỉ chốt thông tin, trạng thái, hành động và tiêu chí UX vận hành.

---

## 2. Nguyên tắc UX admin

- Tối ưu tốc độ xử lý case nhưng không bỏ qua reason/audit.
- Không hiển thị dữ liệu nhạy cảm đầy đủ nếu không cần thiết.
- Ảnh hóa đơn gốc chỉ xem qua signed URL TTL ngắn, không public trực tiếp.
- Admin decision phải có reason trước khi submit.
- Case đã đóng không được xử lý lại, trừ super admin override.
- Mọi màn hình dữ liệu có loading, empty, error và retry state.

---

## 3. ADM-001: Admin dashboard

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Cho quản trị viên thấy nhanh số case cần xử lý và SLA. |
| Thành phần | Cards: receipt pending, moderation pending, claim pending, SLA overdue; biểu đồ nhỏ decision mix; link vào từng queue. |
| Filter | Khoảng ngày, loại case, trạng thái SLA. |
| State | Loading, API error, no pending cases. |
| Permission | `ADMIN`, `SUPER_ADMIN`. |

### Cột/chỉ số tối thiểu

- Tổng case `PENDING_ADMIN_REVIEW`.
- Case quá 24 giờ làm việc.
- OCR failed count.
- Duplicate receipt count.
- Moderation reports pending.
- Admin decisions trong ngày.

---

## 4. ADM-002: Receipt verification queue

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Lọc và chọn hóa đơn/review nghi vấn để xử lý. |
| Thành phần | Bảng case, filter panel, sort, pagination, risk badge, SLA age. |
| Filter | `status`, `minRiskScore`, `maxRiskScore`, `restaurant`, `createdAt`, `ageBucket`, `ocrStatus`, `gpsBucket`. |
| Sort | Oldest first mặc định, risk score desc, createdAt desc. |
| State | Loading, empty, API error, stale data warning. |

### Cột bắt buộc

| Cột | Ghi chú |
|---|---|
| Case ID | Receipt verification id rút gọn, copyable. |
| Review ID | Link sang review detail/admin view. |
| User | Masked user id/phone, không hiện phone đầy đủ mặc định. |
| Restaurant | Tên quán và trạng thái. |
| Status | Receipt status. |
| Risk score | Badge low/medium/high kèm số. |
| OCR similarity | `%` hoặc `N/A`. |
| GPS distance | Bucket: `<200m`, `200-500m`, `>500m`, `not provided`. |
| Age/SLA | Thời gian chờ, highlight nếu >24 giờ làm việc. |
| Action | Open case. |

---

## 5. ADM-003: Receipt case detail

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Xem đủ bằng chứng để ra quyết định xác minh. |
| Thành phần | Header case, review summary, receipt evidence, OCR panel, GPS panel, risk breakdown, decision panel, audit history. |
| State | Loading, signed URL expired, OCR pending, OCR failed, permission denied. |

### 5.1. Header case

- Receipt verification id.
- Review id.
- Restaurant name/status.
- Current receipt status.
- Current review status.
- Risk score và risk bucket.
- CreatedAt/updatedAt/age.

### 5.2. Review summary

- 4 rating criteria.
- Comment với nội dung nhạy cảm được xử lý theo policy nếu cần.
- VisitedAt.
- User masked identifier.
- Review status/trust label.

### 5.3. Receipt evidence

- Preview ảnh hóa đơn qua signed URL TTL ngắn.
- Không có nút tải ảnh gốc nếu không được cấp quyền riêng.
- Nếu cần hiển thị public evidence, chỉ dùng `redacted_file_url`.
- Hiển thị file type, file size, hash fingerprint rút gọn.

### 5.4. OCR panel

- OCR restaurant name.
- OCR receipt time.
- OCR similarity.
- OCR status.
- OCR text đầy đủ chỉ hiện cho admin có quyền và phải được cảnh báo dữ liệu nhạy cảm; mặc định collapse/masked.

### 5.5. GPS panel

- GPS provided: yes/no.
- Distance bucket và số mét nếu có quyền.
- Accuracy meters.
- Không hiển thị lat/lng gốc trừ khi super admin/security cần điều tra.

### 5.6. Risk breakdown

| Signal | Hiển thị |
|---|---|
| Hash duplicate | Yes/no, flag id nếu có. |
| OCR similarity | Score contribution. |
| Receipt time | Score contribution. |
| GPS | Score contribution. |
| Metadata/image signal | Score contribution nếu có. |
| Account behavior | Score contribution nếu có. |

### 5.7. Decision panel

Decision hợp lệ:

- `APPROVE_VERIFIED`.
- `MARK_REFERENCE_ONLY`.
- `REJECT`.
- `REQUEST_MORE_REVIEW`.

Yêu cầu:

- Reason bắt buộc, tối thiểu 10 ký tự.
- Hiển thị preview side effect trước submit:
  - receipt status mới,
  - review status mới,
  - audit action,
  - fraud flag nếu có,
  - notification/refetch behavior.
- Confirm modal với warning nếu decision là reject hoặc override.

---

## 6. ADM-004: Moderation report queue

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Xử lý report review/nội dung vi phạm. |
| Thành phần | Bảng reports, filter, case detail, action panel. |
| Filter | status, reasonCode, severity, createdAt, reporter, restaurant. |
| Sort | Oldest first, severity desc. |

### Cột bắt buộc

- Report ID.
- Entity type/id.
- Reason code.
- Reporter masked id.
- Review status.
- Severity nếu có.
- Age/SLA.
- Action open.

### Action hợp lệ

- `NO_ACTION`.
- `HIDE_REVIEW`.
- `DELETE_REVIEW`.
- `RESTRICT_USER_REVIEW`.
- `CLOSE_REPORT`.

Mọi action nghiệp vụ phải có reason và ghi audit log.

---

## 7. ADM-005: Claim queue MVP

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Hỗ trợ xác minh chủ quán tối thiểu cho beta nếu cần. |
| Thành phần | Claim list, evidence link, restaurant info, merchant/user info masked, decision panel. |
| Decision | `APPROVE`, `REJECT`, `CANCEL`. |
| Ghi chú | Merchant portal đầy đủ không thuộc MVP; admin có thể vận hành manual claim. |

---

## 8. ADM-006: Audit log viewer

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Truy vết quyết định vận hành. |
| Thành phần | Timeline hoặc table audit theo entity. |
| Cột | actor, actorRole, action, entityType, entityId, previousStatus, newStatus, reason, createdAt. |
| Permission | Admin thấy audit liên quan case; super admin thấy rộng hơn. |
| Privacy | Metadata nhạy cảm phải masked hoặc collapse. |

---

## 9. Accessibility và vận hành

- Bảng có keyboard navigation cơ bản.
- Badge trạng thái có text, không chỉ màu.
- Form error nằm gần field.
- Confirm destructive action phải rõ side effect.
- Có copy `requestId`/case id để support.
- Không hiển thị raw OTP/token/GPS lat-lng/receipt OCR text đầy đủ trong toast/log UI.

---

## 10. Definition of Done cho admin MVP

- Admin đăng nhập và xem dashboard được.
- Receipt queue lọc/mở case/decision hoạt động.
- Moderation queue xử lý report hoạt động.
- Claim queue tối thiểu hoạt động nếu feature flag bật.
- Mọi decision bắt buộc reason và ghi audit log.
- Ảnh hóa đơn gốc private, truy cập qua signed URL TTL ngắn.
- Dữ liệu nhạy cảm masked theo privacy policy.
- QA P0 admin test đạt.
