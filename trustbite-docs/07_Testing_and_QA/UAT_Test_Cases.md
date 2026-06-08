# Kịch bản kiểm thử UAT - MVP TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | UAT test cases |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | QA / BA / PO |
| Ngày cập nhật | 2026-06-07 |

---

## UAT-001: Người dùng tạo đánh giá đã xác minh

1. Đăng nhập bằng OTP.
2. Tìm quán đang ở trạng thái ACTIVE.
3. Gửi đánh giá với 4 tiêu chí và bình luận hợp lệ.
4. Tải hóa đơn hợp lệ.
5. Cho phép GPS trong phạm vi 200m nếu muốn tăng tín hiệu xác minh.

Kết quả mong đợi:

- Đánh giá chuyển VERIFIED.
- Trạng thái xác minh hóa đơn là VERIFIED.
- Người dùng nhận EXP.

## UAT-002: Hóa đơn trùng bị chặn

1. Người dùng A tải hóa đơn X thành công.
2. Người dùng B tải lại cùng hóa đơn X.

Kết quả mong đợi:

- Hóa đơn của người dùng B bị từ chối.
- Cờ gian lận được tạo.
- Đánh giá không được xác minh.

## UAT-003: OCR không chắc chắn chuyển quản trị viên xử lý

1. Người dùng tải hóa đơn có độ tương đồng OCR 60-79%.
2. Hệ thống tính mức rủi ro trung bình.

Kết quả mong đợi:

- Trường hợp xuất hiện trong hàng đợi quản trị.
- Quản trị viên có thể duyệt, từ chối hoặc đánh dấu tham khảo kèm lý do.
- Audit log được tạo.

## UAT-004: Từ chối GPS nhưng vẫn được xử lý

1. Người dùng gửi đánh giá hợp lệ.
2. Người dùng tải hóa đơn hợp lệ nhưng từ chối GPS.

Kết quả mong đợi:

- Hệ thống xử lý OCR và hash.
- Đánh giá không bị tự động từ chối chỉ vì thiếu GPS.

## UAT-005: Báo cáo đánh giá và quản trị viên xử lý

1. Người dùng báo cáo một đánh giá.
2. Quản trị viên mở hàng đợi kiểm duyệt.
3. Quản trị viên ẩn đánh giá kèm lý do.

Kết quả mong đợi:

- Báo cáo chuyển ACTION_TAKEN/CLOSED.
- Đánh giá chuyển HIDDEN.
- Audit log tồn tại.

## UAT-006: Chủ quán xác nhận quyền quản lý P1

1. Chủ quán gửi yêu cầu xác nhận quyền quản lý quán.
2. Quản trị viên duyệt yêu cầu.

Kết quả mong đợi:

- Claim chuyển APPROVED.
- Chủ quán có thể chỉnh hồ sơ quán đã được duyệt.

## UAT-007: Xóa tài khoản và dữ liệu

1. Người dùng đăng nhập.
2. Vào Cài đặt tài khoản và chọn xóa tài khoản.
3. Đọc hậu quả, xác nhận chủ động và gửi yêu cầu.
4. Kiểm tra web deletion link hoạt động ngoài app.

Kết quả mong đợi:

- Request xóa tài khoản được tạo và có trạng thái rõ.
- Session/token bị revoke hoặc xử lý theo thiết kế.
- PII được xóa hoặc ẩn danh hóa theo retention.
- Audit tối thiểu tồn tại cho quy trình xử lý.

## UAT-008: Báo cáo và chặn người dùng

1. Người dùng báo cáo một review vi phạm.
2. Người dùng thử báo cáo trùng cùng reason.
3. Người dùng chặn và bỏ chặn tác giả review.
4. Quản trị viên xử lý report trong admin queue.

Kết quả mong đợi:

- Báo cáo hợp lệ vào queue, báo cáo trùng bị chặn bằng copy rõ.
- Chặn/bỏ chặn cập nhật đúng UI/API.
- Admin decision ghi audit log và cập nhật trạng thái report/review.

## UAT-009: Store submission readiness

1. Release Manager kiểm tra `Store_Submission_Readiness_Checklist.md`.
2. Legal/PO kiểm tra Privacy Policy, Data Safety mapping, Terms outline và content rating.
3. QA dùng tài khoản demo/reviewer notes để chạy đủ luồng OTP, review, receipt, report/block, account deletion.

Kết quả mong đợi:

- Không có mismatch giữa app thật, tài liệu, store metadata và chính sách privacy/moderation.
- Checklist được sign off trước khi submit App Store/Google Play.
