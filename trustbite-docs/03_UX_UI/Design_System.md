# Design system định hướng - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Design system định hướng |
| Phiên bản | v1.1.0 |
| Trạng thái | Bản nháp |
| Chủ sở hữu | UX Lead / Product Manager |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Phạm vi

Tài liệu này chỉ xác định **nguyên tắc thiết kế sản phẩm và component cần chuẩn hóa**. Chưa chốt:

- màu sắc thương hiệu,
- layout chi tiết,
- typography cuối cùng,
- icon set,
- motion style,
- visual identity.

Các quyết định visual sẽ được cập nhật sau khi có prototype, kiểm thử người dùng và phê duyệt thương hiệu. Nội dung hiển thị, thông báo lỗi, empty state, privacy copy và admin decision copy phải tuân thủ `UX_Writing_Guidelines.md`.

---

## 2. Nguyên tắc sản phẩm

TrustBite là product UI phục vụ tác vụ. Thiết kế cần ưu tiên:

- Rõ trạng thái tin cậy: Verified, Reference, Pending, Rejected.
- Giảm lo lắng khi tải hóa đơn và cấp GPS.
- Không tạo cảm giác ép buộc chia sẻ dữ liệu nhạy cảm.
- Luồng đánh giá nhanh, ít ma sát nhưng vẫn giải thích đủ.
- Admin portal ưu tiên tốc độ xử lý, bằng chứng và audit.
- Consistency quan trọng hơn hiệu ứng trang trí.

---

## 3. Component cần chuẩn hóa cho MVP

| Component | Bề mặt | Ghi chú |
|---|---|---|
| Trust status badge | Mobile, admin, merchant | Hiển thị Verified/Reference/Pending/Rejected bằng cả chữ và màu khi màu được chốt. |
| Restaurant card | Mobile | Tên, địa chỉ, điểm tin cậy, số review verified/reference. |
| Rating input | Mobile | 4 tiêu chí: món ăn, giá, phục vụ, không gian. |
| Receipt upload block | Mobile | Chọn/chụp ảnh, preview, trạng thái upload, thông báo quyền riêng tư. |
| Permission explanation | Mobile | GPS/camera/photo library/notification. |
| Verification result panel | Mobile | Giải thích kết quả xác minh và next action. |
| Admin case row | Admin web | Loại case, tuổi case, risk score, trạng thái. |
| Risk score badge | Admin web | Phục vụ xử lý nhanh, không dùng để public hóa cho người dùng cuối ở MVP. |
| Audit log entry | Admin web | Actor, action, previous/new status, reason, timestamp. |
| Empty state | Mobile, admin | Hướng dẫn hành động tiếp theo, không chỉ ghi “không có dữ liệu”. |
| Error state | Mobile, admin | Có message người dùng hiểu được và mã lỗi kỹ thuật nếu cần. |

---

## 4. Trạng thái component bắt buộc

Mọi interactive component cần có tối thiểu:

- default,
- pressed/active,
- focused,
- disabled,
- loading,
- error nếu liên quan đến form hoặc network.

Mọi màn hình dữ liệu cần có:

- loading/skeleton,
- empty,
- error,
- retry,
- offline/network weak.

---

## 5. Semantic roles chưa chốt màu

Màu cụ thể chưa chốt, nhưng semantic roles cần chuẩn bị:

| Role | Dùng cho |
|---|---|
| Primary action | CTA chính |
| Secondary action | CTA phụ |
| Success | Verified, upload hoàn tất, quyết định thành công |
| Warning | Pending admin review, GPS accuracy thấp, OCR không chắc chắn |
| Error | Rejected, validation lỗi, upload thất bại |
| Info | Giải thích quyền riêng tư, trạng thái processing |
| Neutral | Reference, metadata, disabled/inactive |

Khi chốt màu, mỗi role phải có token cho light/dark nếu app hỗ trợ cả hai theme.

---

## 6. Nội dung cần kiểm thử trước khi chốt visual

- Người dùng có hiểu khác biệt Verified và Reference trong dưới 3 giây không?
- Người dùng có hiểu GPS là tùy chọn không?
- Người dùng có tin rằng ảnh hóa đơn được bảo vệ riêng tư không?
- Admin có xử lý case nhanh hơn khi thấy risk score, OCR, GPS và audit cùng một chỗ không?
- Badge/trạng thái có rõ với người dùng không phân biệt màu không?
- Nội dung lỗi và quyền riêng tư có nhất quán với `UX_Writing_Guidelines.md` không?
