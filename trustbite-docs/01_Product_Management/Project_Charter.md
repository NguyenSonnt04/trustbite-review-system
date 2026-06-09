# Hiến chương dự án - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Dự án | TrustBite - Nền tảng đánh giá ẩm thực tin cậy |
| Phiên bản | v2.0.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Chủ sở hữu sản phẩm |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Bối cảnh

Thị trường đánh giá ẩm thực bị ảnh hưởng bởi seeding, quảng cáo trá hình và đánh giá thiếu bằng chứng. Người dùng khó phân biệt trải nghiệm thật với nội dung được tài trợ hoặc thao túng. TrustBite giải quyết vấn đề này bằng cách ưu tiên đánh giá có bằng chứng: hóa đơn, thời gian ghé quán, dữ liệu GPS tùy chọn và quy trình kiểm duyệt minh bạch.

---

## 2. Tầm nhìn

TrustBite hướng tới trở thành nền tảng đánh giá ẩm thực minh bạch tại Việt Nam, nơi điểm số của quán được tính dựa trên độ tin cậy của đánh giá thay vì số lượng đánh giá đơn thuần.

---

## 3. Ranh giới MVP

TrustBite MVP là mobile-first: người dùng cuối dùng app iOS/Android; admin portal dùng web để xử lý hàng đợi, kiểm duyệt và audit.

MVP của TrustBite tập trung chứng minh 3 giả thuyết chính:

1. Người dùng có sẵn sàng tải hóa đơn để đổi lấy đánh giá đáng tin cậy không?
2. Đánh giá đã xác minh có làm tăng niềm tin khi chọn quán không?
3. Chủ quán có sẵn sàng tham gia nền tảng minh bạch hóa chất lượng không?

Các chức năng ngoài 3 giả thuyết trên sẽ được đưa sang giai đoạn sau.

---

## 4. Mục tiêu MVP

| Mục tiêu | Chỉ số đo |
|---|---|
| Xác thực hành vi đánh giá thật | >= 60% đánh giá mới có hóa đơn tải trong giai đoạn beta |
| Giảm đánh giá spam/seeding | 100% hóa đơn tải được hash check |
| Tạo giá trị cho người chọn quán | >= 70% người dùng khảo sát hiểu nhãn đã xác minh/tham khảo |
| Vận hành được luồng quản trị viên | 95% trường hợp chờ xử lý được xử lý trong 24 giờ làm việc |

Lưu ý: Các mục tiêu lớn như 50,000 người dùng hoạt động hằng tháng, 5,000 chủ quán hoặc OCR >90% được chuyển sang V1/V2 sau khi MVP có dữ liệu thật.

---

## 5. Phạm vi theo giai đoạn

### 5.1. MVP bắt buộc có

| Module | Chức năng |
|---|---|
| Xác thực | Đăng ký/đăng nhập OTP, giới hạn tần suất OTP |
| Quán | Danh sách quán, chi tiết quán, tìm kiếm, bản đồ cơ bản |
| Đánh giá | Viết đánh giá 4 tiêu chí, bình luận, media cơ bản |
| Hóa đơn | Upload hóa đơn, kiểm tra file, kiểm tra hash trùng, OCR cơ bản |
| GPS | Lấy GPS nếu người dùng cấp quyền, dùng như tín hiệu rủi ro |
| Điểm tin cậy | Công thức V1 dựa trên trạng thái đánh giá và cấp hạng người dùng |
| Quản trị viên | Duyệt quán, duyệt hóa đơn/đánh giá nghi vấn, xử lý báo cáo |
| Kiểm duyệt | Report đánh giá, ẩn/xóa nội dung vi phạm |
| Game hóa | EXP cơ bản, rank cơ bản |

### 5.2. V1.1 nên có

| Module | Chức năng |
|---|---|
| Cổng chủ quán | Claim quán, cập nhật thông tin, phản hồi đánh giá |
| Thông báo | Email/trong ứng dụng thông báo cho đánh giá/báo cáo/quyết định của quản trị viên |
| Điểm tin cậy | Chấm điểm rủi ro tinh chỉnh theo dữ liệu thật |
| Kiểm duyệt | Hàng đợi lọc theo mức độ nghiêm trọng |
| Đánh giá | Bình chọn hữu ích, danh sách yêu thích |

### 5.3. Tương lai

| Module | Chức năng |
|---|---|
| AI | tóm tắt AI bằng Bedrock/LLM |
| Fraud | AI đồ thị hành vi, phân tích ảnh nâng cao nâng cao |
| Game hóa | nhiệm vụ bí mật, nhiệm vụ FOODGOD, hoàn tiền |
| Mở rộng | Kiến trúc cho 20,000 người dùng đồng thời |
| Giá | Chênh lệch giá nâng cao dựa trên menu/hóa đơn history |

---

## 6. Ngoài phạm vi MVP

- Ứng dụng mobile native iOS/Android.
- Cổng đặt chỗ/thanh toán.
- Quy trình hoàn tiền cho nhiệm vụ bí mật.
- tóm tắt AI tự động.
- Fingerprint thiết bị nâng cao bắt buộc.
- AI đồ thị hành vi.
- Hạ tầng quy mô 20,000 người dùng đồng thời.

---

## 7. Vai trò dự án

| Vai trò | Trách nhiệm |
|---|---|
| Chủ sở hữu sản phẩm | Phạm vi, lộ trình, ưu tiên backlog |
| Chuyên viên phân tích nghiệp vụ | Đặc tả chức năng, quy tắc nghiệp vụ, máy trạng thái |
| Nhà thiết kế UX/UI | Luồng người dùng, danh sách màn hình, yêu cầu wireframe |
| Kiến trúc sư hệ thống | Kiến trúc, nguyên tắc API, thiết kế DB |
| Kỹ sư backend | API, hàng đợi OCR, chấm điểm gian lận, quy trình quản trị |
| Kỹ sư frontend | Ứng dụng người dùng, cổng chủ quán, cổng quản trị |
| QA/QC | Kế hoạch kiểm thử, UAT, hồi quy, tiêu chí nghiệm thu |
| Vận hành quản trị | Duyệt quán, xử lý báo cáo, xác minh thủ công |

---

## 8. Milestone đề xuất

| Giai đoạn | Kết quả bàn giao |
|---|---|
| Giai đoạn 1 - Nền tảng tài liệu | PRD, Functional Spec, Role Matrix, State Machines, Quy tắc nghiệp vụ |
| Giai đoạn 2 - Hợp đồng kỹ thuật | Đặc tả API, SRS, Schema DB, Từ điển dữ liệu |
| Giai đoạn 3 - Đồng bộ UX/QA | Danh sách màn hình, Luồng người dùng, Tiêu chí nghiệm thu, UAT Test Cases |
| Giai đoạn 4 - Xây dựng MVP | Xác thực, Quán, Đánh giá, Hóa đơn, Quản trị viên basic |
| Giai đoạn 5 - Xác thực beta | Dữ liệu thật, đo mức độ sử dụng, điều chỉnh điểm rủi ro |

---

## 9. Rủi ro chính

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| OCR hóa đơn Việt Nam không ổn định | Đánh giá đã xác minh thấp | Cho manual đánh giá và risk scoring thay vì quy tắc cứng |
| Người dùng ngại tải hóa đơn | Không kiểm chứng được giả thuyết cốt lõi | Giải thích quyền riêng tư, che thông tin nhạy cảm, game hóa |
| Quản trị viên quá tải | Hàng đợi pending chậm | Ưu tiên quyết định tự động cho case risk thấp/cao rõ ràng |
| Chủ quán phản đối đánh giá xấu | Tranh chấp vận hành | Report quy trình, audit log, chính sách rõ |
| Quyền riêng tư với GPS/dữ liệu thiết bị | Rủi ro pháp lý | GPS optional, tối thiểu hóa dữ liệu, retention chính sách |
