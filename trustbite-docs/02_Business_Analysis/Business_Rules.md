# Quy tắc nghiệp vụ - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Quy tắc nghiệp vụ |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | BA |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Quy tắc xác thực

| ID | Quy tắc | Mức ưu tiên |
|---|---|---|
| BR-AUTH-001 | OTP gồm 6 chữ số và hết hạn sau 120 giây. | P0 |
| BR-AUTH-002 | Tối đa 3 lần gửi OTP trong 10 phút cho cùng số điện thoại. | P0 |
| BR-AUTH-003 | Tối đa 5 lần nhập sai OTP trước khi khóa tạm thời (Khóa 15 phút cho lần đầu, 24 giờ nếu tiếp tục vi phạm trong ngày). | P0 |

## 2. Quy tắc quán

| ID | Quy tắc | Mức ưu tiên |
|---|---|---|
| BR-REST-001 | Chỉ restaurant ACTIVE được hiển thị công khai. | P0 |
| BR-REST-002 | Chủ quán chỉ chỉnh được quán có claim APPROVED. | P1 |
| BR-REST-003 | Quán bị SUSPENDED không nhận đánh giá mới. | P0 |

## 3. Quy tắc đánh giá

| ID | Quy tắc | Mức ưu tiên |
|---|---|---|
| BR-REV-001 | Rating mỗi tiêu chí từ 1 đến 5. | P0 |
| BR-REV-002 | Comment tối thiểu 30 ký tự cho đánh giá thông thường (Reference) và 50 ký tự cho đánh giá muốn xác minh (Verified). | P0 |
| BR-REV-003 | Người dùng bị restricted không được viết review. | P0 |
| BR-REV-004 | Chủ quán không được đánh giá quán của mình. | P0 |
| BR-REV-005 | Đánh giá HIDDEN/DELETED không hiển thị công khai và không tính trust score. | P0 |
| BR-REV-006 | Người dùng có thể bỏ qua xác minh hóa đơn; review chuyển REFERENCE_ONLY. | P0 |
| BR-REV-007 | Review SUBMITTED không có receipt sau 24 giờ tự chuyển REFERENCE_ONLY bởi job backend. | P0 |
| BR-REV-008 | Review REFERENCE_ONLY được hiển thị nếu không vi phạm kiểm duyệt nhưng có trọng số thấp hơn VERIFIED. | P0 |

## 4. Quy tắc hóa đơn

| ID | Quy tắc | Mức ưu tiên |
|---|---|---|
| BR-OCR-001 | Hóa đơn file chỉ nhận JPG, PNG, HEIC. | P0 |
| BR-OCR-002 | File tối đa 10MB. | P0 |
| BR-OCR-003 | Trùng SHA-256 hash của ảnh HOẶC trùng thông tin giao dịch (Composite Transaction Hash) bị tự động từ chối và ghi cờ gian lận. | P0 |
| BR-OCR-004 | OCR/GPS dùng risk scoring, không dùng rule cứng ngoại trừ duplicate hash. | P0 |
| BR-OCR-005 | Hóa đơn nên trong 48 giờ; quá hạn tăng risk. | P0 |
| BR-OCR-006 | MVP dùng multipart upload qua API; signed upload thuộc P1 khi cần scale. | P0 |
| BR-OCR-007 | Mutation upload hóa đơn bắt buộc hỗ trợ `Idempotency-Key` để xử lý mobile retry. | P0 |
| BR-OCR-008 | Backend validate file type/size, không tin kết quả kiểm tra từ mobile client. | P0 |

## 5. Quy tắc gian lận

| ID | Quy tắc | Mức ưu tiên |
|---|---|---|
| BR-FRAUD-001 | Risk score 0-30 auto verified. | P0 |
| BR-FRAUD-002 | Điểm rủi ro 31-60 chuyển quản trị viên xử lý. | P0 |
| BR-FRAUD-003 | Risk score 61-99 reference only. | P0 |
| BR-FRAUD-004 | Risk score >=100 rejected/fraud flag. | P0 |

## 6. Quy tắc quản trị viên

| ID | Quy tắc | Mức ưu tiên |
|---|---|---|
| BR-ADM-001 | Mọi quyết định của quản trị viên bắt buộc có lý do. | P0 |
| BR-ADM-002 | Mọi quyết định của quản trị viên phải ghi audit log. | P0 |
| BR-ADM-003 | Trường hợp closed không được xử lý lại trừ khi Siêu quản trị override. | P1 |
| BR-ADM-004 | Admin portal là bắt buộc trong MVP cho receipt/moderation queue; merchant portal đầy đủ không chặn MVP. | P0 |
| BR-ADM-005 | Mọi quyết định admin phải cập nhật trạng thái entity liên quan theo bảng mapping trong State Machines. | P0 |

## 7. Quy tắc quyền riêng tư

| ID | Quy tắc | Mức ưu tiên |
|---|---|---|
| BR-PRIV-001 | GPS là optional. | P0 |
| BR-PRIV-002 | Hóa đơn ảnh gốc lưu private, không public trực tiếp. | P0 |
| BR-PRIV-003 | Dữ liệu nhạy cảm trên hóa đơn phải được che nếu hiển thị. | P0 |
| BR-PRIV-004 | Retention tuân thủ Data Retention Policy. | P0 |
| BR-PRIV-005 | Người dùng đã tạo tài khoản phải có luồng yêu cầu xóa tài khoản trong app trước public beta. | P0 |
| BR-PRIV-006 | TrustBite phải có web link/form công khai để người dùng yêu cầu xóa tài khoản/dữ liệu ngoài app. | P0 |
| BR-PRIV-007 | Khi yêu cầu xóa tài khoản được chấp nhận, backend phải revoke session, xóa hoặc ẩn danh hóa PII theo retention; audit/fraud/legal hold chỉ giữ tối thiểu và có lý do. | P0 |


## 8. Quy tắc notification và refetch

| ID | Quy tắc | Mức ưu tiên |
|---|---|---|
| BR-NOTIF-001 | Notification là P1; không chặn MVP nếu chưa bật feature flag. | P1 |
| BR-NOTIF-002 | MVP phải có polling/refetch trạng thái receipt/review khi người dùng mở màn hình kết quả hoặc app quay lại foreground. | P0 |
| BR-NOTIF-003 | Notification nếu bật không được chứa OTP, token, ảnh hóa đơn, OCR text đầy đủ, GPS gốc hoặc số điện thoại đầy đủ. | P0 |

## 9. Quy tắc rate limit MVP

| ID | Đối tượng | Giới hạn MVP đề xuất | Mức ưu tiên |
|---|---|---:|---|
| BR-RATE-001 | OTP request theo phone number | 3 lần / 10 phút | P0 |
| BR-RATE-002 | OTP verify failed theo request/phone | 5 lần trước khóa tạm | P0 |
| BR-RATE-003 | Tạo review theo user | 10 lần / ngày, có thể điều chỉnh sau beta | P0 |
| BR-RATE-004 | Upload receipt theo user | 20 lần / ngày, giới hạn thấp hơn nếu có fraud flag mở | P0 |
| BR-RATE-005 | Report review theo user | 30 lần / ngày và không trùng report mở cùng review/lý do | P0 |
| BR-RATE-006 | Admin decision | Không rate limit nghiệp vụ, nhưng phải audit và chống CSRF/session abuse theo triển khai web | P0 |


## 10. Quy tắc an toàn UGC và store readiness

| ID | Quy tắc | Mức ưu tiên |
|---|---|---|
| BR-SAFE-001 | Review/user-generated content phải có lọc nội dung tối thiểu trước khi hiển thị hoặc đưa vào hàng đợi kiểm duyệt nếu nghi ngờ vi phạm. | P0 |
| BR-SAFE-002 | Người dùng và chủ quán có quyền báo cáo review/người dùng vi phạm từ bề mặt nội dung liên quan. | P0 |
| BR-SAFE-003 | Người dùng phải có cách chặn hoặc hạn chế tương tác từ người dùng lạm dụng trong phạm vi tính năng cộng đồng của TrustBite. | P0 |
| BR-SAFE-004 | App phải hiển thị hoặc liên kết rõ ràng tới kênh liên hệ support/privacy cho vấn đề nội dung, tài khoản và an toàn. | P0 |
| BR-STORE-001 | Trước khi submit store, Release Manager phải hoàn tất mapping App Privacy/Data Safety, content rating, age rating, permission declaration và reviewer notes. | P0 |
| BR-STORE-002 | Reviewer phải có tài khoản demo, dữ liệu seed hoặc hướng dẫn truy cập đủ để kiểm tra OTP, review, receipt, report/block và xóa tài khoản. | P0 |
| BR-STORE-003 | Không được submit nếu store metadata nói khác với Privacy Policy, Data Retention Policy hoặc hành vi thực tế của app/SDK. | P0 |
