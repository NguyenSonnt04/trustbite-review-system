# Quy chuẩn phát triển - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Development guideline |
| Phiên bản | v1.0.0 |
| Trạng thái | Bản nháp |
| Chủ sở hữu | Engineering Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Tài liệu này chuẩn hóa cách phát triển TrustBite để mobile app, admin web, backend, database và tài liệu đi cùng một nhịp. Đây là guideline triển khai; chi tiết CI/CD nằm trong `CI_CD_Pipeline.md`.

---

## 2. Nguyên tắc phát triển

- Backend là nguồn sự thật cho trạng thái review, receipt, fraud, moderation và audit.
- Mobile/admin chỉ hiển thị hoặc refetch trạng thái từ API, không tự suy diễn trạng thái cuối.
- Mọi quyết định admin phải có `reason` và ghi `audit_logs`.
- GPS là optional; thiếu GPS không được tự động reject review/receipt.
- Ảnh hóa đơn gốc là private; chỉ dùng bản đã che dữ liệu nhạy cảm nếu cần hiển thị bằng chứng.
- Mọi thay đổi P0 phải cập nhật tài liệu traceability, API/DB/QA liên quan.

---

## 3. Git workflow

MVP ưu tiên GitHub Flow/trunk-based đơn giản:

```text
feature/* hoặc bugfix/* -> pull request -> main -> staging/beta/production theo pipeline
```

Quy tắc:

- Không push trực tiếp vào `main`.
- PR nhỏ, có mô tả rõ thay đổi và tài liệu bị ảnh hưởng.
- Hotfix production dùng nhánh `hotfix/*`, review nhanh nhưng vẫn phải có kiểm tra tối thiểu.
- Release quan trọng phải được tag và có release note.

---

## 4. Quy ước branch

| Loại | Mẫu | Ví dụ |
|---|---|---|
| Feature | `feature/<scope>-<short-name>` | `feature/receipt-idempotency` |
| Bugfix | `bugfix/<scope>-<short-name>` | `bugfix/otp-rate-limit` |
| Hotfix | `hotfix/<scope>-<short-name>` | `hotfix/admin-decision-audit` |
| Docs | `docs/<scope>-<short-name>` | `docs/release-guide` |
| Refactor | `refactor/<scope>-<short-name>` | `refactor/risk-scoring` |

---

## 5. Quy ước commit

Dùng Conventional Commits:

```text
feat: add receipt upload idempotency
fix: prevent GPS denied from rejecting receipt
refactor: simplify risk scoring thresholds
docs: update API specification for admin decision
chore: adjust CI contract test
```

Loại commit khuyến nghị:

| Type | Khi dùng |
|---|---|
| `feat` | Thêm tính năng |
| `fix` | Sửa lỗi |
| `docs` | Sửa tài liệu |
| `refactor` | Đổi cấu trúc không đổi hành vi |
| `test` | Thêm/sửa test |
| `chore` | Công việc phụ trợ/tooling |
| `ci` | Pipeline/CI/CD |

---

## 6. Coding convention baseline

### 6.1. TypeScript/NestJS/Next.js/React Native

- Bật TypeScript strict mode nếu khả thi.
- Tên biến/hàm dùng `camelCase`; type/interface/class dùng `PascalCase`.
- Enum/status nghiệp vụ phải khớp `State_Machines.md` và `Status_Mapping.md`.
- DTO/request/response phải có validation rõ ràng.
- Không hard-code endpoint, secret, bucket, provider key trong source.
- API client mobile/admin nên sinh từ OpenAPI hoặc có contract test tương đương.

### 6.2. Database

- PostgreSQL 15+ và PostGIS.
- Tên bảng/cột dùng `snake_case`.
- Bảng vận hành phải có `created_at`, `updated_at` nếu phù hợp.
- Migration phải backward-compatible khi có mobile app đã phát hành.
- Trạng thái DB phải đồng bộ với `Status_Mapping.md`.

### 6.3. Mobile

- Token lưu trong secure storage, không lưu token thô trong log/analytics.
- Upload receipt dùng retry/idempotency theo `Idempotency_and_Retry_Design.md`.
- App phải xử lý offline/network weak cho OTP, upload, OCR pending và refetch.
- Không coi GPS denied là lỗi chặn flow.

---

## 7. Error handling và logging

- API error response tuân thủ `OpenAPI_Guidelines.md`.
- Error code phải ổn định để mobile/admin map thông báo.
- Log cần có `requestId`/correlation id cho P0 flow.
- Không log OTP, token, số điện thoại đầy đủ, GPS gốc, OCR text đầy đủ hoặc ảnh hóa đơn.
- Lỗi upload/OCR/worker cần đủ metadata để debug nhưng phải masking dữ liệu nhạy cảm.

---

## 8. Code review checklist

Reviewer phải kiểm tra tối thiểu:

- Requirement/acceptance criteria đã được đáp ứng.
- Edge case chính đã xử lý: retry, timeout, duplicate, permission denied, offline.
- Không phá trạng thái trong `State_Machines.md`/`Status_Mapping.md`.
- API thay đổi đã cập nhật `API_Specification.md` và `openapi.yaml`.
- DB thay đổi đã cập nhật schema/data dictionary/migration plan.
- Có test phù hợp cho P0 hoặc có lý do rõ nếu chưa có.
- Không lộ dữ liệu nhạy cảm trong log, error, analytics, screenshot hoặc fixture.
- Có audit log cho admin decision hoặc system decision quan trọng.
- Có ảnh hưởng release/rollback/monitoring không; nếu có đã cập nhật Ops docs.

---

## 9. PR checklist đề xuất

```markdown
## Tóm tắt
-

## Loại thay đổi
- [ ] Feature
- [ ] Bugfix
- [ ] Docs
- [ ] Refactor
- [ ] Hotfix

## Kiểm tra
- [ ] Unit/integration test phù hợp đã chạy
- [ ] Contract/OpenAPI test nếu đổi API
- [ ] Migration test nếu đổi DB
- [ ] Mobile/admin smoke test nếu đổi UI/API P0
- [ ] Không log dữ liệu nhạy cảm

## Tài liệu liên quan
- [ ] PRD/Functional Spec/Business Rules
- [ ] State Machines/Status Mapping
- [ ] API/OpenAPI
- [ ] DB/Data Dictionary/Migration Plan
- [ ] QA/UAT/Acceptance Criteria
- [ ] Release/Ops/Runbook
```

---

## 10. Khi nào phải cập nhật tài liệu

- Thêm/sửa feature P0.
- Đổi trạng thái, enum, rule validation, permission.
- Đổi API request/response/error code.
- Đổi schema, index, migration, retention.
- Đổi flow mobile/admin hoặc UX copy liên quan privacy/trust.
- Đổi release/deployment/monitoring hoặc cách support xử lý lỗi.
