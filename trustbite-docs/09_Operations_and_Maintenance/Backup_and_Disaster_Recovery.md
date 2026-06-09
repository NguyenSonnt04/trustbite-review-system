# Đặc tả sao lưu và khôi phục thảm họa - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Sao lưu và khôi phục thảm họa |
| Phiên bản | v2.1.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | DevOps / SRE |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu phục hồi

| Chỉ số | Mục tiêu MVP | Ghi chú |
|---|---:|---|
| RTO | < 2 giờ | Thời gian tối đa để hệ thống hoạt động lại sau sự cố nghiêm trọng. |
| RPO | < 15 phút | Mức mất dữ liệu tối đa có thể chấp nhận. |

---

## 2. Chiến lược sao lưu

### 2.1. Cơ sở dữ liệu PostgreSQL

- Bật backup tự động hằng ngày.
- Lưu backup tối thiểu 7-30 ngày tùy môi trường.
- Production nên bật PITR nếu dùng managed PostgreSQL.
- Trước migration lớn phải tạo backup hoặc snapshot thủ công.

### 2.2. Ảnh hóa đơn và file upload

- Bucket hóa đơn phải bật versioning nếu chi phí cho phép.
- Ảnh hóa đơn gốc lưu riêng tư.
- Lifecycle policy phải tuân thủ `08_Compliance_and_Privacy/Data_Retention_Policy.md`.
- Không nhân bản dữ liệu nhạy cảm sang vùng khác nếu chưa rà soát pháp lý/quyền riêng tư.

### 2.3. Mã nguồn và tài liệu

- GitHub là nguồn chính cho mã nguồn và tài liệu.
- Release quan trọng nên được tag.
- Không lưu secret trong repo.

---

## 3. Kịch bản ứng phó sự cố

### 3.1. Lỗi database

1. Xác định thời điểm bắt đầu lỗi.
2. Chặn ghi nếu cần để tránh hỏng dữ liệu thêm.
3. Restore từ backup/PITR sang instance mới.
4. Kiểm tra dữ liệu mẫu: users, restaurants, reviews, receipt_verifications.
5. Chuyển API sang database đã khôi phục.
6. Ghi postmortem.

### 3.2. Mất hoặc xóa nhầm ảnh hóa đơn

1. Kiểm tra versioning hoặc backup object storage.
2. Khôi phục object bị ảnh hưởng.
3. Kiểm tra liên kết trong `receipt_verifications`.
4. Nếu không thể khôi phục, đánh dấu case cần quản trị viên xử lý và thông báo theo chính sách.

### 3.3. Lỗi OCR worker hoặc hàng đợi

1. Dừng worker lỗi nếu tạo kết quả sai.
2. Giữ nguyên job trong hàng đợi hoặc đưa vào dead-letter queue.
3. Deploy worker ổn định trước đó.
4. Chạy lại job chưa hoàn tất.
5. Kiểm tra audit log và trạng thái receipt.

---

## 4. Quy tắc kiểm thử khôi phục

- Staging phải kiểm thử restore database định kỳ.
- Production phải có runbook restore được cập nhật.
- Backup không được xem là hợp lệ nếu chưa từng restore thử.
- Sau mỗi sự cố nghiêm trọng phải có báo cáo nguyên nhân và hành động phòng ngừa.
