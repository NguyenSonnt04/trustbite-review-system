# Traceability matrix production-ready - TrustBite MVP

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Ma trận truy vết yêu cầu |
| Phiên bản | v1.1.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | PO / BA / Engineering Lead / QA Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Ma trận này dùng để kiểm tra mỗi năng lực P0 có đủ liên kết từ Product → BA → UX → API → DB → QA/Ops trước khi đưa vào sprint hoặc release beta.

Quy tắc production-ready: một dòng P0 chỉ được đánh dấu sẵn sàng khi có đủ PRD, story, API contract, DB/schema nếu cần, test case và owner.

---

## 2. Ma trận P0 MVP

| Capability P0 | PRD/Feature | Story | Business rule/state | UX | API | DB | QA/UAT | Readiness |
|---|---|---|---|---|---|---|---|---|
| OTP login | `AUTH-001` | `AUTH-US-001` → `AUTH-US-004` | `BR-AUTH-001` → `BR-AUTH-003` | `MOB-004` | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/refresh`, `POST /auth/logout` | `users`, `otp_verifications`, `user_sessions` | `AUTH-TC-001` → `AUTH-TC-003`, `MOB-AUTH-001`, `MOB-AUTH-002` | Cần OpenAPI schema chi tiết |
| Xem/tìm quán ACTIVE | `REST-001`, `REST-002` | `REST-US-001` → `REST-US-003` | `BR-REST-001`, restaurant state | `MOB-001`, `MOB-002` | `GET /restaurants`, `GET /restaurants/nearby`, `GET /restaurants/{restaurantId}` | `restaurants`, `restaurant_branches`, `reviews` | Search/detail performance tests, UAT discovery | Cần seed data MVP |
| Gửi review 4 tiêu chí | `REV-001` | `REV-US-001`, `REV-US-002` | `BR-REV-001` → `BR-REV-005`, review state | `MOB-005` | `POST /reviews`, `GET /reviews/{reviewId}` | `reviews`, `audit_logs` nếu system event | `REV-TC-001`, `REV-TC-002`, `MOB-REV-001` | Cần OpenAPI schema + idempotency khuyến nghị |
| Skip receipt/reference-only | `REV-001` | `REV-US-003`, `REV-US-004`, `REV-US-005` | `BR-REV-006` → `BR-REV-008`, `Status_Mapping.md` | `MOB-007`, trust copy | `POST /reviews/{reviewId}/skip-verification`, `GET /reviews/{reviewId}` | `reviews`, `audit_logs` system event khuyến nghị | `REV-TC-003`, `REV-TC-004`, UAT reference label | Sẵn sàng sau status mapping sign-off |
| Upload receipt multipart | `OCR-001` | `OCR-US-001` → `OCR-US-003` | `BR-OCR-001`, `BR-OCR-002`, `BR-OCR-006` → `BR-OCR-008` | `MOB-006` | `POST /receipts`, `GET /receipts/{receiptVerificationId}` | `receipt_verifications`, `idempotency_keys` | `OCR-TC-004`, `OCR-TC-005`, `MOB-REC-001` → `MOB-REC-003` | Cần migration `idempotency_keys` |
| Duplicate receipt hash | `OCR-001` | `OCR-US-004` | `BR-OCR-003`, `DUPLICATE_DETECTED` state | `MOB-007`, admin case | `POST /receipts`, `GET /receipts/{receiptVerificationId}` | `receipt_verifications`, `fraud_flags`, `audit_logs` | `OCR-TC-002`, UAT-002 | Sẵn sàng sau duplicate/idempotency integration test |
| OCR async + risk scoring | `OCR-001`, `TRUST-001` | `OCR-US-005`, `OCR-US-006` | `BR-FRAUD-001` → `BR-FRAUD-004`, `Anti_Fraud_Specification.md`, `Status_Mapping.md` | `MOB-007`, admin risk panel | Worker job, `GET /receipts/{receiptVerificationId}` | `receipt_verifications`, `fraud_flags`, queue/Redis | `OCR-TC-001`, `OCR-TC-003`, performance OCR queue | Cần OCR mock/provider contract |
| GPS optional signal | `GPS-001` | `GPS-US-001`, `GPS-US-002` | `BR-PRIV-001`, GPS risk rule | `MOB-006`, permission copy | GPS fields in `POST /receipts`, optional `POST /reviews/{reviewId}/gps` | `receipt_verifications.gps_*` | `GPS-TC-001`, `MOB-GPS-001`, UAT-004 | Cần PO sign-off điểm risk thiếu GPS |
| Admin receipt queue/decision | `ADM-001` | `ADM-US-001` → `ADM-US-004`, `ADM-US-006` | `BR-ADM-001`, `BR-ADM-002`, `BR-ADM-005`, admin decision mapping | `ADM-001` → `ADM-003`, `ADM-006` | `GET /admin/queues/receipts`, `POST /admin/receipt-verifications/{receiptVerificationId}/decision` | `receipt_verifications`, `audit_logs`, `fraud_flags` | `ADM-TC-001` → `ADM-TC-005`, UAT-003 | Cần OpenAPI admin response schema |
| Moderation report/action | `MOD-001` | `MOD-US-001`, `MOD-US-002`, `ADM-US-005` | moderation state, content policy | `MOB-009`, `ADM-004` | `POST /moderation/reports`, `GET /admin/moderation/reports`, decision endpoint | `moderation_reports`, `moderation_actions`, `audit_logs`, `reviews` | `MOD-TC-001`, UAT-005 | Cần reason codes chuẩn |
| Claim tối thiểu beta | `MERCH-CLAIM-MVP` | `ADM-US-007` | claim state, role matrix | `ADM-005` | `POST /merchant/claims` hoặc admin/manual intake, `POST /admin/restaurant-claims/{id}/decision` | `merchants`, `restaurant_claims`, `audit_logs` | P1/MVP feature-flag test, UAT-006 | Feature flag; không chặn MVP nếu không bật |
| EXP/rank cơ bản | `GAME-001` | `GAME-US-001`, `GAME-US-002` | gamification rules, trust weight | `MOB-008` | `GET /gamification/me`, `GET /users/me` | `users.exp_points`, `users.rank_code`, optional `user_badges` | Profile/game test | Cần job recalculation rule chi tiết nếu launch công khai |
| Privacy receipt/GPS/log redaction | Privacy policy | Cross-cutting | `BR-PRIV-001` → `BR-PRIV-004` | receipt/admin masking requirements | Signed URL/admin endpoints | private storage URLs, `redacted_file_url`, audit metadata | `PRIV-TC-001`, mobile release checklist, security DoD | Cần Legal/Security sign-off |
| Account deletion | `PRIV-001` | `PRIV-US-001`, `PRIV-US-002` | `BR-PRIV-005`, `Data_Retention_Policy.md` | `MOB-010`, account deletion copy | `POST /users/me/deletion-request`, web deletion form/API | `account_deletion_requests`, `users.deletion_requested_at`, audit metadata | `PRIV-TC-002`, `MOB-PRIV-001`, UAT-007 | Store-blocking P0 trước public beta |
| UGC report/block safety | `SAFETY-001`, `MOD-001` | `SAFETY-US-001`, `SAFETY-US-002`, `MOD-US-001` | `Content_Moderation_Policy.md`, moderation state | `MOB-009`, review/user action menu | `POST /moderation/reports`, `POST /users/{userId}/block`, `DELETE /users/{userId}/block` | `moderation_reports`, `moderation_actions`, `user_blocks`, `audit_logs` | `MOD-TC-001`, `SAFETY-TC-001`, UAT-008 | Store-blocking P0 trước public beta |
| Store submission readiness | Store readiness gate | `STORE-US-001` | store checklist rules | Store metadata/screenshots | Reviewer access/demo account; no runtime API unless app access | release evidence, vendor register | `STORE-TC-001`, release checklist | Cần Release Manager sign-off |
| Monitoring/beta ops | Ops readiness | Cross-cutting | incident/runbook rules | N/A | health/metrics endpoints nếu có | logs/metrics/storage | Monitoring DoD, backup restore test | Cần owner/on-call thực tế |

---

## 3. Release gate P0

Trước beta/public release, các điều kiện sau phải đạt:

- Không còn dòng P0 có `Readiness` là thiếu artefact bắt buộc.
- OpenAPI P0 đã được review bởi Backend, Mobile, Admin Web và QA.
- DB migration + seed data đã chạy trên staging.
- QA có test data cho mọi trạng thái trong `Status_Mapping.md`.
- Security/Privacy sign-off cho OTP, token, receipt image, OCR text, GPS và audit log.
- Ops có dashboard/alert owner theo `Monitoring_and_Incident_Runbook.md`.
- In-app account deletion, web deletion link/form và UGC report/block đã pass QA trên iOS/Android.
- Store submission checklist, App Privacy/Data Safety mapping, content/age rating và reviewer access đã được owner sign-off.

---

## 4. Quy tắc cập nhật

- Khi thêm/sửa P0 feature, bắt buộc cập nhật dòng tương ứng trong ma trận này.
- Khi đổi API, cập nhật `API_Specification.md`, `openapi.yaml` và cột API.
- Khi đổi schema/status, cập nhật `PostgreSQL_Database_Schema.md`, `Status_Mapping.md`, `State_Machines.md` và cột DB/QA.
- Khi test case đổi, cập nhật cột QA/UAT và tài liệu test liên quan.
