# Device test matrix - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Device test matrix |
| Phiên bản | v1.0.0 |
| Trạng thái | Bản nháp |
| Chủ sở hữu | QA Lead / Mobile Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Xác định thiết bị và phiên bản OS tối thiểu cần kiểm thử cho mobile MVP. Matrix này có thể mở rộng sau beta dựa trên dữ liệu người dùng thật.

---

## 2. Matrix tối thiểu MVP

| Platform | Thiết bị | OS mục tiêu | Loại test |
|---|---|---|---|
| iOS | iPhone đời phổ biến màn hình nhỏ | iOS current - 1 | Auth, search, review, upload HEIC, GPS |
| iOS | iPhone đời mới màn hình lớn | iOS current | Full P0 regression |
| Android | Android tầm trung | Android 11 hoặc 12 | Auth, search, review, upload JPG/PNG, GPS |
| Android | Android đời mới | Android current | Full P0 regression |
| Android | Thiết bị dung lượng thấp hoặc emulator giới hạn | Android 11+ | Mạng yếu, upload lỗi, performance cơ bản |

Nếu thiếu thiết bị thật, có thể dùng simulator/emulator cho một phần test, nhưng upload ảnh, camera, GPS và permission nên được kiểm thử trên ít nhất một thiết bị thật mỗi platform.

---

## 3. Case bắt buộc theo platform

| Case | iOS | Android |
|---|---|---|
| OTP login | Có | Có |
| HEIC upload | Có | Không bắt buộc |
| JPG/PNG upload | Có | Có |
| Camera permission | Có | Có |
| Photo library permission | Có | Có |
| GPS denied/granted | Có | Có |
| App background/foreground khi OCR pending | Có | Có |
| Network offline/timeout | Có | Có |
| VoiceOver/TalkBack | VoiceOver | TalkBack |
| Secure storage logout | Có | Có |

---

## 4. Browser/device cho admin portal

| Bề mặt | Thiết bị/browser | Ghi chú |
|---|---|---|
| Admin portal | Chrome desktop current | Bắt buộc P0 |
| Admin portal | Edge/Safari desktop | Smoke test |
| Merchant portal P1 | Chrome desktop current | Khi triển khai P1 |

---

## 5. Tiêu chí mở rộng matrix

Mở rộng matrix khi:

- Beta analytics cho thấy một OS/device chiếm tỷ lệ cao.
- Có lỗi upload/camera/GPS chỉ xảy ra trên nhóm thiết bị cụ thể.
- App chuẩn bị public production.
- Tính năng native mới được thêm vào.
