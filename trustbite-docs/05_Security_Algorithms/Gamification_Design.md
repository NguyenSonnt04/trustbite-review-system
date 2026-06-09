# Thiết kế game hóa - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Thiết kế game hóa |
| Phiên bản | v2.1.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Sản phẩm / Thiết kế game hóa |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu MVP

Game hóa trong MVP chỉ nhằm khuyến khích đánh giá thật và tải hóa đơn. Không được làm phức tạp luồng lõi hoặc tạo động cơ spam.

---

## 2. Quy tắc EXP V1

| Hành động | EXP | Điều kiện / Giới hạn |
|---|---:|---|
| Gửi đánh giá tham khảo hợp lệ | +10 | Tối đa 2 bài/ngày được tính EXP. |
| Đánh giá được xác minh bằng hóa đơn/rủi ro/quản trị viên | +50 | Hóa đơn không trùng hash; xác minh đạt. GPS không bắt buộc. |
| Nhận bình chọn hữu ích | +5 | P1; chỉ tính nếu vote từ người dùng đủ điều kiện. |
| Đánh giá bị từ chối/ẩn vì vi phạm | 0 hoặc thu hồi | Theo quyết định kiểm duyệt. |

---

## 3. Bảng cấp hạng V1

| Cấp hạng | EXP | Điều kiện bổ sung | Ghi chú |
|---|---:|---|---|
| NEWBIE | 0 | Không | Cấp hạng mặc định. |
| APPRENTICE | 100 | >=2 đánh giá đã xác minh | Mở bình chọn hữu ích nếu P1. |
| FOODIE | 500 | >=10 đánh giá đã xác minh | Có thể tăng trọng số đánh giá theo điểm tin cậy V1. |
| TRUSTED_FOODIE | 2000 | >=25 đánh giá đã xác minh | Cấp cao trong MVP/V1. |
| FOODGOD | Tương lai | Chỉ dùng cho nhiệm vụ bí mật | Không thuộc lõi MVP. |

---

## 4. Quy tắc chống spam

- EXP không được cộng cho hóa đơn trùng hoặc bị từ chối.
- EXP có thể bị thu hồi nếu đánh giá bị ẩn/từ chối sau kiểm duyệt.
- Cấp hạng không được dùng để bỏ qua chống gian lận.
- Người dùng mới không được tăng trọng số quá nhanh chỉ bằng spam đánh giá tham khảo.

---

## 5. Huy hiệu P1/Tương lai

| Huy hiệu | Điều kiện | Giai đoạn |
|---|---|---|
| Bậc thầy hóa đơn | 10 đánh giá đã xác minh liên tiếp | P1 |
| Người khám phá | Là người đầu tiên có đánh giá đã xác minh cho 5 quán mới | P1 |
| Cú đêm | 10 đánh giá sau 22:00 | Tương lai |

---

## 6. Quan hệ với điểm tin cậy

Cấp hạng chỉ ảnh hưởng đến trọng số khi đánh giá là VERIFIED. Đánh giá tham khảo luôn có trọng số thấp để tránh spam.
