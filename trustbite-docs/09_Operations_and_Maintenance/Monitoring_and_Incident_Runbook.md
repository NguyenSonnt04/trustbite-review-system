# Monitoring và runbook sự cố - TrustBite MVP

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Monitoring và incident runbook |
| Phiên bản | v1.0.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | DevOps / SRE / Ops Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Đảm bảo beta MVP có khả năng phát hiện, phân loại và xử lý sự cố ảnh hưởng tới luồng P0: OTP, tìm quán, gửi review, upload hóa đơn, OCR/risk worker, admin queue, privacy và mobile stability.

---

## 2. Dashboard bắt buộc cho beta

| Dashboard | Chỉ số | Ngưỡng cảnh báo đề xuất |
|---|---|---|
| API health | p95 latency, 5xx rate, request volume, error by endpoint | 5xx >2% trong 10 phút hoặc p95 P0 >2s |
| Auth/OTP | OTP request rate, verify success rate, provider failure, rate limited count | Provider failure >5% trong 10 phút |
| Receipt upload | Upload success rate, 413/415/409 count, p95 upload init latency | Upload success <95% hoặc p95 >3s |
| OCR/worker | Queue depth, oldest job age, OCR failure rate, retry count, dead-letter count | Oldest job >30 phút hoặc DLQ >0 |
| Admin queue | Pending count, overdue >24h, decision mix, admin error rate | Overdue case >5% hoặc queue tăng liên tục 2 giờ |
| Fraud | Duplicate hash count, risk bucket distribution, rejected rate | Duplicate/rejected tăng bất thường so với baseline beta |
| Mobile quality | Crash-free users, API error event, upload error event, app version | Crash-free <99% beta hoặc upload error spike |
| Privacy/security | Signed URL access error, suspicious admin activity, sensitive log detection | Bất kỳ sensitive log hoặc abnormal admin action |

---

## 3. Alert routing

| Loại alert | Người nhận chính | SLA phản hồi beta |
|---|---|---:|
| API down / 5xx cao | Engineering on-call | 15 phút |
| OTP provider lỗi | Backend + Ops | 15 phút |
| OCR queue kẹt | Backend + DevOps | 30 phút |
| Admin queue quá SLA | Ops Lead + PO | 4 giờ làm việc |
| Lộ dữ liệu nhạy cảm | Security + Engineering Lead + PO | Ngay lập tức |
| Mobile crash spike | Mobile Lead + QA | 1 giờ |

---

## 4. Runbook: OTP provider lỗi

1. Kiểm tra dashboard provider và log API theo `requestId`.
2. Xác định lỗi từ provider, rate limit, cấu hình secret hay mạng.
3. Nếu provider lỗi diện rộng, bật thông báo maintenance trong app hoặc giảm retry để tránh spam.
4. Nếu có provider dự phòng, chuyển cấu hình theo quy trình DevOps.
5. Sau khi khôi phục, kiểm tra OTP request/verify success rate.
6. Ghi incident note: thời gian, ảnh hưởng, nguyên nhân, hành động phòng ngừa.

---

## 5. Runbook: OCR worker hoặc queue kẹt

1. Kiểm tra queue depth, oldest job age, worker logs và OCR provider status.
2. Dừng worker mới nếu nghi tạo kết quả sai.
3. Giữ job trong queue hoặc chuyển sang dead-letter queue nếu lỗi lặp lại.
4. Deploy worker ổn định trước đó hoặc tăng worker nếu chỉ là backlog.
5. Với case quá lâu, chuyển `PENDING_ADMIN_REVIEW` nếu phù hợp để admin xử lý.
6. Mobile phải tiếp tục hiển thị processing/pending và refetch được.
7. Ghi postmortem nếu ảnh hưởng nhiều hơn 30 phút hoặc tạo sai trạng thái.

---

## 6. Runbook: Upload hóa đơn lỗi hàng loạt

1. Kiểm tra API `POST /receipts`, object storage, file size/type errors và idempotency conflict.
2. Xác định lỗi từ mobile version, backend validation, storage permission hay network.
3. Nếu storage private bucket/signed access lỗi, tạm dừng OCR worker để tránh mất file.
4. Nếu lỗi do mobile version, dùng feature flag hoặc thông báo user retry sau.
5. Kiểm tra không có receipt record mồ côi: có DB record nhưng không có object hoặc ngược lại.
6. Sau khôi phục, chạy reconciliation job nếu có.

---

## 7. Runbook: Admin queue quá SLA

1. Kiểm tra số case pending, phân loại theo risk/status/age.
2. Ưu tiên case risk cao, duplicate hash, report nghiêm trọng.
3. Nếu backlog do OCR false positive, báo PO/Security để điều chỉnh ngưỡng sau beta.
4. Tăng ca vận hành hoặc tạm chuyển case risk thấp sang `REFERENCE_ONLY` nếu PO phê duyệt.
5. Ghi lại quyết định vận hành và audit nếu thay đổi trạng thái hàng loạt.

---

## 8. Runbook: Nghi lộ dữ liệu hóa đơn/GPS/OTP/token

1. Kích hoạt incident security, hạn chế truy cập log/bucket liên quan.
2. Xác định phạm vi: loại dữ liệu, thời gian, người dùng bị ảnh hưởng, endpoint/log/storage.
3. Rotate secret/token/signed URL nếu cần.
4. Tắt public access hoặc policy sai ngay lập tức.
5. Thông báo PO/Legal/Security để quyết định nghĩa vụ thông báo người dùng/cơ quan chức năng.
6. Xóa/redact dữ liệu nhạy cảm khỏi log nếu policy cho phép và giữ bằng chứng điều tra an toàn.
7. Postmortem bắt buộc trước release tiếp theo.

---

## 9. Runbook: Mobile crash spike

1. Kiểm tra crash dashboard theo app version/platform/device.
2. Xác định crash ảnh hưởng P0 hay chỉ edge case.
3. Nếu blocker, dừng rollout/TestFlight/Play track hoặc bật feature flag tắt flow lỗi.
4. Nếu liên quan upload/camera/GPS, kiểm thử lại trên thiết bị thật trong device matrix.
5. Phát hành hotfix nếu crash-free users dưới ngưỡng beta.

---

## 10. Definition of Done vận hành beta

- Dashboard P0 đã tạo và có owner.
- Alert routing đã cấu hình.
- Có tài khoản admin/on-call rõ ràng.
- Backup/restore staging đã thử ít nhất một lần.
- Object storage private được kiểm tra.
- Log redaction cho OTP/token/GPS/OCR text đã kiểm tra.
- Admin queue có người trực trong tuần beta đầu.
