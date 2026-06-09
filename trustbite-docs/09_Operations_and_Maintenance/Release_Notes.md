# Release notes - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Release notes log |
| Phiên bản | v1.0.0 |
| Trạng thái | Bản nháp |
| Chủ sở hữu | Product Owner / Tech Lead / QA Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Ghi nhận nội dung từng bản release để Product, Engineering, QA, Ops và Support biết thay đổi nào đã được đưa lên beta/production, rủi ro nào còn tồn tại và cách rollback nếu cần.

---

## 2. Template release note

```markdown
## Version x.y.z

| Trường | Nội dung |
|---|---|
| Release date | YYYY-MM-DD |
| Environment | Staging / Beta / Production |
| Owner |  |
| Related PRs |  |
| Related docs |  |

### New features
-

### Improvements
-

### Bug fixes
-

### API changes
-

### Database/migration changes
-

### Security/privacy impact
-

### Known issues
-

### Rollback note
-

### Post-release monitoring focus
-
```

---

## 3. Release note log

### Version TBD

| Trường | Nội dung |
|---|---|
| Release date | Chưa phát hành |
| Environment | Staging/Beta |
| Owner | Product Owner / Tech Lead |
| Related PRs | TBD |
| Related docs | PRD, API Specification, Test Plan, Mobile Release Checklist |

#### New features

- Baseline MVP: OTP, quán ACTIVE, review 4 tiêu chí, receipt upload, OCR/risk, admin queue, moderation, audit log, EXP/rank cơ bản.

#### Known issues

- Chưa ghi nhận. Cập nhật sau QA/UAT.

#### Rollback note

- Tuân thủ `Deployment_Guide.md` và `Mobile_Release_Checklist.md`.

---

## 4. Quy tắc cập nhật

- Mỗi beta/production release phải có một mục release note.
- Nếu release có migration, phải ghi rõ migration và rollback/forward-fix note.
- Nếu release có thay đổi privacy/security, phải ghi rõ dữ liệu bị ảnh hưởng và tài liệu đã cập nhật.
- Nếu có known issue P0/P1, phải ghi owner và quyết định release waiver nếu vẫn phát hành.
