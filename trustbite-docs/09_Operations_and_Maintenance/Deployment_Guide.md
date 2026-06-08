# Hướng dẫn triển khai - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Deployment guide |
| Phiên bản | v1.0.0 |
| Trạng thái | Bản nháp |
| Chủ sở hữu | DevOps / Engineering Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Tài liệu này mô tả baseline triển khai TrustBite cho backend API, worker, admin web và mobile release. Chi tiết pipeline nằm trong `04_Software_Engineering/CI_CD_Pipeline.md`; checklist mobile nằm trong `Mobile_Release_Checklist.md`.

---

## 2. Môi trường

| Môi trường | Mục đích | Dữ liệu | Ghi chú |
|---|---|---|---|
| Local | Developer tự phát triển | Mock/seed local | Không dùng secret production |
| Development | Tích hợp sớm | Dữ liệu giả | Có thể reset thường xuyên |
| Staging | QA/UAT, rehearsal release | Seed gần production nhưng không chứa PII thật | Phải giống production nhất có thể |
| Beta | TestFlight/Google Play Internal + backend beta nếu tách | Dữ liệu beta có kiểm soát | Bật monitoring P0 |
| Production | Người dùng thật | Dữ liệu thật | Yêu cầu backup, monitoring, rollback |

---

## 3. Thành phần triển khai

| Thành phần | Artifact | Ghi chú |
|---|---|---|
| Backend API | Container image/build artifact | NestJS API cho mobile/admin |
| Worker | Container image/build artifact | OCR, risk scoring, queue jobs |
| Admin portal | Web build/container | Next.js admin web |
| Database migration | Migration scripts | Prisma/migration tool tương ứng |
| Mobile app | iOS/Android build | TestFlight/Google Play/Internal/Production |
| Object storage | Bucket/policy/lifecycle | Receipt private bucket, redacted variants nếu có |

---

## 4. Quy trình deploy backend/API/worker

1. Xác nhận commit/tag release đã qua CI.
2. Kiểm tra thay đổi API/DB có cập nhật tài liệu liên quan.
3. Kiểm tra secret/config environment.
4. Nếu có migration, chạy rehearsal trên staging.
5. Backup/snapshot database nếu migration có rủi ro.
6. Deploy backend API.
7. Deploy worker sau khi API và DB tương thích.
8. Kiểm tra health endpoint, log lỗi, queue depth và smoke test P0.
9. Theo dõi dashboard ít nhất trong cửa sổ release đã định.

---

## 5. Quy trình deploy admin web

1. Build admin portal với API base URL đúng.
2. Kiểm tra auth/admin role và permission.
3. Smoke test các màn hình P0:
   - receipt queue,
   - case detail,
   - admin decision có reason,
   - moderation queue,
   - audit log.
4. Deploy artifact.
5. Kiểm tra không hiển thị ảnh hóa đơn gốc công khai hoặc dữ liệu nhạy cảm không masking.

---

## 6. Quy trình release mobile

1. Tăng version/build number.
2. Chọn environment config đúng.
3. Chạy mobile smoke/regression P0 theo `Mobile_Test_Plan.md`.
4. Kiểm tra upload receipt, idempotency retry, GPS denied, OCR pending/refetch.
5. Upload dSYM/source map nếu dùng crash reporting.
6. Gửi TestFlight/Google Play Internal trước khi production rollout.
7. Rollout production theo phần trăm nếu store hỗ trợ.
8. Theo dõi crash-free users, OTP success, receipt upload success, API error.

---

## 7. Migration và seed data

- Migration phải tuân thủ `06_Database_Design/Migration_and_Seed_Plan.md`.
- Không xóa/đổi enum trạng thái đang được mobile version cũ sử dụng nếu chưa có kế hoạch tương thích.
- Seed staging phải đủ dữ liệu cho quán ACTIVE, review VERIFIED/REFERENCE_ONLY/PENDING, receipt admin queue và moderation reports.

---

## 8. Verify sau deploy

| Nhóm | Kiểm tra |
|---|---|
| API | `/health`, 5xx rate, latency P0 endpoint |
| Auth | Request/verify OTP trên staging/beta provider hoặc mock |
| Review | Tạo review, skip receipt, refetch trạng thái |
| Receipt | Upload file hợp lệ, duplicate hash, OCR pending/verified/mock |
| Admin | Queue hiển thị case, decision ghi audit log |
| DB | Migration version đúng, không có error log |
| Worker | Queue depth giảm, không có DLQ bất thường |
| Mobile | Crash dashboard không tăng bất thường |

---

## 9. Rollback

| Thành phần | Cách rollback | Lưu ý |
|---|---|---|
| Backend API | Rollback container/image trước đó | Đảm bảo tương thích DB hiện tại |
| Worker | Dừng worker mới, chạy worker ổn định trước đó | Tránh worker lỗi ghi trạng thái sai |
| Admin web | Rollback artifact/build trước đó | Kiểm tra API contract tương thích |
| Database | Ưu tiên forward fix; rollback dữ liệu chỉ khi có backup và phê duyệt | Tránh mất dữ liệu review/receipt |
| Mobile | Dừng rollout, dùng feature flag, phát hành hotfix | Không thể ép toàn bộ user rollback app đã cài |

---

## 10. Điều kiện không được deploy production

- Không có rollback plan cho thay đổi DB/API rủi ro.
- Test P0 thất bại hoặc chưa chạy.
- OpenAPI/API docs lệch với implementation ở endpoint P0.
- Có lỗi lộ dữ liệu nhạy cảm chưa xử lý.
- Admin queue/audit log không hoạt động khi release có receipt/moderation flow.
- Monitoring P0 chưa bật cho beta/production.
