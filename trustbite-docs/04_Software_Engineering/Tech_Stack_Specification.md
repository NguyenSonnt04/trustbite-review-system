# Đặc tả công nghệ sử dụng - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Đặc tả công nghệ sử dụng |
| Phiên bản | v2.7.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Kiến trúc sư trưởng |
| Ngày cập nhật | 2026-06-09 |

---

## 1. Định hướng client

TrustBite được định hướng là **sản phẩm mobile-first**. Ứng dụng người dùng chính là mobile app. Web được dùng cho cổng quản trị, cổng chủ quán và các tác vụ vận hành cần màn hình lớn.

| Bề mặt | Mục tiêu | Công nghệ MVP theo task manager |
|---|---|---|
| Mobile app người dùng | Tìm quán, xem đánh giá, gửi đánh giá, tải hóa đơn, GPS tùy chọn, hồ sơ, thông báo | Flutter + Dart |
| Admin portal | Hàng đợi hóa đơn, kiểm duyệt, duyệt claim, audit log, quản lý vận hành | Next.js |
| Merchant portal | Claim quán, cập nhật thông tin, phản hồi đánh giá | Next.js + TypeScript ở V1.1, hoặc mobile/web hybrid nếu dữ liệu beta yêu cầu |
| Backend API | API chung cho mobile, admin và merchant | Node.js + Express native ES modules trong repo hiện tại |

---

## 2. Quyết định mobile framework

### Stack chuẩn MVP: Flutter + Dart

Task manager của team chốt mobile MVP dùng Flutter + Dart. Các story mobile mới phải giả định Flutter trừ khi có quyết định chính thức đổi framework.

| Nhóm | Công nghệ đề xuất |
|---|---|
| Framework | Flutter |
| Ngôn ngữ | Dart |
| Navigation | go_router |
| State management | Riverpod hoặc Bloc |
| API client | Dio; code generation chỉ thêm khi story cần contract mạnh hơn |
| Secure storage | flutter_secure_storage |
| Upload ảnh | image_picker hoặc camera |
| Bản đồ | google_maps_flutter hoặc mapbox_maps_flutter |
| Crash reporting | Sentry hoặc Firebase Crashlytics |
| Analytics | Firebase Analytics, PostHog hoặc Segment |

### Phương án tương lai: React Native + TypeScript

React Native + TypeScript không phải stack MVP hiện tại. Chỉ dùng nếu team tạo story/decision đổi framework và cập nhật lại mobile architecture, QA matrix, release checklist và CI.

### Tiêu chí đổi framework

| Tiêu chí | React Native | Flutter |
|---|---|---|
| Đồng bộ với TypeScript nếu backend/admin đổi stack | Mạnh | Trung bình |
| Tốc độ MVP nếu team biết React | Mạnh | Trung bình |
| UI đồng nhất đa nền tảng | Tốt | Mạnh |
| Khả năng tận dụng web/admin TypeScript | Mạnh | Thấp |
| Cộng đồng mobile package | Mạnh | Mạnh |
| Rủi ro khi thiếu kinh nghiệm native | Trung bình | Trung bình |

Vì task manager đã chốt Flutter + Dart, bảng trên chỉ dùng cho quyết định đổi framework trong tương lai, không dùng để mở lại scope MVP mặc định.

---

## 3. Backend

| Nhóm | Công nghệ |
|---|---|
| Runtime | Node.js 20+ LTS |
| Framework | Express native ES modules |
| Ngôn ngữ | JavaScript hiện tại; TypeScript chỉ thêm theo story chuyển đổi riêng |
| Database access | `pg` pool hoặc lớp repository/service mỏng theo pattern repo hiện tại |
| Database | PostgreSQL 15+ + PostGIS |
| Queue | BullMQ + Redis |
| Auth | OTP SMS + access token + refresh/session token |
| Lưu trữ file | S3-compatible object storage |
| OCR | AWS Textract hoặc OCR provider tương đương |

Ghi chú:

- MVP dùng đăng nhập OTP nên không lưu mật khẩu. Nếu sau này bổ sung đăng nhập bằng mật khẩu, chính sách hash mật khẩu phải được tài liệu hóa riêng.
- NestJS, Prisma ORM và TypeScript strict mode là phương án tương lai/alternative. Không áp dụng convention NestJS/Prisma cho code hiện tại nếu chưa có story/decision chuyển stack.

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
| Merchant mobile app | Flutter hoặc module merchant trong app hiện tại nếu chủ quán cần app riêng sau V1.1 |
| Push notification nâng cao | Firebase Cloud Messaging, APNs, notification orchestration service |
