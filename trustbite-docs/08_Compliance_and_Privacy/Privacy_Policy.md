# Chính sách quyền riêng tư và bảo vệ dữ liệu người dùng - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Chính sách quyền riêng tư |
| Phiên bản | v2.4.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Pháp lý / Bảo mật |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Phạm vi

TrustBite xử lý dữ liệu cá nhân để xác thực đánh giá và chống gian lận. Dữ liệu nhạy cảm nhất gồm số điện thoại, ảnh hóa đơn, GPS tùy chọn, log bảo mật và audit log.

---

## 2. Dữ liệu được thu thập

| Dữ liệu | Mục đích | Quy tắc MVP |
|---|---|---|
| Số điện thoại | Đăng nhập OTP, định danh tài khoản | Bắt buộc với người dùng đã đăng ký. |
| Ảnh hóa đơn | Xác minh đánh giá | Lưu riêng tư theo mặc định. |
| Văn bản OCR | Đối chiếu tên quán/thời gian | Dùng cho xác minh. |
| Tọa độ GPS | Tín hiệu xác minh tùy chọn | Cần sự đồng ý của người dùng; không theo dõi liên tục. |
| Hash IP/user-agent | Giới hạn tần suất và bảo mật | Chỉ lưu ngắn hạn. |
| Audit log | Trách nhiệm giải trình vận hành | Chỉ người có quyền mới được truy cập. |

---

## 3. Quyền riêng tư về số điện thoại / xác thực

- MVP dùng đăng nhập OTP, không yêu cầu mật khẩu.
- OTP phải được hash trước khi lưu.
- Không ghi OTP, token hoặc đầy đủ số điện thoại vào log.
- Số điện thoại nên được che trong giao diện quản trị khi không cần xem đầy đủ.

---

## 4. Quyền riêng tư về hóa đơn

- Ảnh hóa đơn gốc được lưu riêng tư, không hiển thị công khai trực tiếp.
- Nếu cần hiển thị bằng chứng công khai, chỉ hiển thị bản đã che dữ liệu nhạy cảm.
- Dữ liệu cần che gồm: tên khách, số tài khoản, số thẻ, mã giao dịch nhạy cảm, số điện thoại nếu có.
- Thời gian lưu giữ tuân thủ `Data_Retention_Policy.md`.

---

## 5. Quyền riêng tư về GPS và quyền mobile

- GPS là tùy chọn.
- TrustBite không theo dõi vị trí liên tục.
- GPS chỉ được lấy tại thời điểm người dùng chủ động gửi đánh giá/hóa đơn và cấp quyền.
- GPS dùng để tính điểm rủi ro, không phải điều kiện từ chối tuyệt đối.
- Dữ liệu GPS gốc phải có thời gian lưu ngắn và bị giới hạn quyền truy cập.
- Quyền camera/photo library chỉ được hỏi khi người dùng chủ động chọn/chụp hóa đơn.
- Quyền notification nếu triển khai phải được hỏi sau khi người dùng hiểu giá trị nhận thông báo, không hỏi ngay khi mở app nếu không cần.

---

## 6. Chia sẻ dữ liệu

TrustBite không bán hoặc chia sẻ dữ liệu hóa đơn, số điện thoại, GPS cho chủ quán hoặc bên quảng cáo. Chủ quán chỉ được xem thông tin cần thiết để phản hồi/quản lý quán, không được xem ảnh hóa đơn gốc của người dùng.

---

## 7. Quyền của người dùng

Người dùng có quyền:

- yêu cầu xem dữ liệu cá nhân,
- yêu cầu xóa tài khoản,
- yêu cầu xóa hoặc ẩn đánh giá,
- từ chối GPS,
- khiếu nại quyết định kiểm duyệt/xác minh nếu có quy trình hỗ trợ.

Một số bản ghi audit hoặc bảo mật có thể được giữ lại theo chính sách lưu giữ dữ liệu để chống gian lận hoặc đáp ứng nghĩa vụ pháp lý.

### 7.1. Luồng xóa tài khoản và dữ liệu

- Mobile app phải có mục **Xóa tài khoản** trong Account Settings cho mọi người dùng đã đăng nhập.
- TrustBite phải có web link/form công khai để người dùng yêu cầu xóa tài khoản/dữ liệu ngoài app.
- Sau khi người dùng xác nhận, hệ thống tạo `account_deletion_request`, revoke session theo quy trình, và xóa hoặc ẩn danh hóa PII theo `Data_Retention_Policy.md`.
- Nội dung review có thể bị xóa, ẩn hoặc ẩn danh hóa theo lựa chọn sản phẩm/pháp lý; dữ liệu chống gian lận, audit và nghĩa vụ pháp lý chỉ giữ tối thiểu, có thời hạn và giới hạn truy cập.
- CS/Ops không được yêu cầu người dùng gửi OTP, token, hóa đơn gốc hoặc giấy tờ nhạy cảm qua kênh không an toàn để xác minh yêu cầu xóa.

---

## 8. Consent copy tối thiểu cho MVP

Các nội dung dưới đây là bản chuẩn nội bộ để UX/mobile dùng khi viết copy. Trước public release cần Legal rà soát ngôn ngữ cuối cùng.

### 8.1. Hóa đơn

```text
TrustBite dùng ảnh hóa đơn để kiểm tra đánh giá có dựa trên trải nghiệm thật hay không. Ảnh gốc được lưu riêng tư và không hiển thị công khai trực tiếp. Nếu cần hiển thị bằng chứng, hệ thống chỉ dùng bản đã che thông tin nhạy cảm.
```

### 8.2. GPS tùy chọn

```text
Bạn có thể chia sẻ vị trí hiện tại để tăng tín hiệu xác minh. Đây là lựa chọn tùy ý. Nếu bạn từ chối, đánh giá/hóa đơn vẫn được xử lý bằng các tín hiệu khác.
```

### 8.3. OCR provider

```text
TrustBite có thể dùng nhà cung cấp OCR để đọc thông tin cần thiết trên hóa đơn, như tên quán và thời gian. Dữ liệu này chỉ dùng cho xác minh và chống gian lận theo chính sách lưu giữ dữ liệu.
```

### 8.4. Xóa dữ liệu/tài khoản

```text
Bạn có thể yêu cầu xóa tài khoản hoặc dữ liệu cá nhân. Một số bản ghi audit, bảo mật hoặc chống gian lận có thể được giữ lại trong thời gian giới hạn nếu cần cho nghĩa vụ pháp lý hoặc bảo vệ hệ thống.
```

---

## 9. Yêu cầu trước public beta

- Có bản Privacy Policy công khai, dễ đọc cho người dùng cuối.
- Có Terms of Service hoặc Điều khoản sử dụng.
- Có đường dẫn/form yêu cầu xóa tài khoản và dữ liệu.
- OCR/SMS/analytics/crash provider phải được rà soát vendor/privacy.
- Store metadata phải khai báo số điện thoại, ảnh hóa đơn, GPS tùy chọn, analytics/crash nếu dùng.
- Mobile/admin không log OTP, token, GPS gốc, OCR text đầy đủ hoặc số điện thoại đầy đủ.


## 10. Mapping khai báo store

Trước khi submit App Store/Google Play, Release Manager phải đối chiếu chính sách này với `Store_Privacy_Data_Safety_Mapping.md` và hành vi thực tế của app/SDK.

Các nhóm dữ liệu tối thiểu cần rà soát:

- Contact info: số điện thoại OTP.
- User content: review, media review nếu bật.
- Photos/files: ảnh hóa đơn và bản đã che dữ liệu.
- Location: GPS một lần, tùy chọn, không tracking liên tục.
- Identifiers/session: user ID, session ID, push token hash nếu bật.
- Diagnostics/analytics: crash log, performance, event analytics nếu tích hợp SDK.
- Security/fraud signals: IP hash, device fingerprint hash, fraud flags.

Không được khai báo “không thu thập dữ liệu” nếu bất kỳ nhóm trên đang được app hoặc SDK bên thứ ba xử lý.
