# Đặc tả công nghệ sử dụng - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Đặc tả công nghệ sử dụng |
| Phiên bản | v2.2.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Kiến trúc sư trưởng |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Định hướng client

TrustBite được định hướng là **sản phẩm mobile-first**. Ứng dụng người dùng chính là mobile app. Web được dùng cho cổng quản trị, cổng chủ quán và các tác vụ vận hành cần màn hình lớn.

| Bề mặt | Mục tiêu | Công nghệ khuyến nghị |
|---|---|---|
| Mobile app người dùng | Tìm quán, xem đánh giá, gửi đánh giá, tải hóa đơn, GPS tùy chọn, hồ sơ, thông báo | React Native + TypeScript hoặc Flutter + Dart |
| Admin portal | Hàng đợi hóa đơn, kiểm duyệt, duyệt claim, audit log, quản lý vận hành | Next.js + TypeScript |
| Merchant portal | Claim quán, cập nhật thông tin, phản hồi đánh giá | Next.js + TypeScript ở V1.1, hoặc mobile/web hybrid nếu dữ liệu beta yêu cầu |
| Backend API | API chung cho mobile, admin và merchant | NestJS + TypeScript |

---

## 2. Khuyến nghị lựa chọn mobile framework

### Phương án ưu tiên cho MVP: React Native + TypeScript

React Native phù hợp nếu team muốn tối ưu tốc độ MVP và giữ hệ sinh thái TypeScript xuyên suốt từ mobile, admin web đến backend.

| Nhóm | Công nghệ đề xuất |
|---|---|
| Framework | React Native |
| Ngôn ngữ | TypeScript |
| Runtime/tooling | Expo nếu ưu tiên tốc độ MVP; React Native CLI nếu cần native module tùy biến sớm |
| Navigation | React Navigation |
| Server state | TanStack Query |
| Client state | Zustand |
| Form validation | React Hook Form + Zod |
| Secure storage | expo-secure-store hoặc react-native-keychain |
| Upload ảnh | expo-image-picker hoặc react-native-image-picker |
| Camera | expo-camera hoặc react-native-vision-camera nếu cần kiểm soát cao |
| Bản đồ | Google Maps hoặc Mapbox |
| Crash reporting | Sentry hoặc Firebase Crashlytics |
| Analytics | Firebase Analytics, PostHog hoặc Segment |

### Phương án thay thế: Flutter + Dart

Flutter phù hợp nếu team ưu tiên UI đồng nhất, hiệu năng ổn định và có năng lực Dart/mobile-native tốt.

| Nhóm | Công nghệ đề xuất |
|---|---|
| Framework | Flutter |
| Ngôn ngữ | Dart |
| Navigation | go_router |
| State management | Riverpod hoặc Bloc |
| API client | Dio + code generation |
| Secure storage | flutter_secure_storage |
| Upload ảnh | image_picker hoặc camera |
| Bản đồ | google_maps_flutter hoặc mapbox_maps_flutter |
| Crash reporting | Sentry hoặc Firebase Crashlytics |
| Analytics | Firebase Analytics, PostHog hoặc Segment |

### Tiêu chí chốt framework

| Tiêu chí | React Native | Flutter |
|---|---|---|
| Đồng bộ với backend TypeScript/NestJS | Mạnh | Trung bình |
| Tốc độ MVP nếu team biết React | Mạnh | Trung bình |
| UI đồng nhất đa nền tảng | Tốt | Mạnh |
| Khả năng tận dụng web/admin TypeScript | Mạnh | Thấp |
| Cộng đồng mobile package | Mạnh | Mạnh |
| Rủi ro khi thiếu kinh nghiệm native | Trung bình | Trung bình |

Quyết định framework phải được ghi vào `04_Software_Engineering/Mobile_App_Architecture.md` trước khi bắt đầu implementation.

---

## 3. Backend

| Nhóm | Công nghệ |
|---|---|
| Runtime | Node.js 20+ LTS |
| Framework | NestJS |
| Ngôn ngữ | TypeScript |
| ORM | Prisma ORM |
| Database | PostgreSQL 15+ + PostGIS |
| Queue | BullMQ + Redis |
| Auth | OTP SMS + access token + refresh/session token |
| Lưu trữ file | S3-compatible object storage |
| OCR | AWS Textract hoặc OCR provider tương đương |

Ghi chú: MVP dùng đăng nhập OTP nên không lưu mật khẩu. Nếu sau này bổ sung đăng nhập bằng mật khẩu, chính sách hash mật khẩu phải được tài liệu hóa riêng.

---

## 4. Hạ tầng

| Nhóm | Khuyến nghị MVP |
|---|---|
| Mobile distribution | TestFlight cho iOS, Google Play Internal Testing cho Android |
| Admin/Merchant web hosting | Vercel, Amplify hoặc S3 + CloudFront |
| API deployment | Container managed hoặc ECS Fargate |
| Worker deployment | Container worker tách khỏi API |
| Database | Managed PostgreSQL có backup |
| Redis | Managed Redis hoặc self-hosted ở staging |
| Secrets | Cloud secret manager hoặc inject biến môi trường an toàn |
| Observability | Log có cấu trúc, error tracking, metric hàng đợi, crash reporting mobile |
| CI/CD | Pipeline build, lint, test, deploy API/web và release mobile |

---

## 5. Thư viện / thực hành bảo mật

- Validate request bằng DTO/Zod/class-validator hoặc schema generated từ OpenAPI.
- Giới hạn tần suất cho OTP, gửi đánh giá và tải hóa đơn.
- Kiểm tra MIME/type và dung lượng file upload ở cả mobile client và backend.
- Dùng signed URL hoặc multipart API có kiểm soát cho hóa đơn riêng tư.
- Lưu token mobile trong secure storage, không lưu trong async storage/plain storage.
- Có refresh/session lifecycle rõ ràng cho mobile app.
- Ghi audit log cho quyết định của quản trị viên.
- Không lưu secret dạng plaintext trong mã nguồn.
- Không ghi OTP, token, toàn bộ text hóa đơn hoặc GPS gốc vào log.

---

## 6. Ứng viên công nghệ tương lai

| Tính năng | Ứng viên công nghệ |
|---|---|
| Tóm tắt AI | AWS Bedrock hoặc LLM provider bên ngoài |
| Gian lận nâng cao | Graph analytics service hoặc data warehouse |
| Tìm kiếm quy mô lớn | OpenSearch hoặc search service chuyên dụng |
| Merchant mobile app | React Native/Flutter nếu chủ quán cần app riêng sau V1.1 |
| Push notification nâng cao | Firebase Cloud Messaging, APNs, notification orchestration service |
