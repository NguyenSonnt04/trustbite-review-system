# Mô hình sản phẩm và kinh doanh - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Product model / business model |
| Phiên bản | v1.0.0 |
| Trạng thái | Bản nháp |
| Chủ sở hữu | Product Owner / Business Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Tài liệu này mô tả cách TrustBite tạo giá trị cho người dùng, chủ quán và đội vận hành; đồng thời ghi nhận các giả định thương mại cần kiểm chứng sau MVP.

MVP chưa chốt mô hình doanh thu cuối cùng. Mục tiêu chính của MVP là kiểm chứng hành vi người dùng với đánh giá đã xác minh và khả năng vận hành quy trình minh bạch.

---

## 2. Giá trị sản phẩm

| Nhóm | Vấn đề | Giá trị TrustBite cung cấp |
|---|---|---|
| Người dùng chọn quán | Khó biết review nào thật, review nào seeding | Review có nhãn xác minh/tham khảo, bằng chứng hóa đơn riêng tư, trạng thái minh bạch |
| Người viết review | Đóng góp thật nhưng dễ bị chìm giữa review kém chất lượng | EXP/rank cơ bản, review đã xác minh có trọng số tin cậy cao hơn |
| Chủ quán | Muốn phản hồi và minh bạch chất lượng nhưng lo review giả | Claim quán, báo cáo nội dung, phản hồi review ở V1.1 |
| Admin/Ops | Cần xử lý nghi vấn, report và audit nhất quán | Admin queue, reason bắt buộc, audit log, runbook vận hành |

---

## 3. North Star Metric đề xuất

```text
Số lượng đánh giá đã xác minh hợp lệ mỗi tháng
```

Lý do: chỉ số này đo trực tiếp giá trị cốt lõi của TrustBite là tăng lượng review có bằng chứng thực tế.

Chỉ số hỗ trợ:

- Tỷ lệ review có upload hóa đơn.
- Tỷ lệ receipt được xác minh tự động.
- Tỷ lệ review chuyển `REFERENCE_ONLY`.
- Thời gian xử lý admin queue.
- Tỷ lệ người dùng hiểu đúng nhãn Verified/Reference qua khảo sát.
- Tỷ lệ chủ quán đồng ý claim/tham gia quy trình minh bạch.

---

## 4. Giả định mô hình kinh doanh cần kiểm chứng

| Giả định | Cách kiểm chứng | Giai đoạn |
|---|---|---|
| Người dùng tin review đã xác minh hơn review thường | Survey, funnel xem quán -> hành động lưu/chỉ đường/gọi điện | MVP Beta |
| Người dùng sẵn sàng upload hóa đơn nếu privacy copy rõ | Tỷ lệ upload receipt sau khi gửi review | MVP Beta |
| Chủ quán chấp nhận nền tảng minh bạch nếu có quyền phản hồi | Phỏng vấn, claim/manual onboarding | MVP/V1.1 |
| Chủ quán có thể trả phí cho công cụ quản lý danh tiếng minh bạch | Pilot merchant portal, phỏng vấn willingness-to-pay | V1.1+ |
| Verified review có thể tạo khác biệt đủ mạnh để tăng trưởng organic | Retention, referral, repeat review rate | V1+ |

---

## 5. Phương án doanh thu tiềm năng

Các phương án dưới đây là định hướng, không thuộc phạm vi chốt MVP:

| Phương án | Mô tả | Rủi ro cần kiểm soát |
|---|---|---|
| Merchant subscription | Chủ quán trả phí cho dashboard, phản hồi, insight, claim nâng cao | Không được bán khả năng gỡ review xấu hợp lệ |
| Verified quality badge | Gói hiển thị thông tin quán đã xác thực/chủ quán đã claim | Phải tách rõ quảng cáo với điểm tin cậy |
| Analytics insight | Báo cáo xu hướng review, chất lượng phục vụ, món/chi nhánh | Cần ẩn danh dữ liệu người dùng |
| Sponsored placement có nhãn | Quảng bá quán nhưng có nhãn tài trợ rõ ràng | Không ảnh hưởng thuật toán trust score |
| Enterprise/API data | Dữ liệu xu hướng ẩm thực đã tổng hợp | Chỉ dùng dữ liệu đã tổng hợp/ẩn danh, tuân thủ privacy |

---

## 6. Nguyên tắc thương mại không được vi phạm

- Không cho phép chủ quán trả tiền để sửa, xóa hoặc che review hợp lệ.
- Không làm mờ nhãn `Đã xác minh` và `Tham khảo` vì mục tiêu doanh thu.
- Không public ảnh hóa đơn gốc hoặc OCR text nhạy cảm.
- Không dùng GPS như điều kiện bắt buộc để tạo doanh thu hoặc ưu tiên hiển thị.
- Mọi quảng cáo/tài trợ phải có nhãn rõ ràng và không làm sai lệch trust score.

---

## 7. Câu hỏi mở sau MVP

- Người dùng có quay lại để đọc review đã xác minh trước khi chọn quán không?
- Chủ quán có coi TrustBite là kênh quản lý uy tín hay chỉ là kênh phản hồi khi có review xấu?
- Chi phí OCR/admin moderation trên mỗi review đã xác minh có bền vững không?
- Tỷ lệ false positive của risk scoring có làm giảm trải nghiệm người dùng thật không?
- Cần mô hình doanh thu nào không làm suy yếu niềm tin vào nền tảng?
