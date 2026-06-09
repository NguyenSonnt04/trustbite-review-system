# Quy chuẩn UX writing - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | UX writing / content guideline |
| Phiên bản | v1.1.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | UX Lead / Product Manager |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Chuẩn hóa cách viết nội dung trong mobile app và admin portal để người dùng hiểu rõ trạng thái tin cậy, quyền riêng tư, lỗi upload/OCR/GPS và hành động tiếp theo.

---

## 2. Nguyên tắc giọng điệu

- Rõ ràng, trực tiếp, không đổ lỗi cho người dùng.
- Không hứa quá mức về độ chính xác OCR/risk scoring.
- Nhấn mạnh GPS là tùy chọn.
- Giải thích dữ liệu hóa đơn được bảo vệ riêng tư.
- Lỗi phải nói được người dùng cần làm gì tiếp theo.
- Admin copy phải ngắn, đủ bằng chứng, luôn nhắc nhập lý do khi ra quyết định.

---

## 3. Thuật ngữ chuẩn

| Thuật ngữ | Cách dùng |
|---|---|
| Đã xác minh | Review/receipt có bằng chứng đạt điều kiện xác minh |
| Tham khảo | Review không có hoặc không đủ bằng chứng xác minh, vẫn có thể hiển thị nếu không vi phạm |
| Đang xử lý | OCR/risk/admin queue chưa có kết quả cuối |
| Cần quản trị viên xem xét | Case cần quyết định thủ công |
| Bị từ chối | Receipt/review không đạt điều kiện hoặc vi phạm rule |
| GPS tùy chọn | Dữ liệu vị trí người dùng có thể cấp hoặc từ chối |

Không dùng các từ mơ hồ như `lỗi hệ thống`, `không hợp lệ`, `thất bại` nếu không có hướng dẫn hành động tiếp theo.

---

## 4. Mẫu thông báo lỗi

| Tình huống | Không nên | Nên dùng |
|---|---|---|
| Mất mạng | Error | Không thể tải dữ liệu. Vui lòng kiểm tra kết nối mạng và thử lại. |
| OTP sai | OTP invalid | Mã OTP chưa đúng. Vui lòng kiểm tra và nhập lại. |
| OTP hết hạn | Expired | Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới. |
| Upload quá dung lượng | File too large | Ảnh hóa đơn vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn. |
| Sai định dạng | Unsupported file | TrustBite chỉ hỗ trợ JPG, PNG hoặc HEIC cho hóa đơn. |
| GPS bị từ chối | GPS required | Bạn có thể tiếp tục mà không cần GPS. Hệ thống vẫn xử lý hóa đơn bằng các tín hiệu khác. |
| OCR pending | Processing | Hóa đơn đang được xử lý. Bạn có thể quay lại xem kết quả sau. |
| Duplicate receipt | Duplicate | Hóa đơn này đã được sử dụng trước đó nên không thể xác minh lại. |
| Yêu cầu xóa tài khoản | Delete account | Bạn có thể yêu cầu xóa tài khoản. TrustBite sẽ xóa hoặc ẩn danh hóa dữ liệu cá nhân theo chính sách lưu giữ dữ liệu. |
| Báo cáo vi phạm | Report failed | Chưa thể gửi báo cáo. Vui lòng thử lại hoặc liên hệ hỗ trợ nếu nội dung gây hại nghiêm trọng. |
| Chặn người dùng | Block failed | Chưa thể chặn người dùng này. Vui lòng thử lại. |

---

## 5. Copy quyền riêng tư cho hóa đơn/GPS

### 5.1. Trước khi upload hóa đơn

```text
TrustBite dùng hóa đơn để kiểm tra đánh giá có đến từ trải nghiệm thật. Ảnh hóa đơn gốc được lưu riêng tư và không hiển thị công khai.
```

### 5.2. Trước khi xin GPS

```text
Cho phép vị trí giúp tăng tín hiệu xác minh quán bạn đã ghé. Đây là tùy chọn; nếu bạn từ chối, hóa đơn vẫn được xử lý.
```

### 5.3. Khi review là tham khảo

```text
Đánh giá này được hiển thị ở dạng tham khảo vì chưa có đủ bằng chứng xác minh.
```

### 5.4. Xóa tài khoản

```text
Yêu cầu xóa tài khoản sẽ đăng xuất bạn khỏi TrustBite và xóa hoặc ẩn danh hóa dữ liệu cá nhân theo chính sách lưu giữ dữ liệu. Một số bản ghi audit, bảo mật hoặc chống gian lận có thể được giữ lại trong thời gian giới hạn nếu cần bảo vệ hệ thống hoặc tuân thủ pháp luật.
```

### 5.5. Báo cáo và chặn người dùng

```text
Cảm ơn bạn đã báo cáo. TrustBite sẽ xem xét nội dung theo chính sách cộng đồng. Bạn cũng có thể chặn người dùng này để hạn chế tương tác trong ứng dụng.
```

---

## 6. Empty state

| Màn hình | Copy đề xuất |
|---|---|
| Chưa có review | Chưa có đánh giá nào. Hãy là người đầu tiên chia sẻ trải nghiệm thật tại quán này. |
| Chưa có receipt pending | Không có hóa đơn nào đang chờ xử lý. |
| Admin queue trống | Không có case cần xử lý trong hàng đợi này. |
| Không có kết quả tìm kiếm | Chưa tìm thấy quán phù hợp. Thử đổi từ khóa hoặc khu vực tìm kiếm. |

---

## 7. Loading và success state

| Tình huống | Copy đề xuất |
|---|---|
| Gửi OTP | Đang gửi mã OTP... |
| Xác thực OTP | Đang xác thực... |
| Upload hóa đơn | Đang tải hóa đơn lên... |
| OCR pending | Đang kiểm tra hóa đơn... |
| Review submitted | Đã gửi đánh giá. Hệ thống đang chờ bằng chứng xác minh nếu có. |
| Receipt verified | Hóa đơn đã được xác minh. Đánh giá của bạn được gắn nhãn Đã xác minh. |

---

## 8. Admin decision copy

Mọi quyết định của admin phải có lý do. UI cần nhắc:

```text
Vui lòng nhập lý do quyết định. Lý do này sẽ được lưu trong audit log.
```

Các reason code/copy hiển thị phải khớp với moderation policy và API error/decision enum.

---

## 9. Checklist trước release copy

- GPS luôn được mô tả là tùy chọn.
- Không công khai ảnh hóa đơn gốc hoặc OCR text nhạy cảm.
- Trạng thái Verified/Reference/Pending/Rejected được giải thích nhất quán.
- Lỗi P0 có hành động tiếp theo rõ ràng.
- Push/SMS/email nếu bật ở P1 không chứa dữ liệu nhạy cảm.

- Luồng xóa tài khoản phải dùng copy rõ hậu quả, có xác nhận chủ động và không gây nhầm lẫn giữa logout và xóa tài khoản.
- Report/block copy phải tránh ngôn ngữ trả đũa; ưu tiên an toàn và quy trình kiểm duyệt minh bạch.
- Store review notes phải dùng ngôn ngữ thống nhất với metadata, Privacy Policy và Data Safety mapping.
