# Kế hoạch kiểm thử hệ thống - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Kế hoạch kiểm thử |
| Phiên bản | v1.1.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Trưởng nhóm QA |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu kiểm thử

Đảm bảo MVP TrustBite vận hành đúng các luồng cốt lõi: đăng nhập OTP, tìm kiếm quán, gửi đánh giá, tải hóa đơn, xác minh bằng OCR, chấm điểm rủi ro gian lận, quản trị viên duyệt thủ công, kiểm duyệt nội dung và xử lý quyền riêng tư.

---

## 2. Phạm vi kiểm thử MVP

| Nhóm kiểm thử | Nội dung |
|---|---|
| Xác thực | OTP đúng/sai/hết hạn/quá số lần gửi/quá số lần nhập sai |
| Quán | Danh sách, tìm kiếm, bộ lọc, bản đồ, trang chi tiết |
| Đánh giá | Điểm hợp lệ/không hợp lệ, bình luận thiếu, người dùng bị khóa, chủ quán tự đánh giá quán mình |
| Hóa đơn/OCR | File hợp lệ, sai định dạng, quá dung lượng, hóa đơn rõ/mờ/sai quán/quá hạn |
| GPS | Trong bán kính, ngoài bán kính, không cấp quyền, độ chính xác thấp |
| Chống gian lận | Hóa đơn trùng, OCR không khớp, ngưỡng điểm rủi ro, cờ gian lận |
| Chủ quán | MVP chỉ kiểm thử claim tối thiểu/manual nếu feature flag bật; portal đầy đủ P1 |
| Quản trị viên | Dashboard, receipt queue, case detail, duyệt/từ chối/mark reference, moderation queue, claim tối thiểu, audit log |
| Kiểm duyệt | Người dùng báo cáo, chủ quán báo cáo, quản trị viên xử lý, ẩn đánh giá |
| Quyền riêng tư | Xóa tài khoản, xóa/ẩn ảnh hóa đơn, che dữ liệu nhạy cảm |
| Mobile app | iOS/Android auth, search, review, receipt upload, GPS permission, network weak, secure storage |
| Thông báo | MVP không bắt buộc notification; kiểm thử polling/refetch trạng thái. Notification test là P1 nếu feature flag bật. |
| Hiệu năng | Tìm kiếm, tải bản đồ, tải hóa đơn, hàng đợi OCR, mobile crash/error rate |

---

## 3. Cấp độ kiểm thử

| Cấp độ | Mục tiêu |
|---|---|
| Kiểm thử đơn vị | Kiểm tra hàm/dịch vụ: OTP, điểm rủi ro, Haversine, Levenshtein, chuyển trạng thái. |
| Kiểm thử tích hợp | Kiểm tra API, DB, hàng đợi, OCR mock và lưu trữ. |
| Kiểm thử E2E | Kiểm tra luồng hoàn chỉnh từ đăng nhập đến đánh giá đã xác minh. |
| UAT | Nghiệm thu nghiệp vụ bởi PO, BA và vận hành quản trị. |
| Kiểm thử hồi quy | Đảm bảo thay đổi mới không phá các luồng lõi. |
| Kiểm thử bảo mật | Kiểm tra giới hạn tần suất, upload, phân quyền và audit log. |

---

## 4. Điều kiện bắt đầu

- PRD, Functional Spec, SRS và API Specification đã có bản rà soát.
- Môi trường kiểm thử sẵn sàng.
- Có tài khoản kiểm thử cho người dùng, chủ quán, quản trị viên và siêu quản trị.
- Có mock OCR hoặc bộ ảnh hóa đơn kiểm thử.
- Có dữ liệu seed cho quán và trạng thái theo `06_Database_Design/Migration_and_Seed_Plan.md`.
- OpenAPI P0 baseline đã được review và contract test cơ bản chạy được.
- Quy trình ghi nhận lỗi dùng `Bug_Report_Template.md` để thống nhất severity/priority và dữ liệu evidence được masking.

---

## 5. Điều kiện kết thúc

- 100% test case P0 đạt.
- Không còn lỗi blocker hoặc critical.
- Ít nhất 95% test case P1 đạt hoặc có waiver từ PO.
- Các case bắt buộc về audit log của quản trị viên đạt.
- Contract test xác nhận API không trả enum ngoài `Status_Mapping.md`/`openapi.yaml`.
- Kiểm thử idempotency upload hóa đơn đạt theo `Idempotency_and_Retry_Design.md`.
- Kiểm thử bảo mật tải file và giới hạn tần suất đạt.
- UAT sign-off cho các luồng MVP cốt lõi.
- Tất cả bug blocker/critical đã đóng hoặc có waiver rõ ràng từ PO/Engineering/QA nếu không chặn beta.

---

## 6. Kịch bản kiểm thử P0

### AUTH-TC-001: OTP đúng

- Bối cảnh: người dùng nhập số điện thoại hợp lệ.
- Khi: người dùng nhập OTP đúng còn hạn.
- Kết quả: người dùng đăng nhập thành công và nhận session/token.

### AUTH-TC-002: OTP hết hạn

- Bối cảnh: OTP đã quá 120 giây.
- Khi: người dùng gửi OTP.
- Kết quả: hệ thống từ chối và yêu cầu gửi OTP mới.

### AUTH-TC-003: OTP vượt giới hạn tần suất

- Bối cảnh: người dùng yêu cầu OTP 3 lần trong 10 phút.
- Khi: người dùng yêu cầu lần thứ 4.
- Kết quả: hệ thống trả lỗi vượt giới hạn tần suất.

### REV-TC-001: Gửi đánh giá hợp lệ

- Bối cảnh: người dùng đã đăng nhập và quán ở trạng thái ACTIVE.
- Khi: người dùng gửi điểm 4 tiêu chí và bình luận tối thiểu 50 ký tự.
- Kết quả: đánh giá được tạo ở trạng thái SUBMITTED.

### REV-TC-002: Bình luận quá ngắn

- Bối cảnh: người dùng đã đăng nhập.
- Khi: người dùng gửi bình luận dưới 50 ký tự.
- Kết quả: hệ thống trả lỗi validate.

### REV-TC-003: Người dùng bỏ qua xác minh hóa đơn

- Bối cảnh: review hợp lệ đang ở trạng thái SUBMITTED.
- Khi: người dùng chọn bỏ qua upload hóa đơn.
- Kết quả: review chuyển REFERENCE_ONLY và mobile hiển thị nhãn tham khảo.

### REV-TC-004: Review quá hạn upload hóa đơn

- Bối cảnh: review SUBMITTED không có receipt sau 24 giờ.
- Khi: job backend chạy.
- Kết quả: review chuyển REFERENCE_ONLY; không tạo fraud flag.

### OCR-TC-001: Hóa đơn hợp lệ tự động xác minh

- Bối cảnh: hóa đơn đúng định dạng, không trùng hash, OCR khớp tên quán từ 80%, thời gian trong 48 giờ và GPS trong 200m nếu có.
- Khi: job OCR hoàn tất.
- Kết quả: hóa đơn VERIFIED và đánh giá VERIFIED.

### OCR-TC-002: Hóa đơn trùng hash

- Bối cảnh: hash hóa đơn đã tồn tại.
- Khi: người dùng tải cùng ảnh lên.
- Kết quả: hóa đơn REJECTED, đánh giá không được xác minh và cờ gian lận được tạo.

### OCR-TC-003: OCR không khớp mức trung bình

- Bối cảnh: độ tương đồng tên quán từ OCR là 60-79%.
- Khi: điểm rủi ro được tính xong.
- Kết quả: case chuyển PENDING_ADMIN_REVIEW nếu tổng rủi ro nằm trong ngưỡng 31-60.

### OCR-TC-004: Idempotency upload hóa đơn

- Bối cảnh: mobile upload receipt thành công nhưng mất mạng trước khi nhận response.
- Khi: mobile retry cùng `Idempotency-Key` và cùng payload.
- Kết quả: API trả receiptVerificationId cũ, không tạo bản ghi receipt trùng.

### OCR-TC-005: Idempotency conflict

- Bối cảnh: một `Idempotency-Key` đã dùng cho receipt upload.
- Khi: mobile gửi lại cùng key nhưng payload khác.
- Kết quả: API trả `409 IDEMPOTENCY_CONFLICT`.

### GPS-TC-001: Không cấp GPS

- Bối cảnh: người dùng từ chối GPS.
- Khi: người dùng tải hóa đơn hợp lệ.
- Kết quả: hệ thống không tự động từ chối, chỉ cộng điểm rủi ro theo rule.

### ADM-TC-001: Quản trị viên duyệt hóa đơn chờ xử lý

- Bối cảnh: hóa đơn đang ở trạng thái PENDING_ADMIN_REVIEW.
- Khi: quản trị viên duyệt với lý do.
- Kết quả: hóa đơn VERIFIED, đánh giá VERIFIED và audit log được ghi.

### ADM-TC-002: Quản trị viên từ chối hóa đơn chờ xử lý

- Bối cảnh: hóa đơn đang ở trạng thái PENDING_ADMIN_REVIEW.
- Khi: quản trị viên từ chối với lý do.
- Kết quả: hóa đơn REJECTED, đánh giá chuyển REFERENCE_ONLY hoặc REJECTED theo quyết định và audit log được ghi.

### ADM-TC-003: Quản trị viên thiếu reason

- Bối cảnh: case đang ở trạng thái PENDING_ADMIN_REVIEW.
- Khi: quản trị viên gửi quyết định không có reason.
- Kết quả: API trả `ADMIN_REASON_REQUIRED`; trạng thái không đổi; không ghi audit decision thành công.

### ADM-TC-004: Receipt queue và case detail

- Bối cảnh: có nhiều receipt case với risk/status khác nhau.
- Khi: quản trị viên lọc theo status/risk và mở case detail.
- Kết quả: queue trả đúng dữ liệu; case detail hiển thị review summary, receipt evidence, OCR, GPS, risk breakdown và audit history; dữ liệu nhạy cảm được masked.

### ADM-TC-005: Case đã đóng không xử lý lại

- Bối cảnh: receipt case đã VERIFIED/REJECTED bởi admin.
- Khi: admin thường gửi decision lần nữa.
- Kết quả: API từ chối; chỉ super admin override theo rule mới được phép.

### MOD-TC-001: Người dùng báo cáo đánh giá

- Bối cảnh: đánh giá đang hiển thị.
- Khi: người dùng gửi báo cáo hợp lệ.
- Kết quả: báo cáo ở trạng thái SUBMITTED và xuất hiện trong hàng đợi quản trị.

### PRIV-TC-001: Che dữ liệu hóa đơn công khai

- Bối cảnh: ảnh hóa đơn có dữ liệu nhạy cảm.
- Khi: hệ thống hiển thị bằng chứng công khai nếu có.
- Kết quả: dữ liệu nhạy cảm phải được che hoặc ảnh gốc không được hiển thị công khai.

---

## 7. Kịch bản kiểm thử P1

| ID | Kịch bản | Kết quả mong đợi |
|---|---|---|
| MERCH-TC-001 | Chủ quán/admin gửi claim quán đủ giấy tờ nếu feature flag bật | Claim chuyển SUBMITTED/PENDING_ADMIN_REVIEW |
| MERCH-TC-002 | Chủ quán/admin claim quán đã có owner | Hệ thống báo xung đột hoặc chuyển sang tranh chấp chờ xử lý |
| MERCH-TC-003 | Chủ quán phản hồi đánh giá qua portal P1 | Phản hồi hiển thị nếu chủ quán đã được xác minh |
| NOTIF-TC-001 | Quản trị viên xử lý báo cáo khi notification flag bật | Người báo cáo nhận thông báo, payload không chứa dữ liệu nhạy cảm |
| VOTE-TC-001 | Người dùng bình chọn hữu ích | Bình chọn được lưu và không bị trùng |
| FAV-TC-001 | Người dùng lưu quán yêu thích | Quán yêu thích được lưu và danh sách yêu thích cập nhật |

---

## 8. Mục tiêu kiểm thử hiệu năng MVP

| Trường hợp | Mục tiêu |
|---|---|
| Tìm kiếm quán với dataset MVP | p95 < 1s |
| Trang chi tiết quán | p95 < 1s |
| Request tải hóa đơn | p95 < 3s, OCR xử lý bất đồng bộ |
| Xử lý hàng đợi OCR | Theo SLA của nhà cung cấp, phải retry khi timeout |
| Danh sách hàng đợi quản trị | p95 < 1.5s |
| Refetch trạng thái receipt/review | p95 < 1s với dataset MVP |

---

## 9. Yêu cầu dữ liệu kiểm thử

- Người dùng thường, người dùng bị khóa, FOODGOD mock, chủ quán, quản trị viên, siêu quản trị.
- Quán ở các trạng thái DRAFT/PENDING/ACTIVE/SUSPENDED/CLOSED.
- Hóa đơn rõ, mờ, sai quán, quá hạn, trùng hash, sai định dạng, lớn hơn 10MB.
- GPS trong 100m, 300m, 1km, không có GPS, độ chính xác thấp.
- Đánh giá ở các trạng thái VERIFIED/REFERENCE_ONLY/PENDING_ADMIN_REVIEW/HIDDEN/DELETED.
- Device matrix và mobile permission cases theo `Mobile_Test_Plan.md` và `Device_Test_Matrix.md`.
- Idempotency keys hợp lệ/trùng/conflict/request in progress/expired.
- Admin cases ở trạng thái open/closed/overdue, có/không OCR, có/không GPS, signed URL hết hạn.
- Test fixture bao phủ mọi dòng P0 trong `00_Document_Control/Traceability_Matrix.md` và `02_Business_Analysis/Status_Mapping.md`.

---

## 10. Mức độ nghiêm trọng của lỗi

| Mức độ | Định nghĩa |
|---|---|
| Blocker | Không thể hoàn tất luồng P0 hoặc mất dữ liệu. |
| Critical | Sai quyết định xác minh/gian lận nghiêm trọng, lỗi bảo mật hoặc lộ dữ liệu nhạy cảm. |
| Major | Hỏng chức năng P1 hoặc workaround khó. |
| Minor | Lỗi UI/copy/edge case ít ảnh hưởng. |
| Trivial | Chính tả, định dạng hoặc cosmetic. |
