# Kiến trúc mobile app - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Kiến trúc mobile app |
| Phiên bản | v1.1.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Mobile Lead / Kiến trúc sư trưởng |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Tài liệu này xác định kiến trúc mobile app cho TrustBite MVP. Mobile app là client chính của người dùng cuối, hỗ trợ luồng: đăng nhập OTP, tìm quán, xem chi tiết, gửi đánh giá, tải hóa đơn, GPS tùy chọn, xem kết quả xác minh và hồ sơ người dùng.

Tài liệu này **không chốt màu sắc, layout chi tiết hoặc visual style cuối cùng**. Những quyết định đó sẽ nằm trong design system sau khi có wireframe/prototype được phê duyệt.

---

## 2. Quyết định công nghệ

### Khuyến nghị MVP

| Nhóm | Quyết định đề xuất |
|---|---|
| Framework | React Native |
| Ngôn ngữ | TypeScript |
| Tooling | Expo nếu chưa cần native module phức tạp; chuyển sang prebuild/custom native khi cần |
| State server | TanStack Query |
| State local | Zustand hoặc Context cho state nhỏ |
| Form | React Hook Form + Zod |
| Navigation | React Navigation |
| Secure storage | expo-secure-store hoặc react-native-keychain |
| Image picker/camera | expo-image-picker, expo-camera hoặc package native tương đương |
| Maps | Google Maps hoặc Mapbox |
| Error/crash | Sentry hoặc Firebase Crashlytics |
| Analytics | Firebase Analytics, PostHog hoặc Segment |

### Phương án thay thế

Flutter + Dart được chấp nhận nếu team có năng lực Flutter tốt hơn. Khi chọn Flutter, tài liệu này phải được cập nhật tương ứng với Riverpod/Bloc, Dio, flutter_secure_storage và tooling Flutter release.

---

## 3. Nguyên tắc kiến trúc

- Mobile app chỉ giao tiếp qua API, không truy cập DB trực tiếp.
- Mobile app không tự quyết định gian lận hoặc trạng thái xác minh. Backend là nguồn sự thật.
- Mọi token nhạy cảm phải lưu trong secure storage.
- GPS, camera, photo library và notification phải có consent rõ ràng.
- Upload hóa đơn MVP dùng multipart API kèm `Idempotency-Key` và phải có trạng thái rõ: chưa chọn file, đang tải, đã tải, đang xử lý OCR, chờ admin, verified, reference only, rejected.
- Mọi lỗi P0 phải có thông báo người dùng hiểu được và có mã kỹ thuật để support tra cứu.
- App phải hoạt động được trong điều kiện mạng yếu, ít nhất bằng retry/refetch và thông báo trạng thái đúng.

---

## 4. Cấu trúc module đề xuất

```text
src/
  app/
    navigation/
    providers/
    config/
  features/
    auth/
    restaurants/
    reviews/
    receipts/
    profile/
    moderation/
    gamification/
  shared/
    api/
    components/
    hooks/
    storage/
    permissions/
    analytics/
    errors/
    utils/
```

| Module | Trách nhiệm |
|---|---|
| `auth` | OTP request/verify, logout, refresh/session handling |
| `restaurants` | Tìm kiếm, bản đồ, danh sách, chi tiết quán |
| `reviews` | Tạo đánh giá, validate điểm/bình luận, trạng thái review |
| `receipts` | Chọn/chụp hóa đơn, upload, GPS signal, polling kết quả xác minh |
| `profile` | Hồ sơ, EXP, rank, lịch sử đánh giá |
| `moderation` | Báo cáo đánh giá |
| `gamification` | Hiển thị EXP/rank cơ bản |
| `shared/api` | API client, interceptor auth, error mapping |
| `shared/permissions` | Camera, photo library, GPS, notification |
| `shared/analytics` | Tracking events theo `Product_Analytics_Tracking_Plan.md` |

---

## 5. Navigation MVP

Navigation chi tiết nằm tại `03_UX_UI/Mobile_Navigation_Map.md`. Ở mức kiến trúc, app cần hỗ trợ:

- Auth stack: OTP request, OTP verify.
- Main tabs hoặc structure tương đương:
  - Khám phá quán.
  - Hồ sơ.
  - Thông báo nếu P1 được bật.
- Nested flows:
  - Chi tiết quán → gửi đánh giá → upload hóa đơn → kết quả xác minh.
  - Chi tiết đánh giá → báo cáo đánh giá.

---

## 6. API client

Yêu cầu tối thiểu:

- Base URL theo environment: local, staging, beta, production.
- Bearer token injection.
- Refresh/session handling khi token hết hạn.
- Chuẩn hóa error response theo `API_Specification.md`.
- Timeout mặc định cho request thường và timeout riêng cho upload.
- Retry có kiểm soát cho GET/refetch, không retry bừa bãi cho mutation tạo dữ liệu.
- Idempotency key bắt buộc cho upload hóa đơn và khuyến nghị cho tạo review.

---

## 7. Upload hóa đơn

Mobile app phải hỗ trợ:

- Chọn ảnh từ photo library.
- Chụp ảnh bằng camera nếu được cấp quyền.
- Hỗ trợ JPG, PNG, HEIC theo rule backend.
- Gửi multipart `POST /receipts` kèm `Idempotency-Key` UUID v4.
- Hiển thị dung lượng tối đa 10MB.
- Kiểm tra sơ bộ dung lượng trước upload.
- Không chỉnh sửa ảnh theo cách làm sai hash nếu backend yêu cầu hash file gốc. Nếu có nén ảnh, backend/API phải định nghĩa rõ hash tính trên bản nào.
- Retry upload với cùng payload phải dùng lại cùng `Idempotency-Key`; nếu người dùng chọn file khác phải tạo key mới.
- Cho phép người dùng bỏ qua xác minh hóa đơn để review chuyển `REFERENCE_ONLY`.
- Cho phép người dùng từ chối GPS.
- Hiển thị trạng thái xử lý OCR bất đồng bộ.
- Cho phép refetch trạng thái sau khi app quay lại foreground.

---

## 8. Permission policy

| Permission | Bắt buộc? | Nguyên tắc UX |
|---|---|---|
| Camera | Không | Chỉ hỏi khi người dùng chọn chụp hóa đơn. |
| Photo library | Không | Chỉ hỏi khi người dùng chọn tải ảnh có sẵn. |
| GPS | Không | Giải thích đây là tín hiệu hỗ trợ, từ chối GPS không làm reject tự động. |
| Notification | P1 | Chỉ hỏi sau khi người dùng thấy giá trị, ví dụ nhận kết quả xác minh. |

---

## 9. Offline và mạng yếu

MVP không yêu cầu offline-first đầy đủ. Tuy nhiên phải có:

- Loading state rõ cho mọi request chính.
- Empty state cho danh sách không có dữ liệu.
- Error state cho mất mạng.
- Retry/refetch thủ công cho tìm kiếm, chi tiết quán, trạng thái hóa đơn.
- Không mất dữ liệu form review nếu upload hóa đơn lỗi ngắn hạn.
- Khi app bị kill trong lúc OCR xử lý, trạng thái phải được lấy lại từ backend khi mở app.

---

## 10. Observability

Mobile app phải tích hợp:

- Crash reporting.
- Non-fatal error logging cho lỗi upload, permission, API 5xx, token refresh.
- Product analytics theo tracking plan.
- App version/build number trong mọi crash/error event.
- Environment tag: staging, beta, production.

---

## 11. Definition of Done cho mobile MVP

- Chạy được trên iOS và Android theo device matrix.
- Hoàn tất luồng P0 từ đăng nhập đến kết quả xác minh.
- Token lưu an toàn.
- Upload hóa đơn xử lý được HEIC/JPG/PNG theo yêu cầu.
- GPS từ chối vẫn tiếp tục được flow.
- Crash-free rate beta đạt ngưỡng do PO/Engineering thống nhất.
- 100% mobile P0 test case đạt.
