# Kế hoạch migration và seed dữ liệu - TrustBite MVP

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Migration/seed production readiness |
| Phiên bản | v1.1.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | DBA / Backend Lead / QA Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Đảm bảo schema PostgreSQL/Prisma có thể triển khai an toàn lên staging/beta/production, có rollback hợp lý và có seed data đủ cho QA/UAT.

---

## 2. Nguyên tắc migration

- Mỗi migration phải nhỏ, review được và có mô tả mục đích.
- Không sửa trực tiếp database production ngoài migration đã review.
- Không xóa cột/bảng đang được app sử dụng nếu chưa có migration chuyển tiếp và xác nhận không còn traffic.
- Migration phá backward compatibility phải có kế hoạch rollout hai bước.
- Dữ liệu nhạy cảm trong seed/test phải là dữ liệu giả, không dùng hóa đơn/số điện thoại/GPS thật.
- Trạng thái DB phải đồng bộ với `02_Business_Analysis/Status_Mapping.md`.

---

## 3. Thứ tự migration baseline P0

| Thứ tự | Nhóm migration | Nội dung |
|---:|---|---|
| 001 | Extensions | Bật `pgcrypto` cho UUID và PostGIS nếu dùng `GEOGRAPHY`. |
| 002 | Auth/users | `users`, `otp_verifications`, `user_sessions`. |
| 003 | Privacy/safety | `account_deletion_requests`, `user_blocks`, cột `users.deletion_requested_at`, `users.deleted_at`. |
| 004 | Restaurants | `restaurants`, `restaurant_branches`, `menu_items`. |
| 005 | Merchants/claims | `merchants`, `restaurant_claims` nếu bật claim beta/manual. |
| 006 | Reviews | `reviews` với `status`, `verification_status`, `trust_label`, `public_visibility`, `trust_weight_bucket`. |
| 007 | Receipts | `receipt_verifications`, private file URL fields, OCR/GPS/risk columns. |
| 008 | Idempotency | `idempotency_keys` và indexes liên quan. |
| 009 | Moderation/fraud/audit | `moderation_reports`, `moderation_actions`, `fraud_flags`, `audit_logs`. |
| 010 | Gamification/profile P0 | `users.exp_points`, `users.rank_code`; `user_badges` chỉ nếu cần. |
| 011 | P1 optional tables | `favorites`, `review_votes`, `review_replies`, `notifications`, `push_tokens` chỉ khi feature flag/roadmap yêu cầu. |

Ghi chú: Nếu repo migration thực tế đã có file được đánh số, team có thể thêm migration privacy/safety dưới dạng migration nối tiếp thay vì đổi tên file cũ; bảng này thể hiện thứ tự logic mong muốn cho baseline mới.

---

## 4. Rollback strategy

| Loại migration | Rollback |
|---|---|
| Tạo bảng/cột mới chưa dùng | Có thể drop nếu chưa release. |
| Thêm index | Drop index nếu gây lỗi/lock; ưu tiên concurrent index khi dữ liệu lớn. |
| Thêm cột nullable/default an toàn | Rollback bằng migration ngược nếu app chưa phụ thuộc. |
| Đổi enum/status semantics | Không rollback trực tiếp; cần migration mapping dữ liệu và update app. |
| Xóa/rename cột | Không làm trong MVP production nếu chưa có hai release: add new → dual write/read → backfill → remove old. |

---

## 5. Seed data bắt buộc cho staging/UAT

| Nhóm dữ liệu | Tối thiểu |
|---|---|
| Users | Guest không lưu DB, user thường, user `REVIEW_RESTRICTED`, admin, super admin, merchant beta. |
| Restaurants | Ít nhất 20 quán `ACTIVE`, 3 `DRAFT`, 3 `SUSPENDED`, 2 `CLOSED`; có tọa độ trong cùng thành phố để test GPS. |
| Reviews | Mỗi trạng thái chính: `SUBMITTED`, `VERIFIED`, `REFERENCE_ONLY`, `PENDING_ADMIN_REVIEW`, `REJECTED`, `HIDDEN`, `DELETED`. |
| Receipts | Case `UPLOADED`, `OCR_PROCESSING`, `VERIFIED`, `PENDING_ADMIN_REVIEW`, `REFERENCE_ONLY`, `REJECTED`, duplicate hash. |
| Moderation | Report `SUBMITTED`, `PENDING_ADMIN_REVIEW`, `ACTION_TAKEN`, `CLOSED`. |
| Claims | Claim `SUBMITTED`, `PENDING_ADMIN_REVIEW`, `APPROVED`, `REJECTED` nếu bật claim beta. |
| Audit logs | Ít nhất 10 action mẫu có reason và previous/new status. |

---

## 6. Test fixtures receipt/GPS/OCR

- Ảnh test JPG, PNG, HEIC dưới 10MB.
- File quá 10MB để test `413 FILE_TOO_LARGE`.
- File type không hỗ trợ để test `415 UNSUPPORTED_FILE_TYPE`.
- Hóa đơn OCR khớp tên quán 80-100%, 60-79%, dưới 60%, không đọc được.
- Hóa đơn trong 48h, 49-168h, trên 168h, không đọc được thời gian.
- GPS bucket: dưới 200m, 200-500m, trên 500m, không cấp GPS, accuracy >100m.
- Duplicate hash fixture phải dùng file giả, không dùng hóa đơn thật.
- Luồng account deletion fixture phải dùng PII giả và kiểm tra session/push token bị revoke.
- User block fixture phải kiểm tra block, unblock và không cho tự chặn chính mình.

---

## 7. Kiểm tra trước deploy migration

- Migration chạy sạch trên database rỗng.
- Migration chạy sạch trên snapshot staging có dữ liệu.
- `git diff --check` không lỗi whitespace.
- Contract test API dùng `openapi.yaml` đạt.
- Seed staging chạy idempotent hoặc có hướng dẫn reset rõ.
- Backup staging/prod đã được tạo trước migration có rủi ro.
- Có kế hoạch rollback và owner trực deploy.

---

## 8. Definition of Done

- Prisma/schema thực tế khớp `PostgreSQL_Database_Schema.md`.
- Tất cả bảng P0 có index tối thiểu theo query path.
- Dữ liệu seed đủ để chạy toàn bộ test P0 trong `Test_Plan.md` và `Mobile_Test_Plan.md`.
- Không có PII thật trong seed/test fixtures.
- DBA/Backend/QA xác nhận migration baseline trước beta.
