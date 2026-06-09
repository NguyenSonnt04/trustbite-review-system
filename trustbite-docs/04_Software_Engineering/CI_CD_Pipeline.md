# Quy trình CI/CD và triển khai - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Quy trình CI/CD và triển khai |
| Phiên bản | v2.6.1 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | DevOps |
| Ngày cập nhật | 2026-06-09 |

---

## 1. Mô hình nhánh Git

Khuyến nghị dùng trunk-based development hoặc GitHub Flow đơn giản cho MVP:

```text
feature/* → pull request → main → triển khai staging/production theo pipeline
```

Quy tắc:

- Không push trực tiếp vào `main` nếu chưa qua review.
- Pull request phải chạy lint/test trước khi merge.
- Thay đổi tài liệu lớn phải cập nhật `Version_History.md` nếu ảnh hưởng phạm vi MVP/API/DB/QA.
- Quy ước branch/commit/code review chi tiết nằm trong `Development_Guidelines.md`.

---

## 2. Baseline hiện tại của repository

Tính đến baseline CI/security/container của PR #4, repository mới triển khai lớp kiểm tra nền tảng, chưa triển khai đầy đủ CD staging/production.

Đã triển khai:

- Pull request và push workflow cho `main`.
- Client dependency install, lint và production build.
- Server dependency install và kiểm tra cú pháp JavaScript vì `server/package.json` chưa có `build`/`test` script.
- Mobile dependency install và `flutter test`.
- Harness CLI bootstrap, brownfield import và matrix query trong CI.
- Client/server Docker image build không push registry.
- Trivy image scan ở chế độ report-only cho baseline build.
- Dependency Review và CodeQL chạy ở chế độ tolerant/report-only khi repository chưa bật đầy đủ GitHub Advanced Security/code scanning.
- Không dùng AWS credentials, registry credentials hoặc deploy permissions trong baseline.

Chưa triển khai:

- Format check riêng ngoài lint.
- Client unit test.
- Server unit/integration test và backend build proof.
- API/DB integration test.
- Database migration validation và rollback automation.
- OpenAPI contract validation.
- Generated API client/schema validation cho mobile.
- Mobile staging/beta/production build artifact.
- Registry push, staging deploy, production deploy và deploy approval.
- Blocking CodeQL/SARIF/code scanning khi repository security features chưa được bật.

Vì vậy các mục bên dưới là yêu cầu mục tiêu cho MVP pipeline. Không nên hiểu baseline PR #4 là đã hoàn thành toàn bộ tài liệu này.

---

## 3. Quy trình CI mục tiêu

Mỗi pull request cần chạy tối thiểu:

1. Kiểm tra format/lint.
2. Kiểm thử đơn vị.
3. Kiểm thử tích hợp nếu có thay đổi API/DB.
4. Build mobile app, admin web và backend theo phần bị ảnh hưởng.
5. Kiểm tra migration nếu có thay đổi database.
6. Kiểm tra OpenAPI contract nếu có thay đổi API.
7. Kiểm tra mobile type/schema nếu app dùng generated API client.

Yêu cầu theo giai đoạn:

| Giai đoạn | Yêu cầu tối thiểu |
|---|---|
| Baseline hiện tại | Client lint/build, server syntax check, mobile test, Harness matrix, Docker build/scan report-only. |
| Server test baseline | Thêm server test script, health/API smoke test và CI job tương ứng. |
| API/DB baseline | Thêm OpenAPI validation, migration validation và integration test khi API/DB thay đổi. |
| Release baseline | Thêm mobile build artifact, registry push, staging deploy và approval/rollback path. |

---

## 4. Quy trình CD mục tiêu

| Môi trường | Điều kiện triển khai | Ghi chú |
|---|---|---|
| Local | Developer tự chạy | Docker Compose cho PostgreSQL/Redis, mobile app trỏ API local/staging. |
| Staging | Merge vào `main` hoặc tag staging | Dùng cho QA/UAT. Chưa nằm trong baseline PR #4. |
| Beta mobile | Tag beta hoặc approval thủ công | TestFlight/Google Play Internal Testing. Chưa nằm trong baseline PR #4. |
| Production | Tag release hoặc approval thủ công | Cần backup/migration plan trước deploy và release note. Chưa nằm trong baseline PR #4. |

---

## 5. Yêu cầu triển khai MVP

- Mobile app có build riêng cho staging/beta/production.
- API và worker có thể deploy độc lập.
- OCR worker không được chặn request chính.
- Migration database phải có rollback plan.
- Secret lấy từ secret manager hoặc biến môi trường an toàn.
- Không ghi OTP, token, text hóa đơn đầy đủ hoặc GPS gốc vào log.

---

## 6. Điều kiện chặn merge/deploy

Điều kiện chặn merge/deploy mục tiêu:

- Lint hoặc build thất bại.
- Test P0 thất bại.
- Migration phá backward compatibility mà chưa có kế hoạch.
- Thay đổi API không cập nhật `API_Specification.md`.
- Thay đổi trạng thái nghiệp vụ không cập nhật `State_Machines.md` và test case liên quan.

Trong baseline hiện tại, các kiểm tra security phụ thuộc GitHub Advanced Security/code scanning được chạy ở chế độ tolerant/report-only. Khi repository bật đầy đủ security features, có thể chuyển CodeQL, Dependency Review và SARIF upload sang blocking theo policy này.

---

## 7. Khôi phục phiên bản

- Admin/Merchant web: rollback về artifact/build trước đó.
- Backend: rollback image/container trước đó.
- Database: ưu tiên migration backward-compatible; nếu bắt buộc rollback dữ liệu, cần backup trước deploy.
- Worker: dừng worker mới và chạy lại worker ổn định trước đó nếu lỗi xử lý hàng đợi.
- Mobile: rollback bằng cách dừng rollout, phát hành hotfix hoặc dùng feature flag để tắt tính năng lỗi nếu có.

---

## 8. Tài liệu liên quan

- `Development_Guidelines.md`: quy chuẩn code, branch, commit, review và PR checklist.
- `09_Operations_and_Maintenance/Deployment_Guide.md`: các bước deploy, verify và rollback chi tiết.
- `09_Operations_and_Maintenance/Release_Notes.md`: template ghi nhận nội dung từng release.
