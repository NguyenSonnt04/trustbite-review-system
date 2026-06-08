# Chiến lược sẵn sàng cao và mở rộng - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Chiến lược sẵn sàng cao và mở rộng |
| Phiên bản | v2.1.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | DevOps / Kiến trúc sư hệ thống |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Phạm vi

Tài liệu này chia rõ mục tiêu khả dụng của MVP và lộ trình mở rộng trong tương lai. MVP không thiết kế quá mức cho 20,000 người dùng đồng thời, nhưng phải có đường nâng cấp rõ ràng.

---

## 2. Mục tiêu khả dụng MVP

| Nhóm | Mục tiêu MVP |
|---|---|
| Khả dụng | 99.5% |
| Độ trễ API p95 | <1s cho tìm kiếm/chi tiết với dataset MVP |
| Response tải hóa đơn | <3s, OCR xử lý bất đồng bộ |
| Backup | Backup tự động hằng ngày, PITR nếu dùng PostgreSQL managed |
| Monitoring | Theo dõi tỉ lệ lỗi API, lỗi hàng đợi, lỗi OCR và sức khỏe DB |

---

## 3. Khuyến nghị kiến trúc MVP

| Lớp | Khuyến nghị |
|---|---|
| Mobile app | Phân phối qua TestFlight/Google Play beta hoặc store; backend compatibility quan trọng hơn HA client. |
| Admin/Merchant web | CDN/static hosting hoặc managed Next.js deployment. |
| Backend | Một API service dạng modular monolith, tối thiểu 2 instance nếu production. |
| Worker | Worker process riêng cho hàng đợi OCR/chống gian lận. |
| Database | PostgreSQL managed, backup tự động, connection pool. |
| Cache/Queue | Redis/BullMQ cho job bất đồng bộ. |
| Storage | Object storage riêng tư, truy cập bằng signed URL. |

---

## 4. Điểm nghẽn cần theo dõi

| Điểm nghẽn | Tín hiệu | Cách giảm thiểu |
|---|---|---|
| Hàng đợi OCR tồn đọng | Thời gian chờ trong queue tăng | Tăng worker, thiết lập retry, quản lý quota OCR provider. |
| Cạn kết nối DB | Lỗi quá nhiều kết nối | Dùng connection pool hoặc RDS Proxy. |
| Tìm kiếm chậm | p95 >1s | Tối ưu index PostGIS, query và cache. |
| Tải hóa đơn lớn | Timeout khi tải file | Dùng tải trực tiếp vào storage hoặc signed URL. |
| Hàng đợi quản trị quá tải | Trường hợp chờ xử lý quá SLA | Tối ưu ngưỡng auto-decision và bộ lọc hàng đợi. |

---

## 5. Lộ trình mở rộng tương lai

| Giai đoạn | Dấu hiệu kích hoạt | Nâng cấp |
|---|---|---|
| Stage 1 | Lưu lượng MVP ổn định | Thêm autoscaling cho API instance và worker instance. |
| Stage 2 | Lưu lượng đọc cao | Thêm Redis cache và read replica cho API đọc quán/đánh giá. |
| Stage 3 | Khối lượng OCR cao | Tách OCR worker fleet và quản lý quota provider. |
| Stage 4 | Lưu lượng lớn | API Gateway/ALB, WAF, CDN cache, RDS Proxy. |
| Stage 5 | Lưu lượng rất lớn | Tách service theo domain: tìm kiếm, đánh giá, gian lận, quản trị. |

---

## 6. Quy tắc xử lý bất đồng bộ

Không xử lý OCR hoặc phân tích ảnh trực tiếp trong request chính.

```text
Tải hóa đơn → Tạo bản ghi xác minh → Đưa job OCR vào hàng đợi → Trả trạng thái xử lý → Worker cập nhật kết quả
```

---

## 7. Cân nhắc cho 20,000 người dùng đồng thời trong tương lai

Multiple read replica, multi-region active-active, autoscaling nâng cao và traffic engineering quy mô lớn thuộc phạm vi tương lai. Không nên đưa vào MVP nếu chưa có traffic thật vì làm tăng chi phí và độ phức tạp vận hành.
