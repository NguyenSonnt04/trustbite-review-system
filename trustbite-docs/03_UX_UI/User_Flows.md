# Luồng người dùng - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | User flows |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | UX / BA |
| Ngày cập nhật | 2026-06-07 |

---

Các luồng dưới đây ưu tiên mobile app cho người dùng cuối. Admin và merchant dùng web portal. Tài liệu chưa chốt layout/visual style.

## 1. Luồng đăng nhập

```text
Mở màn hình đăng nhập → Nhập số điện thoại → Yêu cầu OTP → Nhập OTP → Xác thực → Đăng nhập thành công
                                      ↓             ↓
                              Vượt giới hạn     OTP sai/hết hạn
```

## 2. Luồng gửi đánh giá đã xác minh trên mobile

```text
Chi tiết quán
→ Viết đánh giá
→ Nhập 4 tiêu chí + bình luận
→ Gửi đánh giá
→ Tải/chụp hóa đơn
→ Hiển thị thông báo quyền riêng tư
→ Cấp GPS nếu muốn
→ Upload hóa đơn
→ Xử lý OCR/hash/rủi ro bất đồng bộ
→ Kết quả: Đã xác minh / Chờ quản trị viên / Tham khảo / Từ chối
```

Nếu app bị đóng khi OCR đang xử lý, khi mở lại app phải lấy trạng thái mới nhất từ backend.

## 3. Luồng tìm kiếm quán trên mobile

```text
Trang chủ dạng bản đồ/danh sách
→ Nhập từ khóa hoặc di chuyển bản đồ
→ Áp dụng bộ lọc
→ Xem thẻ quán trong danh sách/bottom sheet
→ Mở chi tiết quán
```

## 4. Luồng quản trị viên rà soát hóa đơn

```text
Quản trị viên đăng nhập
→ Mở hàng đợi hóa đơn
→ Mở case đang chờ xử lý
→ Xem hóa đơn/OCR/rủi ro/tín hiệu GPS
→ Duyệt / Từ chối / Đánh dấu tham khảo
→ Nhập lý do
→ Lưu quyết định
→ Ghi audit log + tạo thông báo
```

## 5. Luồng báo cáo đánh giá

```text
Xem đánh giá
→ Bấm báo cáo
→ Chọn lý do
→ Thêm mô tả/bằng chứng
→ Gửi báo cáo
→ Báo cáo vào hàng đợi
→ Quản trị viên quyết định
```

## 6. Luồng chủ quán xác nhận quyền quản lý P1

```text
Chủ quán đăng nhập
→ Tìm quán
→ Gửi claim quán
→ Tải bằng chứng
→ Vào hàng đợi quản trị
→ Được duyệt / Bị từ chối
→ Truy cập cổng chủ quán
```