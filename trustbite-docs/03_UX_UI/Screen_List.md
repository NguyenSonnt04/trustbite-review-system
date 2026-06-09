# Danh sách màn hình - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Screen list |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | UX |
| Ngày cập nhật | 2026-06-07 |

---

Tài liệu này liệt kê màn hình theo hướng mobile-first. Màu sắc, layout chi tiết và visual style chưa chốt ở giai đoạn này.

| ID | Màn hình | Tác nhân | MVP | Ghi chú |
|---|---|---|---|---|
| MOB-001 | Trang chủ / bản đồ quán mobile | Khách chưa đăng nhập, người dùng | Có | Hiển thị danh sách và bản đồ, bottom sheet/mobile interaction. |
| MOB-002 | Kết quả tìm kiếm | Khách chưa đăng nhập, người dùng | Có | Tìm theo từ khóa, bộ lọc và sắp xếp. |
| MOB-003 | Chi tiết quán | Khách chưa đăng nhập, người dùng | Có | Hiển thị điểm tin cậy, đánh giá đã xác minh và đánh giá tham khảo. |
| MOB-004 | Đăng nhập OTP | Khách chưa đăng nhập | Có | Yêu cầu OTP và xác thực OTP. |
| MOB-005 | Gửi đánh giá | Người dùng | Có | Nhập 4 tiêu chí chấm điểm, bình luận và media tùy chọn. |
| MOB-006 | Tải hóa đơn | Người dùng | Có | Chọn/chụp file, thông báo quyền riêng tư và GPS tùy chọn. |
| MOB-007 | Kết quả xác minh | Người dùng | Có | Giải thích trạng thái đã xác minh, chờ duyệt, tham khảo hoặc bị từ chối. |
| MOB-008 | Hồ sơ người dùng | Người dùng | Có | Hiển thị EXP, cấp hạng và lịch sử đánh giá. |
| MOB-009 | Báo cáo đánh giá / chặn người dùng | Người dùng, chủ quán | Có | Chọn lý do báo cáo, mô tả, và chặn người dùng vi phạm khi phù hợp. |
| MOB-010 | Cài đặt tài khoản và quyền riêng tư | Người dùng | Có | Chỉnh hồ sơ, logout, quyền dữ liệu, privacy/terms links, yêu cầu xóa tài khoản. |
| ADM-001 | Bảng điều khiển quản trị web | Quản trị viên | Có | Tóm tắt các hàng đợi cần xử lý. |
| ADM-002 | Hàng đợi hóa đơn của quản trị viên | Quản trị viên | Có | Hiển thị bằng chứng, điểm rủi ro và quyết định xử lý. |
| ADM-003 | Chi tiết case hóa đơn | Quản trị viên | Có | Xem receipt evidence, OCR, GPS, risk breakdown, audit và quyết định. |
| ADM-004 | Hàng đợi kiểm duyệt | Quản trị viên | Có | Xử lý báo cáo và hành động kiểm duyệt. |
| ADM-005 | Claim/quán tối thiểu | Quản trị viên | Có | Duyệt/từ chối quán hoặc yêu cầu claim tối thiểu nếu feature flag bật. |
| ADM-006 | Audit log viewer | Quản trị viên, Siêu quản trị | Có | Truy vết hành động quan trọng theo entity/case. |
| MER-001 | Yêu cầu claim quán | Chủ quán | P1 | Form gửi yêu cầu xác nhận quyền quản lý. |
| MER-002 | Cổng chủ quán | Chủ quán | P1 | Quản lý hồ sơ quán, phản hồi đánh giá và báo cáo. |
| MOB-011 | Danh sách thông báo | Người dùng, chủ quán, quản trị viên | P1 | Danh sách thông báo trong ứng dụng. |

## Nguyên tắc UX cho MVP

- Trạng thái đã xác minh và tham khảo phải dễ hiểu trong 3 giây.
- Màn hình tải hóa đơn phải có thông báo quyền riêng tư rõ ràng: ảnh gốc lưu riêng tư, thông tin nhạy cảm được che nếu hiển thị.
- GPS là tùy chọn; nội dung giao diện không được tạo cảm giác ép buộc người dùng.
- Hàng đợi quản trị phải ưu tiên bằng chứng, điểm rủi ro và lý do để xử lý nhanh.