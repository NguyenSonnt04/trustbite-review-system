# Hướng dẫn hỗ trợ khách hàng - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Customer support guide |
| Phiên bản | v1.1.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Ops Lead / Customer Support Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Giúp đội CS/Ops xử lý nhất quán các vấn đề thường gặp của người dùng, chủ quán và admin trong giai đoạn beta/MVP mà không làm lộ dữ liệu nhạy cảm.

---

## 2. Nguyên tắc hỗ trợ

- Không yêu cầu người dùng gửi OTP, token hoặc ảnh hóa đơn gốc qua kênh chat/email không an toàn.
- Không cung cấp GPS gốc, OCR text đầy đủ hoặc thông tin hóa đơn nhạy cảm cho bên không có quyền.
- Không hứa admin sẽ duyệt review/receipt nếu không đủ điều kiện.
- Mọi thay đổi trạng thái bởi admin phải có reason và audit log.
- Vấn đề privacy/security phải escalate ngay theo `Monitoring_and_Incident_Runbook.md`.

---

## 3. Các tình huống thường gặp

### 3.1. Người dùng không nhận được OTP

1. Hỏi người dùng kiểm tra số điện thoại đã nhập và mạng/SMS inbox.
2. Kiểm tra có bị rate limit không nếu CS có công cụ admin phù hợp.
3. Kiểm tra dashboard OTP provider nếu có nhiều người cùng báo lỗi.
4. Nếu nghi provider lỗi, escalate Backend/Ops theo runbook OTP.

Phản hồi mẫu:

```text
Bạn vui lòng kiểm tra lại số điện thoại và thử yêu cầu mã mới sau ít phút. Nếu vẫn không nhận được, TrustBite sẽ kiểm tra tình trạng gửi OTP từ hệ thống.
```

### 3.2. Upload hóa đơn thất bại

1. Xác nhận file thuộc JPG/PNG/HEIC và không vượt 10MB.
2. Hỏi user thử lại khi mạng ổn định.
3. Không yêu cầu gửi ảnh hóa đơn gốc qua chat/email công khai.
4. Nếu lỗi hàng loạt, escalate Engineering/Ops.

### 3.3. Hóa đơn đang xử lý quá lâu

1. Kiểm tra trạng thái receipt nếu có quyền.
2. Nếu đang `PENDING_ADMIN_REVIEW`, thông báo cần quản trị viên xem xét.
3. Nếu queue quá SLA, escalate Ops Lead.

Phản hồi mẫu:

```text
Hóa đơn của bạn đang được kiểm tra thêm để đảm bảo kết quả xác minh chính xác. TrustBite sẽ cập nhật trạng thái trong ứng dụng khi có kết quả.
```

### 3.4. Review thành `Tham khảo`

Giải thích:

```text
Đánh giá được hiển thị ở dạng Tham khảo khi chưa có đủ bằng chứng xác minh, hoặc người dùng chọn bỏ qua xác minh hóa đơn. Đánh giá vẫn có thể hiển thị nếu không vi phạm chính sách nội dung.
```

### 3.5. Chủ quán muốn phản hồi hoặc báo cáo review

1. Xác nhận chủ quán có claim/quyền phù hợp nếu feature bật.
2. Hướng dẫn dùng chức năng report/claim hoặc quy trình manual beta.
3. Không cam kết xóa review nếu review không vi phạm chính sách.
4. Escalate review có tranh chấp nghiêm trọng cho Ops/Admin.

### 3.6. Yêu cầu xóa tài khoản/dữ liệu

1. Ưu tiên hướng dẫn người dùng vào Account Settings > Xóa tài khoản hoặc dùng web deletion link công khai.
2. Không yêu cầu OTP, token, ảnh hóa đơn gốc hoặc giấy tờ nhạy cảm qua chat/email thường.
3. Nếu người dùng không truy cập được app, tạo ticket privacy/data request và xác minh theo quy trình đã được Legal phê duyệt.
4. Ghi rõ ngày nhận, kênh nhận, user ID/phone mask nếu có, trạng thái xử lý và lý do giữ dữ liệu nếu có legal hold/fraud dispute.
5. Sau khi hoàn tất, gửi phản hồi không nêu dữ liệu nội bộ nhạy cảm.

Phản hồi mẫu:

```text
TrustBite đã ghi nhận yêu cầu xóa tài khoản/dữ liệu của bạn. Chúng tôi sẽ xử lý theo chính sách lưu giữ dữ liệu; một số bản ghi audit, bảo mật hoặc chống gian lận có thể được giữ lại trong thời gian giới hạn nếu cần bảo vệ hệ thống hoặc tuân thủ pháp luật.
```

### 3.7. Báo cáo nội dung nguy hại hoặc chặn người dùng

1. Hướng dẫn người dùng dùng nút Báo cáo trong app nếu nội dung còn hiển thị.
2. Nếu nội dung liên quan đe dọa an toàn, quấy rối hoặc lộ thông tin cá nhân, escalate Ops/Admin ngay.
3. Hướng dẫn người dùng chặn tác giả review/người dùng vi phạm nếu feature khả dụng.
4. Không chia sẻ danh tính người báo cáo cho người bị báo cáo.

Phản hồi mẫu:

```text
Cảm ơn bạn đã báo cáo. TrustBite sẽ xem xét nội dung theo chính sách cộng đồng. Nếu bạn cảm thấy không an toàn khi tương tác, bạn có thể dùng chức năng chặn người dùng trong ứng dụng.
```

---

## 4. Escalation matrix

| Tình huống | Escalate tới | SLA beta |
|---|---|---:|
| OTP lỗi hàng loạt | Backend + Ops | 15 phút |
| Upload receipt lỗi hàng loạt | Backend + Mobile + Ops | 30 phút |
| Nghi lộ dữ liệu hóa đơn/GPS/token | Security + Engineering Lead + PO | Ngay lập tức |
| Admin queue quá SLA | Ops Lead + PO | 4 giờ làm việc |
| App crash nhiều | Mobile Lead + QA | 1 giờ |
| Chủ quán tranh chấp nghiêm trọng | Ops Lead + PO/Legal nếu cần | 1 ngày làm việc |

---

## 5. Thông tin không được đưa vào phản hồi khách hàng

- Internal risk score chi tiết nếu chưa được product/legal duyệt.
- Hash hóa đơn, OCR raw text, GPS raw coordinate.
- Lý do bảo mật nội bộ có thể giúp gian lận vượt kiểm tra.
- Thông tin người dùng khác, hóa đơn của người khác hoặc audit log nội bộ.

---

## 6. Liên kết tài liệu liên quan

- `08_Compliance_and_Privacy/Privacy_Policy.md`
- `08_Compliance_and_Privacy/Data_Retention_Policy.md`
- `08_Compliance_and_Privacy/Content_Moderation_Policy.md`
- `09_Operations_and_Maintenance/Monitoring_and_Incident_Runbook.md`
- `09_Operations_and_Maintenance/Mobile_Release_Checklist.md`
