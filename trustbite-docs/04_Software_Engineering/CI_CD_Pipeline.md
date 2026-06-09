# Quy trình CI/CD và triển khai - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Quy trình CI/CD và triển khai |
| Phiên bản | v2.5.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | DevOps |
| Ngày cập nhật | 2026-06-07 |

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

## 2. Quy trình CI

Mỗi pull request cần chạy tối thiểu:

1. Kiểm tra format/lint.
2. Kiểm thử đơn vị.
3. Kiểm thử tích hợp nếu có thay đổi API/DB.
4. Build mobile app, admin web và backend theo phần bị ảnh hưởng.
5. Kiểm tra migration nếu có thay đổi database.
6. Kiểm tra OpenAPI contract nếu có thay đổi API.
7. Kiểm tra mobile type/schema nếu app dùng generated API client.

---

## 3. Quy trình CD

| Môi trường | Điều kiện triển khai | Ghi chú |
|---|---|---|
| Local | Developer tự chạy | Docker Compose cho PostgreSQL/Redis, mobile app trỏ API local/staging. |
| Staging | Merge vào `main` hoặc tag staging | Dùng cho QA/UAT. |
| Beta mobile | Tag beta hoặc approval thủ công | TestFlight/Google Play Internal Testing. |
| Production | Tag release hoặc approval thủ công | Cần backup/migration plan trước deploy và release note. |

---

## 4. Yêu cầu triển khai MVP

- Mobile app có build riêng cho staging/beta/production.
- API và worker có thể deploy độc lập.
- OCR worker không được chặn request chính.
- Migration database phải có rollback plan.
- Secret lấy từ secret manager hoặc biến môi trường an toàn.
- Không ghi OTP, token, text hóa đơn đầy đủ hoặc GPS gốc vào log.

---

## 5. Điều kiện chặn merge/deploy

- Lint hoặc build thất bại.
- Test P0 thất bại.
- Migration phá backward compatibility mà chưa có kế hoạch.
- Thay đổi API không cập nhật `API_Specification.md`.
- Thay đổi trạng thái nghiệp vụ không cập nhật `State_Machines.md` và test case liên quan.

---

## 6. Khôi phục phiên bản

- Admin/Merchant web: rollback về artifact/build trước đó.
- Backend: rollback image/container trước đó.
- Database: ưu tiên migration backward-compatible; nếu bắt buộc rollback dữ liệu, cần backup trước deploy.
- Worker: dừng worker mới và chạy lại worker ổn định trước đó nếu lỗi xử lý hàng đợi.
- Mobile: rollback bằng cách dừng rollout, phát hành hotfix hoặc dùng feature flag để tắt tính năng lỗi nếu có.

---

## 7. Tài liệu liên quan

- `Development_Guidelines.md`: quy chuẩn code, branch, commit, review và PR checklist.
- `09_Operations_and_Maintenance/Deployment_Guide.md`: các bước deploy, verify và rollback chi tiết.
- `09_Operations_and_Maintenance/Release_Notes.md`: template ghi nhận nội dung từng release.
