# Chính sách kiểm duyệt nội dung và hành vi người dùng - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Chính sách kiểm duyệt nội dung |
| Phiên bản | v2.2.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Vận hành cộng đồng / Kiểm duyệt |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Nội dung bị cấm

TrustBite quy định các loại nội dung không được hiển thị công khai. Đánh giá vi phạm có thể bị gắn cờ, ẩn hoặc xóa mềm tùy mức độ.

### 1.1. Ngôn từ không phù hợp

- Từ ngữ tục tĩu, thô tục, xúc phạm, phân biệt vùng miền, giới tính, tôn giáo.
- Công kích cá nhân trực tiếp thay vì nhận xét khách quan về món ăn, dịch vụ, giá hoặc không gian.

### 1.2. Bão đánh giá ác ý

- Nghiêm cấm đánh giá 1 sao hàng loạt do sự kiện truyền thông không liên quan trực tiếp đến trải nghiệm ăn uống thực tế.
- Nếu lượng đánh giá bất thường tăng đột biến, hệ thống có thể tạm gắn cờ để quản trị viên rà soát.

### 1.3. Cáo buộc nghiêm trọng thiếu bằng chứng

- Cáo buộc ngộ độc thực phẩm, dị vật nguy hiểm hoặc vi phạm an toàn thực phẩm phải có bằng chứng phù hợp.
- Nếu thiếu bằng chứng, đánh giá có thể chuyển HIDDEN hoặc PENDING_ADMIN_REVIEW để tránh gây thiệt hại vô căn cứ.

---

## 2. Quy trình kiểm duyệt

```text
Đánh giá mới
→ Kiểm tra tự động nội dung/từ cấm/spam
→ Hiển thị hoặc gắn cờ chờ duyệt
→ Người dùng/chủ quán có thể báo cáo
→ Quản trị viên xử lý báo cáo
→ Giữ nguyên / Ẩn / Xóa mềm / Hạn chế tài khoản
```

### 2.1. Kiểm tra tự động

- Chặn bình luận dưới ngưỡng tối thiểu.
- Gắn cờ nội dung chứa từ cấm hoặc pattern spam.
- Không tự động xóa vĩnh viễn nếu chưa có chính sách rõ ràng.

### 2.2. Cộng đồng báo cáo

- Người dùng và chủ quán có thể bấm “Báo cáo vi phạm”.
- Báo cáo hợp lệ được đưa vào hàng đợi quản trị.
- Báo cáo nghiêm trọng có thể tạm ẩn đánh giá cho đến khi quản trị viên ra quyết định.

---

## 3. Hình thức xử lý vi phạm

### 3.1. Đối với người dùng

- Vi phạm nhẹ: cảnh cáo bằng thông báo trong ứng dụng.
- Vi phạm lặp lại: khóa quyền viết đánh giá trong thời gian nhất định.
- Vi phạm nghiêm trọng: khóa tài khoản theo quyết định của quản trị viên/siêu quản trị.

### 3.2. Đối với chủ quán

- Phát hiện seeding hoặc thao túng đánh giá: hủy điểm/đánh giá vi phạm, ghi audit log và cảnh báo.
- Vi phạm lặp lại: hạn chế quyền quản lý quán hoặc treo trạng thái cảnh báo.
- Vi phạm nghiêm trọng: khóa quyền chủ quán sau khi có bằng chứng và quyết định quản trị.

---

## 4. Yêu cầu audit

- Mọi hành động ẩn/xóa/khôi phục đánh giá phải ghi audit log.
- Quyết định của quản trị viên phải có lý do.
- Người bị ảnh hưởng nên nhận thông báo nếu chính sách sản phẩm yêu cầu.


## 5. Yêu cầu an toàn UGC cho store release

Vì TrustBite có review/nội dung do người dùng tạo, bản public beta/production phải có đủ cơ chế tối thiểu sau:

| Cơ chế | Yêu cầu MVP | Owner |
|---|---|---|
| Lọc nội dung | Từ cấm/spam pattern/rate limit trước hoặc ngay sau khi submit; case nghi ngờ vào queue. | Backend / Moderation Ops |
| Báo cáo nội dung | Người dùng/chủ quán báo cáo review từ màn hình liên quan, chọn reason code và mô tả. | Mobile / Backend |
| Chặn người dùng | Người dùng có thể chặn hoặc hạn chế tương tác với người dùng lạm dụng trong phạm vi TrustBite. | Mobile / Backend |
| Kênh liên hệ | Có email/form support cho vấn đề nội dung, an toàn, privacy và khiếu nại. | Ops / Legal |
| SLA xử lý | Nội dung gây hại nghiêm trọng phải được triage nhanh; beta cần lịch trực rõ. | Ops Lead |

## 6. Khiếu nại và khôi phục

- Người dùng/chủ quán có thể liên hệ support nếu cho rằng quyết định kiểm duyệt sai.
- Khôi phục nội dung chỉ thực hiện khi có reason và audit log.
- Siêu quản trị có quyền override theo chính sách, nhưng mọi override phải nêu lý do và không xóa dấu vết audit.
