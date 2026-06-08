# Mobile navigation map - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Sơ đồ điều hướng mobile |
| Phiên bản | v1.0.0 |
| Trạng thái | Bản nháp |
| Chủ sở hữu | UX Lead / Product Manager |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Phạm vi

Tài liệu này mô tả cấu trúc điều hướng mobile cho MVP. Tài liệu **không chốt màu sắc, layout chi tiết, font, icon hoặc visual style**.

---

## 2. Navigation cấp cao

```text
App Root
├── Auth Stack
│   ├── OTP Request
│   └── OTP Verify
│
└── Main App
    ├── Explore
    │   ├── Home Map/List
    │   ├── Search Results
    │   ├── Restaurant Detail
    │   ├── Review Detail
    │   └── Report Review
    │
    ├── Review Flow
    │   ├── Write Review
    │   ├── Receipt Upload
    │   ├── GPS Optional Step
    │   └── Verification Result
    │
    ├── Profile
    │   ├── Profile Overview
    │   ├── My Reviews
    │   └── Account Settings
    │
    └── Notifications P1
        └── Notification List
```

---

## 3. Entry points chính

| Entry point | Điều hướng |
|---|---|
| Mở app chưa đăng nhập | Home/Explore public hoặc Auth Stack khi cần hành động đăng nhập |
| Bấm viết đánh giá khi chưa đăng nhập | Auth Stack → quay lại Write Review |
| Bấm CTA viết đánh giá ở chi tiết quán | Restaurant Detail → Write Review |
| Gửi review thành công | Write Review → Receipt Upload |
| Upload hóa đơn thành công | Receipt Upload → Verification Result |
| OCR đang xử lý lâu | Verification Result ở trạng thái processing, cho phép quay lại Explore |
| Notification kết quả xác minh P1 | Notification → Verification Result hoặc Review Detail |

---

## 4. Nguyên tắc điều hướng

- Người dùng không bị ép đăng nhập để xem danh sách, tìm kiếm và xem chi tiết quán.
- Đăng nhập chỉ bắt buộc khi viết đánh giá, tải hóa đơn, bình chọn, báo cáo hoặc lưu quán.
- Sau khi đăng nhập, app phải đưa người dùng quay lại hành động trước đó nếu có.
- Luồng upload hóa đơn phải cho phép người dùng quay lại mà không mất review đã tạo.
- Trạng thái xác minh là màn hình/section có thể truy cập lại, không chỉ là toast tạm thời.
- GPS là bước tùy chọn trong flow upload, không được thiết kế như điều kiện bắt buộc.

---

## 5. Back behavior

| Màn hình | Back behavior mong muốn |
|---|---|
| OTP Verify | Quay về OTP Request |
| Restaurant Detail | Quay về kết quả tìm kiếm/home với filter được giữ |
| Write Review | Cảnh báo nếu có dữ liệu chưa gửi |
| Receipt Upload | Quay về Review Detail hoặc Verification Result nếu review đã tạo |
| Verification Result | Quay về Restaurant Detail hoặc My Reviews |
| Report Review | Quay về Review Detail sau khi gửi hoặc hủy |

---

## 6. Deep link P1

Deep link chưa bắt buộc cho MVP public beta, nhưng nên chuẩn bị route convention:

```text
trustbite://restaurants/{restaurantId}
trustbite://reviews/{reviewId}
trustbite://receipt-verifications/{id}
trustbite://notifications/{id}
```
