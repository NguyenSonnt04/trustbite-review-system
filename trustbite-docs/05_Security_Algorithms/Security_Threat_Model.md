# Security threat model - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Security threat model |
| Phiên bản | v1.0.0 |
| Trạng thái | Bản nháp |
| Chủ sở hữu | Security Lead / Engineering Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Phạm vi

Threat model MVP bao phủ mobile app, API, admin portal, storage hóa đơn, OCR worker, SMS OTP, GPS tùy chọn và audit/admin operations.

---

## 2. Tài sản cần bảo vệ

| Tài sản | Mức nhạy cảm | Rủi ro chính |
|---|---|---|
| Số điện thoại | Cao | Lộ PII, account takeover |
| OTP/token/session | Rất cao | Chiếm tài khoản |
| Ảnh hóa đơn | Rất cao | Lộ thông tin cá nhân/giao dịch |
| OCR text | Cao | Lộ nội dung hóa đơn |
| GPS | Cao | Lộ vị trí cá nhân |
| Audit log | Cao | Che giấu hành vi admin sai phạm |
| Admin account | Rất cao | Duyệt sai, ẩn/xóa nội dung, lộ dữ liệu |
| Receipt hash | Trung bình | Replay/abuse detection |

---

## 3. Threats MVP

| Threat | Mô tả | Kiểm soát bắt buộc |
|---|---|---|
| OTP brute force | Thử nhiều OTP hoặc spam request OTP | Rate limit theo phone/IP/device signal, hash OTP, giới hạn failed attempts, log bảo mật |
| Account takeover | Token bị đánh cắp trên mobile | Secure storage, token TTL ngắn, refresh revoke, không log token |
| Fake receipt | Người dùng upload hóa đơn giả/sai quán | OCR similarity, receipt time, hash duplicate, fraud score, admin review |
| Receipt replay | Dùng lại cùng hóa đơn nhiều lần | SHA-256 hash unique, duplicate flag, audit |
| GPS spoofing | Giả vị trí GPS | GPS chỉ là tín hiệu phụ, không quyết định tuyệt đối, risk score |
| Object storage exposure | Bucket hóa đơn public hoặc signed URL lộ quá lâu | Bucket private, signed URL TTL ngắn, least privilege IAM |
| OCR provider exposure | Gửi dữ liệu nhạy cảm sang provider ngoài | DPA/vendor review, chỉ gửi file cần OCR, không log dữ liệu thừa |
| Admin abuse | Admin duyệt/xóa/ẩn sai mục đích | RBAC, audit log, reason bắt buộc, super admin review cho override |
| API abuse | Spam review/upload/report | Rate limit, auth guard, validation, fraud flags |
| Mobile reverse engineering | Lộ API key/secret trong app | Không nhúng secret nhạy cảm, dùng backend proxy khi cần, certificate pinning xem xét sau MVP |
| Insecure logging | Log chứa OTP/token/GPS/OCR text | Log redaction, lint/checklist, restricted access |

---

## 4. Kiểm soát theo lớp

### Mobile app

- Token lưu trong secure storage.
- Không ghi OTP/token/GPS gốc/OCR text vào analytics hoặc crash log.
- Permission prompt theo ngữ cảnh.
- Kiểm tra sơ bộ file upload nhưng không tin client là nguồn sự thật.
- Không nhúng secret backend trong app bundle.

### API

- Auth guard và RBAC cho endpoint cần quyền.
- Rate limit OTP, review, upload, report.
- Validate DTO/schema.
- Chuẩn hóa error để không rò rỉ thông tin nội bộ.
- Request ID cho audit/support.

### Storage

- Private bucket.
- Signed URL TTL ngắn.
- IAM least privilege cho API/worker.
- Lifecycle theo retention policy.

### Admin portal

- Role-based access.
- Reason bắt buộc cho quyết định.
- Audit log cho mọi action nhạy cảm.
- Mask số điện thoại và dữ liệu nhạy cảm nếu không cần xem đầy đủ.

---

## 5. Security Definition of Done

- Endpoint mới có auth/permission rule rõ.
- Endpoint upload có size/type validation và rate limit.
- Dữ liệu nhạy cảm không xuất hiện trong log/analytics.
- Admin action có audit log.
- Test bảo mật P0 đạt trong `Test_Plan.md` và `Mobile_Test_Plan.md`.
- Threat mới được thêm vào tài liệu này nếu feature mới tạo bề mặt tấn công mới.
