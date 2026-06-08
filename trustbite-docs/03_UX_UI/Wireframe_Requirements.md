# Yêu cầu wireframe - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Wireframe requirements |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | UX |
| Ngày cập nhật | 2026-06-07 |

---

Tài liệu này mô tả thành phần bắt buộc ở mức wireframe. Chưa chốt màu sắc, spacing, typography, icon, layout chi tiết hoặc visual identity.

## 1. Trang chủ / Bản đồ

Thành phần bắt buộc:

- Thanh tìm kiếm.
- Bộ lọc dạng chip: khoảng cách, điểm tin cậy, số lượng đánh giá đã xác minh, loại món nếu có.
- Danh sách thẻ quán.
- Pin bản đồ có trạng thái: mặc định, yêu thích, đã ghé/đã xác minh.
- Bottom sheet trên mobile.
- Trạng thái loading, empty, error và retry.

## 2. Chi tiết quán

Thành phần bắt buộc:

- Tên quán, địa chỉ, trạng thái.
- Điểm tin cậy và phân rã điểm đánh giá.
- Số lượng đánh giá đã xác minh so với đánh giá tham khảo.
- CTA: viết đánh giá.
- Tab/bộ lọc đánh giá: đã xác minh, tham khảo, mới nhất.
- Khu vực phản hồi của chủ quán nếu có.

## 3. Gửi đánh giá

Thành phần bắt buộc:

- 4 input điểm: món ăn, giá, phục vụ, không gian.
- Ô bình luận có chỉ báo số ký tự tối thiểu.
- Upload media tùy chọn.
- Nút gửi.
- Thông báo validate.

## 4. Tải hóa đơn

Thành phần bắt buộc:

- Khu vực tải file.
- Định dạng hỗ trợ và dung lượng tối đa.
- Thông báo quyền riêng tư.
- Toggle/prompt quyền GPS tùy chọn.
- Trạng thái đang xử lý.
- Giải thích kết quả xác minh.
- Trạng thái permission denied cho camera/photo library/GPS.
- Trạng thái upload lỗi, mạng yếu và app quay lại foreground.

## 5. Hàng đợi quản trị

Thành phần bắt buộc:

- Bộ lọc: trạng thái, khoảng điểm rủi ro, loại đối tượng, thời gian chờ.
- Bảng case.
- Badge điểm rủi ro.
- Panel bằng chứng.
- Panel văn bản OCR.
- Panel khoảng cách GPS.
- Điều khiển quyết định có lý do bắt buộc.
- Lịch sử audit.

## 6. Khả năng tiếp cận

- Mọi hành động có thể thao tác bằng bàn phím.
- Badge màu phải có nhãn chữ.
- Thông báo lỗi nằm gần field liên quan.
- Upload ảnh phải có text fallback.
- Độ tương phản đạt WCAG AA trong phạm vi thực tế.