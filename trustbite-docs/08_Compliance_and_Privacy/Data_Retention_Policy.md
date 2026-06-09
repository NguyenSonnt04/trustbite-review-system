# Chính sách lưu giữ dữ liệu - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Data retention policy |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Legal / Security |
| Ngày cập nhật | 2026-06-07 |

---

| Loại dữ liệu | Thời gian lưu giữ | Chính sách xử lý |
|---|---:|---|
| Bản ghi OTP | 30 ngày | Lưu để điều tra lạm dụng, sau đó xóa hoặc ẩn danh hóa. |
| Ảnh hóa đơn gốc | Mặc định 180 ngày | Lưu riêng tư; xóa hoặc ẩn danh hóa sau thời hạn lưu giữ, trừ khi có tranh chấp hoặc yêu cầu pháp lý. |
| Bản hóa đơn đã che dữ liệu | 365 ngày | Dùng làm bằng chứng xác minh nếu cần hiển thị công khai. |
| Tọa độ GPS | 30-90 ngày | Chỉ dùng cho xác minh/audit; sau đó tổng hợp hoặc ẩn danh hóa. |
| Nội dung đánh giá | Đến khi người dùng yêu cầu xóa hoặc bị kiểm duyệt xóa | Xóa mềm để phục vụ audit nếu pháp lý cho phép. |
| Cờ gian lận | 2 năm | Dùng cho phân tích bảo mật/chống lạm dụng; giới hạn quyền truy cập. |
| Audit log | 3 năm | Hồ sơ vận hành/pháp lý. |
| Hash thiết bị/IP | 30-90 ngày | Chỉ dùng cho giới hạn tần suất và bảo mật; không dùng để profiling dài hạn trong MVP. |
| Thông báo | 1 năm | Xóa thông báo đã đọc và quá hạn. |
| Yêu cầu xóa tài khoản | Tối đa 3 năm cho audit tối thiểu, hoặc ngắn hơn nếu legal cho phép | Lưu trạng thái xử lý, thời điểm yêu cầu, actor xử lý và lý do giữ dữ liệu nếu có. |
| Danh sách chặn người dùng | Đến khi người dùng bỏ chặn hoặc tài khoản bị xóa/ẩn danh hóa | Dùng để bảo vệ trải nghiệm UGC; không dùng cho quảng cáo/profiling. |

## Quy trình xử lý yêu cầu xóa tài khoản

1. Người dùng gửi yêu cầu trong app hoặc qua web link/form công khai.
2. Backend tạo bản ghi `account_deletion_requests` trạng thái `REQUESTED` và revoke hoặc đánh dấu revoke session theo chiến lược triển khai.
3. Hệ thống xóa hoặc ẩn danh hóa số điện thoại, avatar, display name, session/push token, receipt file gốc và các PII không cần giữ.
4. Review public được xóa, ẩn hoặc ẩn danh hóa theo quyết định sản phẩm/pháp lý; không còn hiển thị PII của người dùng đã xóa.
5. Audit log, fraud flag và legal hold chỉ giữ thông tin tối thiểu, có thời hạn và chỉ người có quyền truy cập.
6. CS/Ops phản hồi trạng thái hoàn tất hoặc lý do chưa thể hoàn tất nếu có nghĩa vụ pháp lý/tranh chấp đang mở.

## Nguyên tắc

- Chỉ thu thập lượng dữ liệu tối thiểu cần cho xác minh.
- GPS là tùy chọn.
- Ảnh hóa đơn được lưu riêng tư theo mặc định.
- Bằng chứng hiển thị công khai phải được che dữ liệu nhạy cảm.
- Yêu cầu xóa tài khoản phải xóa hoặc ẩn danh hóa dữ liệu cá nhân, trừ khi cần giữ lại vì nghĩa vụ pháp lý/audit.
- Mọi hình thức fingerprint thiết bị phải được rà soát quyền riêng tư trước khi triển khai.