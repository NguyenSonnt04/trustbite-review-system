# Phạm vi MVP - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Phạm vi MVP |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Product Owner |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu MVP

MVP kiểm chứng khả năng tạo niềm tin bằng đánh giá đã xác minh dựa trên hóa đơn và quy trình quản trị thực tế. Client chính của người dùng cuối là mobile app iOS/Android; admin portal dùng web để xử lý vận hành.

MVP kiểm chứng 3 giả thuyết:

1. Người dùng có sẵn sàng tải hóa đơn để đổi lấy đánh giá đáng tin cậy không?
2. Đánh giá đã xác minh có làm tăng niềm tin khi chọn quán không?
3. Chủ quán có sẵn sàng tham gia nền tảng minh bạch hóa chất lượng không?

Với giả thuyết chủ quán, MVP chỉ cần đủ cơ chế vận hành để admin ghi nhận/duyệt claim hoặc phản hồi thủ công nếu cần. Cổng chủ quán đầy đủ không chặn MVP.

---

## 2. Quyết định chốt cho MVP

| Chủ đề | Quyết định MVP | Lý do | Tài liệu downstream |
|---|---|---|---|
| Client người dùng | Mobile app iOS/Android | Phù hợp hành vi tìm quán/viết review/tải hóa đơn | Mobile architecture, UX mobile, mobile QA |
| Admin portal | Web bắt buộc | Cần hàng đợi, bảng dữ liệu, audit và xử lý case | Admin screen spec, API, QA |
| Merchant portal | P1/V1.1; MVP chỉ hỗ trợ admin/manual claim tối thiểu nếu cần | Không chặn kiểm chứng review verified | PRD, SRS, API, backlog |
| Upload hóa đơn | Multipart API cho MVP, kèm `Idempotency-Key`; signed upload để P1 khi traffic/tệp lớn | Tối ưu tốc độ build và test | API, OpenAPI, mobile, QA |
| GPS | Tùy chọn; thiếu GPS không auto reject | Giảm rào cản privacy | Anti-fraud, UX, QA |
| Review không có hóa đơn | Người dùng có thể bỏ qua xác minh; review chuyển `REFERENCE_ONLY`. Review `SUBMITTED` không upload trong 24 giờ cũng tự chuyển `REFERENCE_ONLY` bởi job | Tránh trạng thái treo, rõ điểm tin cậy | State machine, API, QA |
| Notification | P1. MVP dùng polling/refetch trạng thái từ API; chỉ tạo notification nếu module được bật bằng feature flag | Giảm phạm vi mobile release | Mobile architecture, API, release checklist |
| OCR/risk | Worker bất đồng bộ; duplicate hash là rule cứng; OCR/GPS là tín hiệu rủi ro | Giảm false positive | Anti-fraud, DB, QA |
| Account deletion | P0 trước public beta: mobile có in-app deletion flow; web link/form deletion công khai; backend tự động xóa/ẩn danh hóa theo retention | Bắt buộc cho store readiness | Privacy, API, DB, QA, Store checklist |

---

## 3. Bắt buộc có

| Module | Nội dung bao gồm |
|---|---|
| Xác thực | Đăng nhập OTP, giới hạn tần suất, session/refresh token an toàn |
| Quán | Mobile danh sách, tìm kiếm, chi tiết, bản đồ cơ bản, chỉ hiển thị `ACTIVE` |
| Đánh giá | Đánh giá 4 tiêu chí, bình luận, trạng thái, bỏ qua xác minh để thành `REFERENCE_ONLY` |
| Hóa đơn | Tải hóa đơn multipart, validate file, kiểm tra hash, OCR cơ bản, idempotency khi retry |
| GPS | Tín hiệu tùy chọn, tính khoảng cách Haversine nếu người dùng cấp quyền |
| Chống gian lận | Chấm điểm rủi ro V1, cờ gian lận, duplicate receipt hash |
| Quản trị viên | Hàng đợi xử lý hóa đơn/đánh giá/báo cáo/quán, case detail, quyết định có reason |
| Kiểm duyệt | Báo cáo đánh giá, ẩn/xóa mềm nội dung vi phạm, audit log |
| Game hóa | EXP/cấp hạng cơ bản cho review verified/reference theo rule |
| QA/Ops | Test P0, device matrix, release checklist, monitoring tối thiểu cho beta |
| Store readiness | Privacy/Data Safety mapping, content/age rating, app access/reviewer notes, UGC report/block và permission minimization | Điều kiện để đưa lên App Store/Google Play | Store checklist, Mobile release, Compliance |

---

## 4. V1.1

- Cổng chủ quán chi tiết.
- Bình chọn hữu ích.
- Danh sách yêu thích.
- Thông báo trong ứng dụng/push notification.
- Signed upload flow nếu traffic upload tăng.
- Điểm tin cậy tinh chỉnh sau beta.

---

## 5. Tương lai

- Tóm tắt AI.
- Nhiệm vụ bí mật.
- Quy trình hoàn tiền.
- AI đồ thị hành vi.
- Phân tích ảnh chống chỉnh sửa nâng cao.
- Hạ tầng quy mô lớn.

---

## 6. Ngoài phạm vi MVP

- Merchant portal đầy đủ.
- Notification/push notification bắt buộc.
- Signed upload bắt buộc.
- App native riêng biệt iOS/Android nếu React Native/Flutter đã đáp ứng.
- Cổng đặt chỗ/thanh toán.
- AI summary, nhiệm vụ bí mật, hoàn tiền.
- Device fingerprint bắt buộc hoặc profiling dài hạn.
- Multi-region active-active hoặc kiến trúc microservices đầy đủ.

---

## 7. Nghiệm thu MVP

MVP đạt khi:

- Người dùng có thể đăng nhập, tìm quán, viết đánh giá, tải hóa đơn hoặc bỏ qua xác minh.
- Review có hóa đơn được xử lý qua hash/OCR/risk để ra `VERIFIED`, `PENDING_ADMIN_REVIEW`, `REFERENCE_ONLY` hoặc `REJECTED`.
- Review bỏ qua/không upload hóa đơn chuyển `REFERENCE_ONLY` và được hiển thị với trọng số thấp nếu không vi phạm kiểm duyệt.
- Quản trị viên xử lý được case nghi vấn có reason và audit log.
- Ảnh hóa đơn gốc private, GPS optional, dữ liệu nhạy cảm không public.
- 100% test case P0/mobile P0 đạt, không còn blocker/critical trước beta.
- Trước public beta, app có in-app account deletion, web deletion link/form, UGC report/block và store privacy/data safety mapping đã được Legal/PO sign-off.
