# Kế hoạch kiểm thử mobile - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Mobile test plan |
| Phiên bản | v1.1.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | QA Lead / Mobile Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Đảm bảo mobile app TrustBite trên iOS và Android vận hành đúng các luồng MVP: đăng nhập OTP, tìm kiếm quán, xem chi tiết, gửi đánh giá, upload hóa đơn, GPS tùy chọn, xem kết quả xác minh và báo cáo đánh giá.

---

## 2. Phạm vi P0

| Nhóm | Nội dung |
|---|---|
| Auth | OTP request, verify, resend, expired, rate limit, logout, token hết hạn |
| Explore | Search, map/list, filter, restaurant detail |
| Review | Rating 4 tiêu chí, comment validation, submit |
| Receipt | Chọn ảnh, chụp ảnh, HEIC/JPG/PNG, file quá lớn, upload lỗi, retry |
| GPS | Granted, denied, accuracy thấp, app không có location permission |
| Verification | Processing, verified, pending admin review, reference only, rejected |
| Network | Offline, mạng yếu, timeout, app foreground/background |
| Privacy | Không hiển thị hóa đơn gốc public, copy GPS tùy chọn, permission theo ngữ cảnh |
| Security | Token secure storage, không log OTP/token, logout xóa session local |
| Account deletion | Delete account entry, confirmation, request status, logout/session revoke, web deletion link |
| UGC safety | Report review, block user, unblock user, duplicate report handling |
| Store permissions | Camera/photo/location chỉ hỏi theo ngữ cảnh; Android Photo Picker nếu đủ core use case |
| Accessibility | VoiceOver/TalkBack label cơ bản cho P0 screens |

---

## 3. Test case P0

### MOB-AUTH-001: OTP login thành công

- Bối cảnh: app mới cài, người dùng nhập số điện thoại hợp lệ.
- Khi: người dùng nhập OTP đúng còn hạn.
- Kết quả: app đăng nhập thành công và mở main app.

### MOB-AUTH-002: Token hết hạn

- Bối cảnh: access token hết hạn.
- Khi: app gọi API cần auth.
- Kết quả: app refresh session hoặc đưa người dùng về trạng thái đăng nhập lại nếu refresh thất bại.

### MOB-EXP-001: Tìm kiếm và mở chi tiết quán

- Bối cảnh: có dữ liệu seed quán ACTIVE.
- Khi: người dùng tìm theo keyword hoặc vị trí.
- Kết quả: app hiển thị danh sách và mở được chi tiết quán.

### MOB-REV-001: Gửi đánh giá hợp lệ

- Bối cảnh: người dùng đã đăng nhập, quán ACTIVE.
- Khi: người dùng nhập 4 rating và comment tối thiểu 50 ký tự.
- Kết quả: review tạo thành công ở trạng thái SUBMITTED.

### MOB-REC-001: Upload hóa đơn JPG hợp lệ

- Bối cảnh: review đã tạo.
- Khi: người dùng chọn ảnh JPG dưới 10MB.
- Kết quả: upload thành công, app hiển thị trạng thái processing.

### MOB-REC-002: Upload HEIC từ iOS

- Bối cảnh: iPhone có ảnh HEIC hợp lệ.
- Khi: người dùng chọn ảnh và upload.
- Kết quả: app và backend xử lý đúng theo chính sách file type.

### MOB-REC-003: File quá lớn

- Bối cảnh: ảnh lớn hơn 10MB.
- Khi: người dùng chọn ảnh.
- Kết quả: app hiển thị lỗi rõ hoặc backend trả `FILE_TOO_LARGE`; không crash.

### MOB-GPS-001: Từ chối GPS

- Bối cảnh: người dùng tới bước upload hóa đơn.
- Khi: người dùng từ chối GPS.
- Kết quả: flow vẫn tiếp tục, app giải thích GPS là tùy chọn.

### MOB-NET-001: Mất mạng khi upload

- Bối cảnh: đang upload hóa đơn.
- Khi: mạng bị ngắt.
- Kết quả: app hiển thị lỗi/retry, không mất review đã tạo.

### MOB-STATE-001: App bị kill khi OCR đang xử lý

- Bối cảnh: hóa đơn đã upload, OCR đang processing.
- Khi: người dùng kill app rồi mở lại.
- Kết quả: app lấy lại trạng thái từ backend.

### MOB-A11Y-001: Screen reader cho trạng thái xác minh

- Bối cảnh: VoiceOver/TalkBack bật.
- Khi: người dùng mở Verification Result.
- Kết quả: trạng thái Verified/Reference/Pending/Rejected được đọc bằng nhãn chữ rõ ràng.

---

## 4. Điều kiện bắt đầu

- API staging sẵn sàng.
- Có device/simulator theo `Device_Test_Matrix.md`.
- Có tài khoản test cho user thường, user bị restricted, admin để set trạng thái.
- Có bộ ảnh hóa đơn test: JPG, PNG, HEIC, quá dung lượng, mờ, sai quán, trùng hash.
- Có feature flag/environment config rõ cho staging/beta.

---

## 5. Điều kiện kết thúc

- 100% mobile P0 đạt.
- Không còn blocker/critical trên device matrix tối thiểu.
- Crash-free users beta đạt ngưỡng được PO/Engineering thống nhất.
- Upload hóa đơn đạt trên cả iOS và Android.
- GPS denied không chặn flow.
- Accessibility cơ bản cho màn hình P0 đạt.


### MOB-PRIV-001: Yêu cầu xóa tài khoản trong app

- Bối cảnh: người dùng đã đăng nhập.
- Khi: mở Account Settings, chọn xóa tài khoản, đọc hậu quả, xác nhận chủ động và gửi yêu cầu.
- Kết quả: app hiển thị trạng thái request, không crash, token/session được xử lý theo API, người dùng hiểu cách theo dõi hoặc liên hệ support.

### MOB-PRIV-002: Web deletion link

- Bối cảnh: người dùng ở màn Account Settings hoặc store metadata.
- Khi: mở link/form xóa tài khoản ngoài app.
- Kết quả: link hoạt động trên trình duyệt, không yêu cầu app đang cài, copy nhất quán với Privacy Policy.

### MOB-SAFETY-001: Báo cáo và chặn người dùng

- Bối cảnh: người dùng thấy review vi phạm.
- Khi: gửi report, thử report trùng cùng reason, chặn người dùng, bỏ chặn.
- Kết quả: report hợp lệ tạo thành công, report trùng hiển thị copy rõ, block/unblock cập nhật UI và không ảnh hưởng review hợp lệ ngoài phạm vi block.

### MOB-STORE-001: Permission theo ngữ cảnh

- Bối cảnh: app mới cài.
- Khi: mở app, tìm quán, chọn/chụp hóa đơn, chọn GPS.
- Kết quả: app không hỏi camera/photo/location trước khi cần; từ chối quyền không làm crash; GPS denied vẫn xử lý được hóa đơn.
