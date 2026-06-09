# Mapping quyền riêng tư cho App Store / Google Play - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Store privacy/data safety mapping |
| Phiên bản | v1.0.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Legal / Security / Product / Mobile Lead |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Tài liệu này chuyển chính sách quyền riêng tư của TrustBite thành checklist khai báo khi submit iOS/Android. Đây là baseline nội bộ cho Product, Legal, Mobile và Release Manager; không thay thế tư vấn pháp lý cuối cùng.

Nguồn sự thật nội bộ:

- `08_Compliance_and_Privacy/Privacy_Policy.md`
- `08_Compliance_and_Privacy/Data_Retention_Policy.md`
- `08_Compliance_and_Privacy/Content_Moderation_Policy.md`
- `01_Product_Management/Product_Analytics_Tracking_Plan.md`
- `09_Operations_and_Maintenance/Store_Submission_Readiness_Checklist.md`

---

## 2. Nguyên tắc khai báo store

- Khai báo theo hành vi thực tế của app và SDK bên thứ ba, không chỉ theo code TrustBite tự viết.
- Nếu iOS và Android thu thập dữ liệu khác nhau, khai báo theo nền tảng tương ứng và giữ bảng mapping riêng khi release.
- Không dùng dữ liệu TrustBite để theo dõi người dùng liên ứng dụng/trang web nếu chưa có quyết định sản phẩm, consent và legal review.
- Ảnh hóa đơn, OCR text, GPS và số điện thoại là dữ liệu nhạy cảm trong vận hành TrustBite; chỉ thu thập đúng thời điểm người dùng chủ động dùng tính năng.
- Mọi thay đổi vendor/SDK analytics, crash, OCR, SMS, map hoặc fraud detection phải cập nhật tài liệu này trước khi submit bản mới.

---

## 3. Bảng mapping dữ liệu MVP

| Nhóm dữ liệu | Ví dụ TrustBite | Mục đích | Thu thập? | Gắn với danh tính? | Chia sẻ/xử lý bởi bên thứ ba | Tracking/quảng cáo | Retention chính |
|---|---|---|---|---|---|---|---|
| Contact info | Số điện thoại OTP | Account management, auth, abuse prevention | Có | Có | SMS/OTP provider nếu dùng | Không | Theo `Data_Retention_Policy.md`; che/mã hóa trong log/admin |
| User content | Nội dung review, điểm số, ảnh/media review nếu bật | App functionality, moderation | Có | Có | Không chia sẻ cho quảng cáo; có thể xử lý bởi moderation tooling nội bộ | Không | Theo vòng đời review và yêu cầu xóa |
| Photos/files | Ảnh hóa đơn, bản ảnh đã che dữ liệu | Verification, anti-fraud | Có, khi người dùng chọn/chụp | Có | OCR provider/object storage nếu dùng | Không | Ảnh gốc mặc định 180 ngày; bản đã che 365 ngày |
| Location | GPS một lần khi người dùng đồng ý | Verification signal/fraud risk | Tùy chọn | Có thể gắn với review/user | Không chia sẻ cho quảng cáo | Không | 30-90 ngày, sau đó xóa/tổng hợp/ẩn danh hóa |
| Identifiers | User ID, session ID, push token hash | Auth, notification, security | Có | Có | Push provider nếu bật notification | Không | Theo session/token policy |
| Diagnostics | Crash logs, performance, request ID | Stability, debugging | Có nếu bật SDK | Có thể gắn thiết bị/user tùy cấu hình | Crash/analytics provider | Không | Ngắn hạn, không chứa OTP/token/GPS/OCR text đầy đủ |
| App activity | Event analytics P0 | Funnel, product health | Có nếu bật analytics | Chỉ dùng user ID giả danh/pseudonymous nếu có thể | Analytics provider nếu dùng | Không | Theo tracking plan; không chứa dữ liệu nhạy cảm |
| Security signals | IP hash, device fingerprint hash, fraud flags | Rate limit, anti-abuse | Có giới hạn | Có thể gắn user/case | Không chia sẻ cho quảng cáo | Không | 30-90 ngày cho hash thiết bị/IP; fraud flags tối đa 2 năm |
| Account deletion | Deletion request, deletion status | Legal/store compliance | Có | Có | Không | Không | Chỉ giữ audit tối thiểu theo retention |

---

## 4. Apple App Privacy / Privacy Nutrition Label baseline

Khi trả lời trong App Store Connect, Release Manager phải kiểm tra tối thiểu:

| Câu hỏi/nhóm | Baseline cho TrustBite MVP |
|---|---|
| Privacy Policy URL | Bắt buộc có URL công khai, truy cập được ngoài app. |
| Data collected by app and partners | Liệt kê số điện thoại, user ID, review content, receipt image/OCR, optional GPS, diagnostics, analytics và dữ liệu bảo mật nếu thu thập. |
| Linked to user | Số điện thoại, user ID, review, receipt verification, GPS theo review thường được xem là có thể liên kết với user. |
| Used for tracking | Baseline MVP: Không. Nếu thêm ads/cross-app tracking phải có quyết định PO + Legal + consent/ATT nếu cần. |
| Third-party SDKs | SMS, OCR, map, analytics, crash reporting và push provider phải được kiểm kê trước submit. |
| Account deletion | App phải có đường dẫn trong app để người dùng tự khởi tạo xóa tài khoản; không chỉ yêu cầu email thủ công. |
| UGC safety | Review/comment là UGC, nên app phải có lọc nội dung, báo cáo vi phạm, chặn người dùng vi phạm và thông tin liên hệ support. |
| Age rating | Phải trả lời questionnaire theo nội dung UGC, khả năng người dùng đăng nội dung, report/block và các tính năng tương tác. |

---

## 5. Google Play Data Safety baseline

| Nhóm khai báo | Baseline cho TrustBite MVP |
|---|---|
| Data Safety form | Khai báo dữ liệu thu thập/chia sẻ, mục đích, mã hóa khi truyền, khả năng yêu cầu xóa. |
| Data deletion | Nếu app cho tạo tài khoản, phải có cả luồng xóa trong app và web link/form để yêu cầu xóa tài khoản/dữ liệu. |
| App access | Cung cấp tài khoản demo hoặc hướng dẫn đầy đủ để reviewer truy cập luồng đăng nhập/admin nếu cần. |
| Content rating | Hoàn tất questionnaire chính xác vì app có UGC/review của người dùng. |
| Target audience | Chọn đối tượng tuổi đúng với chính sách sản phẩm; nếu không nhắm trẻ em, metadata không được ngụ ý “for kids”. |
| Sensitive permissions | Giải thích camera/photo/location đúng core functionality; không xin quyền rộng nếu system picker đủ. |
| Ads declaration | Baseline MVP: Không có ads. Nếu bật ads phải cập nhật privacy/data safety và content policy. |
| Security practices | HTTPS/TLS, private object storage, access control, account deletion và data retention phải khớp tài liệu này. |

---

## 6. Mobile permission declaration

| Platform | Permission/string | Khi hỏi quyền | Copy mục đích tối thiểu |
|---|---|---|---|
| iOS | Camera | Khi người dùng chọn chụp hóa đơn | “TrustBite dùng camera để chụp hóa đơn phục vụ xác minh đánh giá.” |
| iOS | Photo Library / selected photos | Khi người dùng chọn ảnh hóa đơn | “TrustBite dùng ảnh bạn chọn để xác minh đánh giá; ảnh gốc được lưu riêng tư.” |
| iOS | Location When In Use | Khi người dùng chọn chia sẻ GPS | “Vị trí chỉ dùng một lần để tăng tín hiệu xác minh. Bạn có thể từ chối.” |
| Android | Camera | Khi người dùng chọn chụp hóa đơn | Tương tự iOS. |
| Android | Photo Picker / selected media | Khi người dùng chọn ảnh hóa đơn | Ưu tiên Android Photo Picker/system picker; tránh `READ_MEDIA_IMAGES/VIDEO` nếu không thật sự là core need. |
| Android | Fine/Coarse location | Khi người dùng chọn chia sẻ GPS | GPS tùy chọn, không theo dõi liên tục, không chặn luồng nếu từ chối. |
| Android/iOS | Notification | P1/feature flag | Chỉ hỏi sau khi giải thích giá trị; payload không chứa dữ liệu nhạy cảm. |

---

## 7. Vendor/SDK register trước release

| Loại vendor | Cần chốt trước beta | Dữ liệu xử lý | Điều kiện pass |
|---|---|---|---|
| SMS/OTP | Có | Số điện thoại, OTP metadata | DPA/contract, retention, masking log |
| OCR | Có | Ảnh hóa đơn/OCR text | Không dùng dữ liệu để train ngoài phạm vi cho phép; retention rõ |
| Map/geocoding | Có nếu dùng | Vị trí, query địa điểm | Không gửi user ID nếu không cần |
| Analytics | Có nếu dùng | App events | Không gửi số điện thoại, OCR text, GPS gốc, token |
| Crash reporting | Có nếu dùng | Crash logs, device diagnostics | Scrub PII/secrets; dSYM/source map upload an toàn |
| Push provider | P1 nếu bật | Push token, notification metadata | Payload không chứa nội dung nhạy cảm |

---

## 8. Release gate privacy/store

Không submit public beta/production nếu còn một trong các lỗi sau:

- Chưa có Privacy Policy URL công khai.
- Chưa có in-app account deletion và web deletion link/form.
- Data Safety/App Privacy chưa khớp dữ liệu thực tế và SDK đang dùng.
- App xin quyền photo/video/location rộng hơn nhu cầu core mà không có giải thích/review.
- Review/UGC chưa có report, moderation queue, block/restrict user và support contact.
- Crash/analytics log có OTP/token/GPS gốc/OCR text đầy đủ/số điện thoại đầy đủ.
- Không có người chịu trách nhiệm cập nhật store declaration sau mỗi thay đổi vendor/SDK.

---

## 9. Nguồn tham chiếu chính thức

- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple account deletion guidance: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Apple App Store Connect age rating: https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating
- Google Play Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play app account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play prepare app for review: https://support.google.com/googleplay/android-developer/answer/9859455
- Google Play content ratings: https://support.google.com/googleplay/android-developer/answer/9898843
- Google Play target API level: https://support.google.com/googleplay/android-developer/answer/11926878
- Google Play Photo and Video Permissions: https://support.google.com/googleplay/android-developer/answer/15800983
