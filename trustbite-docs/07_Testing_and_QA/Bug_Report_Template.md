# Mẫu báo cáo lỗi - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Bug report template |
| Phiên bản | v1.0.0 |
| Trạng thái | Bản nháp |
| Chủ sở hữu | QA Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Chuẩn hóa cách báo cáo lỗi để Product, Engineering, QA và Ops có đủ thông tin tái hiện, phân loại, sửa lỗi và xác nhận lại.

---

## 2. Template báo cáo lỗi

```markdown
# BUG-YYYYMMDD-XXX: Tiêu đề ngắn

## Tóm tắt
Mô tả ngắn lỗi xảy ra.

## Môi trường
- Environment: Local / Development / Staging / Beta / Production
- App/Web: Mobile iOS / Mobile Android / Admin Web / Backend API
- Version/build:
- Device/browser:
- User role:
- Test account/user id đã masking:

## Feature/Requirement liên quan
- PRD/Feature ID:
- Test case ID:
- API endpoint nếu có:

## Pre-condition
-

## Steps to reproduce
1.
2.
3.

## Expected result
-

## Actual result
-

## Evidence
- Screenshot/video/log link đã masking:
- requestId/correlationId nếu có:

## Severity
- Blocker / Critical / Major / Minor / Trivial

## Priority
- P0 / P1 / P2 / P3

## Privacy/security impact
- Có/Không
- Nếu có, mô tả dữ liệu bị ảnh hưởng:

## Workaround
-

## Notes
-
```

---

## 3. Severity

| Severity | Định nghĩa | Ví dụ |
|---|---|---|
| Blocker | Chặn release hoặc làm hệ thống P0 không dùng được | Không đăng nhập được OTP trên cả iOS/Android; API production down |
| Critical | Ảnh hưởng nghiêm trọng tới dữ liệu, bảo mật hoặc luồng P0 | Receipt trùng vẫn được VERIFIED; lộ ảnh hóa đơn gốc |
| Major | Luồng chính lỗi nhưng có workaround | Upload receipt lỗi trên một nhóm device; admin queue filter sai |
| Minor | Lỗi nhỏ, không chặn luồng chính | Copy sai, layout lệch nhẹ, trạng thái loading chưa tối ưu |
| Trivial | Rất nhỏ, không ảnh hưởng chức năng | Typo không gây hiểu nhầm |

---

## 4. Priority

| Priority | Ý nghĩa | SLA mục tiêu beta |
|---|---|---:|
| P0 | Phải xử lý trước release hoặc ngay khi production bị ảnh hưởng | Ngay lập tức / trong ngày |
| P1 | Cần xử lý trong sprint/release gần nhất | 1-3 ngày làm việc |
| P2 | Có thể lên kế hoạch sau | Theo backlog |
| P3 | Nice-to-have hoặc cải thiện | Khi có nguồn lực |

---

## 5. Quy tắc dữ liệu nhạy cảm trong bug report

Không đưa trực tiếp các dữ liệu sau vào bug report:

- OTP thật.
- Token/session thô.
- Số điện thoại đầy đủ.
- GPS gốc.
- Ảnh hóa đơn gốc hoặc OCR text đầy đủ.
- Dữ liệu cá nhân chưa masking.

Nếu cần evidence, dùng link nội bộ có quyền truy cập hạn chế hoặc ảnh/log đã che dữ liệu nhạy cảm.

---

## 6. Bug lifecycle đề xuất

```text
New -> Triaged -> In Progress -> Fixed -> Ready for QA -> Verified -> Closed
                         \-> Won't Fix / Duplicate / Cannot Reproduce
```

Quy tắc:

- Bug P0/P1 phải có owner và target release.
- Bug liên quan trạng thái/API/DB phải được kiểm tra regression theo test case liên quan.
- Bug production nghiêm trọng phải tạo incident note trong `Monitoring_and_Incident_Runbook.md` hoặc hệ thống incident thực tế.
