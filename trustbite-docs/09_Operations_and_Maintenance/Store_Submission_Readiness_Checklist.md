# Checklist submit App Store / Google Play - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Store submission readiness checklist |
| Phiên bản | v1.0.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Release Manager / Mobile Lead / Legal / PO |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Phạm vi

Checklist này dùng trước khi đưa TrustBite lên TestFlight, Google Play Internal/Closed Testing, public beta và production. Checklist này bổ sung cho `Mobile_Release_Checklist.md`, không thay thế test plan kỹ thuật.

---

## 2. Gate chung trước khi submit store

| Gate | Điều kiện pass | Owner |
|---|---|---|
| Build ổn định | Không còn blocker/critical; crash-free smoke test đạt trên device matrix tối thiểu | QA/Mobile |
| Backend review-ready | API/backend/staging/prod reviewer truy cập được; seed data/demo data sẵn sàng | Backend/DevOps |
| Privacy URLs | Privacy Policy, Terms, Support, Account/Data Deletion URL công khai | Legal/PO |
| In-app account deletion | Người dùng tự khởi tạo xóa tài khoản trong app; không chỉ gửi email thủ công | Mobile/Backend |
| UGC safety | Có filter cơ bản, report nội dung, report/block user, moderation queue, support contact | Product/Ops |
| Store declarations | App Privacy/Data Safety/Content Rating/Target Audience/App Access khớp app thực tế | Release Manager/Legal |
| Sensitive permissions | Camera/photo/location chỉ hỏi đúng lúc; Android ưu tiên system picker/Photo Picker | Mobile/Security |
| Reviewer access | Có demo account, OTP/test code hoặc demo mode và hướng dẫn reviewer | Release Manager |
| Monitoring | Crash, API error, receipt upload, OCR queue, admin queue dashboard/alerts bật | DevOps/SRE |

---

## 3. App Store Connect checklist

| Nhóm | Việc cần làm |
|---|---|
| App record | Bundle ID, SKU, category, availability, app name/subtitle/keywords đã chốt. |
| Build | Archive/upload build; TestFlight internal smoke test pass; dSYM/source map upload. |
| App Review Information | Cung cấp demo account hoặc fully-featured demo mode, OTP test flow, backend URL, contact người phụ trách. |
| Privacy Policy | URL công khai và link trong app settings. |
| App Privacy | Khai báo data collection của app và third-party SDKs theo `Store_Privacy_Data_Safety_Mapping.md`. |
| Account deletion | App Settings có “Delete account”; luồng thực sự khởi tạo deletion/anonymization request. |
| UGC | Report review/user, block/restrict user, moderation policy/contact info có trong app/web. |
| Age rating | Hoàn tất questionnaire theo UGC, user interaction, location, web links và age suitability. |
| Export compliance | Trả lời câu hỏi encryption/export compliance theo stack thực tế. |
| Metadata | Description không hứa quá mức; screenshots thể hiện privacy/trust state đúng; support URL hoạt động. |
| Review notes | Giải thích rõ luồng xác minh hóa đơn, GPS optional, admin/manual review và account deletion. |

### 3.1. App Review Notes template

```text
TrustBite is a restaurant review app focused on verified reviews.
Core review flow:
1. Log in with test phone/OTP below.
2. Search/open a restaurant.
3. Create a review.
4. Upload the sample receipt image from the test account or use the seeded demo case.
5. Verification status is shown as Verified, Pending Admin Review, Reference Only, or Rejected.

Test account:
Phone: <test phone>
OTP: <static test OTP or reviewer instruction>

Notes:
- GPS sharing is optional and only requested when the user chooses to add a location signal.
- Receipt images are private and are used for verification/anti-fraud only.
- User-generated reviews can be reported. Users can block abusive users where applicable.
- Account deletion is available at Settings > Account > Delete account.
- Admin portal demo, if needed: <URL/account/instructions>.
```

---

## 4. Google Play Console checklist

| Nhóm | Việc cần làm |
|---|---|
| App bundle | AAB signed by release key; versionCode/versionName tăng đúng; target API level đáp ứng policy hiện hành. |
| Internal/Closed testing | Track, testers, release notes và rollout plan rõ ràng. |
| App access | Cung cấp hướng dẫn truy cập tính năng cần login/OTP/admin nếu reviewer không tự vào được. |
| Privacy Policy | URL công khai trong Store Listing và trong app. |
| Data Safety | Khai báo dữ liệu thu thập/chia sẻ, encryption in transit, deletion request, security practices. |
| App account deletion | Có in-app path và web link/form để request deletion tài khoản/dữ liệu. |
| Content rating | Hoàn tất questionnaire chính xác vì app có UGC/review. |
| Target audience/content | Chọn đúng tuổi mục tiêu; không claim dành cho trẻ em nếu không thiết kế theo Families policy. |
| Permissions declaration | Camera/photo/location chỉ dùng cho receipt/GPS optional; giải thích rõ core functionality. |
| Photo/video permissions | Nếu không cần thư viện rộng, dùng Android Photo Picker/system picker thay vì `READ_MEDIA_IMAGES/VIDEO`. |
| Ads | Baseline MVP không có ads; nếu thêm ads phải cập nhật Data Safety, target audience và SDK register. |
| Store listing | Mô tả không gây hiểu nhầm; screenshots không hiển thị dữ liệu thật/PII; contact support hoạt động. |

---

## 5. Store metadata baseline

| Metadata | Nội dung khuyến nghị |
|---|---|
| Short description | “Đánh giá quán ăn với tín hiệu xác minh từ hóa đơn và quy trình minh bạch.” |
| Long description | Nêu rõ app giúp người dùng xem/viết review, nhãn verified/reference-only, quyền riêng tư hóa đơn/GPS và report nội dung. |
| Không nên viết | “100% review thật”, “không có review giả”, “đảm bảo quán ngon”, “được Apple/Google chứng nhận”. |
| Keywords | restaurant review, food review, verified review, receipt verification, local dining. |
| Support contact | Email/form support có SLA; không dùng email cá nhân nếu release production. |
| Screenshots | Không dùng PII thật; nên có màn hình trust label, upload receipt privacy copy, report review, account settings/delete account. |

---

## 6. Bằng chứng cần lưu trước release

- Ảnh/video smoke test iOS/Android cho luồng OTP → review → receipt upload → verification result.
- Ảnh/video account deletion trong app.
- Ảnh/video report content/user và block/restrict user.
- Export Data Safety/App Privacy answers hoặc checklist đã sign-off.
- Danh sách SDK/vendor thực tế của build.
- Kết quả device matrix và UAT P0.
- Release notes và rollback plan.

---

## 7. Không được submit nếu

- Luồng xóa tài khoản chỉ là “liên hệ support” mà không có in-app trigger.
- Store privacy/data safety không khai báo ảnh hóa đơn, GPS optional hoặc SDK analytics/crash đang dùng.
- App xin quyền photo/video/location ngay khi mở app hoặc xin quyền rộng không cần thiết.
- Reviewer không có cách đăng nhập/kiểm thử do OTP thật không gửi được.
- UGC không có report/block hoặc không có moderation contact.
- Backend/staging/prod tắt, không có seed data, hoặc admin queue không xử lý được case pending.
