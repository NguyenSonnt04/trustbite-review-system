# Checklist release mobile - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Mobile release checklist |
| Phiên bản | v1.3.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Mobile Lead / DevOps / QA Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Phạm vi

Checklist dùng cho TestFlight, Google Play Internal Testing, beta và production release của mobile app TrustBite.

---

## 2. Trước khi build

- Version name và build number đã tăng.
- Environment config đúng: staging, beta hoặc production.
- API base URL đúng.
- Không có secret nhạy cảm trong app bundle.
- Feature flag đúng với phạm vi release.
- Privacy copy cho hóa đơn/GPS đã được QA và Legal/PO kiểm tra theo `Privacy_Policy.md` và `03_UX_UI/UX_Writing_Guidelines.md`.
- Analytics/crash reporting bật đúng environment.
- Source map/dSYM mapping được upload nếu dùng Sentry/Crashlytics.

---

## 3. Trước khi gửi beta

- 100% mobile P0 test case đạt.
- Upload hóa đơn multipart kiểm thử trên iOS và Android.
- Retry upload cùng `Idempotency-Key` không tạo receipt trùng.
- HEIC iOS kiểm thử nếu app hỗ trợ HEIC.
- GPS denied không chặn flow.
- Skip verification chuyển review sang REFERENCE_ONLY.
- Logout xóa token local.
- App mở lại được trạng thái OCR pending bằng refetch/polling.
- Không log OTP/token/GPS gốc/OCR text trong crash/analytics.
- Backend staging/beta có seed data, OCR mock/provider ổn định và admin portal xử lý được case pending.
- Dashboard monitoring P0 và alert routing đã bật theo `Monitoring_and_Incident_Runbook.md`.
- Luồng xóa tài khoản trong app, web deletion link, report/block và support contact đã QA đạt.
- App Store/Play Store reviewer notes có demo account, OTP strategy/test OTP, seed data và giải thích receipt/GPS không hiển nhiên.

---

## 4. Store metadata tối thiểu

| Nhóm | Yêu cầu |
|---|---|
| App name | TrustBite hoặc tên được phê duyệt |
| Description | Nêu rõ đánh giá có xác minh bằng hóa đơn, không hứa quá mức |
| Privacy | Khai báo số điện thoại, ảnh hóa đơn, GPS tùy chọn, analytics/crash nếu có |
| Screenshots | Chưa cần chốt visual trong tài liệu này, nhưng phải đúng chức năng release |
| Support contact | Email hoặc form support |
| Data deletion | Có luồng trong app và web link/form yêu cầu xóa tài khoản/dữ liệu |
| Data Safety / App Privacy | Khớp `Store_Privacy_Data_Safety_Mapping.md`; khai báo SDK bên thứ ba và dữ liệu thực tế |
| UGC safety | Metadata/support notes nêu report, block, moderation và contact channel |
| Content/Age rating | Questionnaire trả lời đúng UGC, tương tác người dùng, report/block và nội dung review |
| Android target API | Target API đáp ứng yêu cầu hiện hành của Google Play cho bản submit |
| Android media permission | Ưu tiên system picker/Photo Picker; không xin quyền broad media nếu không phải core use case |

---

## 5. Production readiness

- Backend production đã backup và monitoring.
- Rate limit OTP/upload/review bật.
- Object storage private.
- Admin portal hoạt động để xử lý receipt/moderation/claim pending.
- Có người trực xử lý hàng đợi trong thời gian beta đầu.
- Rollback plan có sẵn theo `Deployment_Guide.md`.
- Crash dashboard, API error dashboard, receipt upload dashboard và OCR queue dashboard có người theo dõi.
- Store metadata có link privacy/data deletion/support.
- Store submission checklist đã được PO/Legal/Release Manager sign off.
- App Store Connect privacy details và Google Play Data Safety đã khớp hành vi app/SDK.
- Reviewer access hoạt động trong thời gian review và backend production/staging review environment online.
- Release note đã được tạo/cập nhật trong `Release_Notes.md`.

---

## 6. Sau release

- Theo dõi crash-free users.
- Theo dõi OTP success rate.
- Theo dõi receipt upload success rate.
- Theo dõi verification result distribution.
- Theo dõi pending admin queue SLA.
- Theo dõi OCR queue oldest job age và dead-letter queue.
- Theo dõi duplicate receipt hash và rejected rate bất thường.
- Triage lỗi blocker/critical hằng ngày trong beta.
