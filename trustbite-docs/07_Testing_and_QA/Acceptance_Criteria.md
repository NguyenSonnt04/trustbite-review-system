# Tiêu chí nghiệm thu - MVP TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Acceptance criteria |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | QA / PO |
| Ngày cập nhật | 2026-06-07 |

---

## Nghiệm thu phát hành MVP

| Nhóm | Tiêu chí |
|---|---|
| Mobile app | Người dùng hoàn tất luồng P0 trên iOS/Android theo device matrix tối thiểu. |
| Xác thực | Người dùng có thể yêu cầu và xác thực OTP; OTP sai, hết hạn hoặc vượt giới hạn đều được xử lý đúng. |
| Quán | Khách/người dùng có thể tìm kiếm và xem quán ACTIVE. |
| Đánh giá | Người dùng đã đăng nhập có thể gửi đánh giá hợp lệ theo 4 tiêu chí; dữ liệu không hợp lệ bị từ chối; bỏ qua/quá hạn upload hóa đơn chuyển REFERENCE_ONLY. |
| Hóa đơn | Người dùng có thể tải hóa đơn hợp lệ bằng multipart upload; file không hợp lệ bị từ chối; hash trùng bị phát hiện; retry cùng Idempotency-Key không tạo bản ghi trùng. |
| Xác minh | Điểm rủi ro ánh xạ đúng sang VERIFIED, PENDING_ADMIN_REVIEW, REFERENCE_ONLY hoặc REJECTED. |
| GPS | GPS là tùy chọn; thiếu GPS không làm hệ thống tự động từ chối. |
| Quản trị viên | Quản trị viên có thể dùng dashboard/queue/case detail để duyệt/từ chối/mark reference hóa đơn, xử lý báo cáo hoặc claim tối thiểu kèm lý do. |
| Audit | Quyết định của quản trị viên tạo audit log. |
| Kiểm duyệt | Người dùng/chủ quán có thể báo cáo đánh giá; quản trị viên có thể xử lý báo cáo. |
| Quyền riêng tư | Ảnh hóa đơn gốc là riêng tư; dữ liệu nhạy cảm trên hóa đơn không hiển thị công khai theo mặc định. |
| QA | 100% test case P0, mobile P0 và admin P0 đạt; không còn lỗi blocker hoặc critical. |

## Ví dụ tiêu chí nghiệm thu tính năng

### REV-001

- Bối cảnh người dùng đã đăng nhập và quán ACTIVE, khi điểm đánh giá từ 1-5 và bình luận tối thiểu 50 ký tự, thì đánh giá được tạo ở trạng thái SUBMITTED.
- Bối cảnh bình luận dưới 50 ký tự, khi gửi, thì hệ thống trả lỗi validate.
- Bối cảnh người dùng chọn bỏ qua hóa đơn, khi xác nhận, thì review chuyển REFERENCE_ONLY.
- Bối cảnh review SUBMITTED không có receipt sau 24 giờ, khi job chạy, thì review chuyển REFERENCE_ONLY.

### OCR-001

- Bối cảnh file hóa đơn là JPG/PNG/HEIC và tối đa 10MB, khi tải lên bằng multipart kèm Idempotency-Key, thì bản ghi xác minh hóa đơn được tạo.
- Bối cảnh mobile retry cùng Idempotency-Key và payload, khi gửi lại, thì API trả bản ghi cũ và không tạo receipt trùng.
- Bối cảnh cùng Idempotency-Key nhưng payload khác, khi gửi lại, thì API trả IDEMPOTENCY_CONFLICT.
- Bối cảnh hash file đã tồn tại, khi tải lên, thì hóa đơn bị từ chối và cờ gian lận được tạo.
- Bối cảnh điểm rủi ro 0-30, khi OCR hoàn tất, thì đánh giá chuyển VERIFIED.

### ADM-001

- Bối cảnh case đang chờ xử lý, khi quản trị viên gửi quyết định kèm lý do, thì trạng thái đối tượng thay đổi theo State Machines và audit log được tạo.
- Bối cảnh quản trị viên không nhập lý do, khi gửi quyết định, thì API trả ADMIN_REASON_REQUIRED và trạng thái không đổi.
- Bối cảnh admin mở case detail, khi dữ liệu có receipt/OCR/GPS/risk, thì giao diện hiển thị đủ bằng chứng và mask dữ liệu nhạy cảm.

## Tiêu chí nghiệm thu bổ sung cho store readiness

| ID | Hạng mục | Acceptance criteria |
|---|---|---|
| PRIV-001 | Xóa tài khoản trong app | Người dùng đã đăng nhập mở Account Settings, đọc hậu quả, xác nhận chủ động, gửi yêu cầu xóa; API trả trạng thái request; session/token bị revoke theo thiết kế; PII được xóa/ẩn danh hóa theo retention. |
| PRIV-002 | Web deletion link | Link/form xóa tài khoản/dữ liệu truy cập được ngoài app, có trong store metadata và Privacy Policy. |
| SAFETY-001 | Report/block UGC | Người dùng báo cáo review vi phạm, không tạo report trùng mở cùng reason, và có thể chặn người dùng vi phạm. |
| STORE-001 | Store submission gate | App Store/Play Store checklist, privacy/data safety mapping, content/age rating, permission declarations, reviewer notes và demo access được PO/Legal/Release Manager ký xác nhận trước submit. |
