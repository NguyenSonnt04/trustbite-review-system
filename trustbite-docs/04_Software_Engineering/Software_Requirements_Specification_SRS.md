# Đặc tả yêu cầu phần mềm - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Đặc tả yêu cầu phần mềm |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Trưởng nhóm kỹ thuật |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu SRS

Tài liệu này chuyển yêu cầu sản phẩm và phân tích nghiệp vụ thành yêu cầu phần mềm theo module. SRS là nguồn tham chiếu cho frontend, backend, QA và DevOps khi triển khai MVP.

---

## 2. Nguyên tắc triển khai MVP

- TrustBite là sản phẩm mobile-first: mobile app là client chính cho người dùng cuối.
- Admin portal là web app riêng cho vận hành, kiểm duyệt và audit.
- Merchant portal đầy đủ thuộc P1/V1.1; MVP chỉ cần admin/manual claim tối thiểu nếu cần kiểm chứng giả thuyết chủ quán.
- Upload hóa đơn MVP dùng multipart API kèm `Idempotency-Key`; signed upload thuộc P1 khi cần scale.
- Review bỏ qua hóa đơn hoặc không upload trong 24 giờ chuyển `REFERENCE_ONLY`.
- Notification không chặn MVP; mobile dùng polling/refetch trạng thái từ API.
- Ưu tiên luồng lõi: Xác thực → Quán → Đánh giá → Xác minh hóa đơn hoặc Reference-only → Quyết định của quản trị viên.
- OCR/GPS là tín hiệu xác minh, không phải quy tắc tuyệt đối ngoại trừ hash hóa đơn trùng.
- Tóm tắt AI, nhiệm vụ bí mật, hoàn tiền và đồ thị hành vi AI thuộc tương lai, không thuộc MVP.
- Mọi trạng thái nghiệp vụ phải đồng bộ với `02_Business_Analysis/State_Machines.md` và `02_Business_Analysis/Status_Mapping.md`.
- Mọi API phải đồng bộ với `04_Software_Engineering/API_Specification.md`, `04_Software_Engineering/OpenAPI_Guidelines.md` và `04_Software_Engineering/openapi.yaml`.
- Idempotency/retry cho upload hóa đơn phải theo `04_Software_Engineering/Idempotency_and_Retry_Design.md`.
- Mọi bảng dữ liệu phải đồng bộ với `06_Database_Design/PostgreSQL_Database_Schema.md`, `Data_Dictionary.md` và `Migration_and_Seed_Plan.md`.
- Mọi yêu cầu mobile phải đồng bộ với `04_Software_Engineering/Mobile_App_Architecture.md` và `07_Testing_and_QA/Mobile_Test_Plan.md`.
- Luồng xóa tài khoản trong app, web deletion link/form, report/block UGC và reviewer access là P0 trước public beta/store submission.
- Store privacy/data safety phải khớp hành vi thực tế của app, SDK và backend trước mỗi bản submit.

---

## 3. Yêu cầu theo module

### 3.1. Module xác thực

| Thành phần | Nội dung |
|---|---|
| Mục đích | Xác thực người dùng bằng số điện thoại và OTP. |
| Tác nhân | Khách chưa đăng nhập, người dùng đã đăng ký, quản trị viên |
| Yêu cầu chức năng | AUTH-001 gửi OTP; AUTH-002 xác thực OTP; AUTH-003 đăng xuất; AUTH-004 giới hạn tần suất OTP. |
| Quy tắc nghiệp vụ | OTP 6 số; hết hạn 120 giây; tối đa 3 lần gửi/10 phút/số điện thoại; tối đa 5 lần nhập sai. |
| Phụ thuộc API | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/logout` |
| Phụ thuộc dữ liệu | `users`, `otp_verifications`, `audit_logs` |
| Xử lý ngoại lệ | OTP sai, hết hạn, vượt giới hạn tần suất, số điện thoại không hợp lệ. |
| Tiêu chí nghiệm thu | Người dùng nhập OTP đúng còn hạn thì đăng nhập thành công; vượt giới hạn tần suất thì bị từ chối. |

### 3.2. Module hồ sơ người dùng

| Thành phần | Nội dung |
|---|---|
| Mục đích | Quản lý hồ sơ người dùng, trạng thái tài khoản, cấp hạng và quyền đánh giá. |
| Tác nhân | Người dùng đã đăng ký, quản trị viên |
| Yêu cầu chức năng | USER-001 xem hồ sơ; USER-002 cập nhật tên/avatar; USER-003 xem EXP/cấp hạng; USER-004 quản trị viên khóa/mở tài khoản; USER-005 yêu cầu xóa tài khoản; USER-006 xem trạng thái yêu cầu xóa tài khoản. |
| Quy tắc nghiệp vụ | Người dùng `SUSPENDED` không được viết đánh giá; hành động của quản trị viên phải ghi audit log; yêu cầu xóa tài khoản phải revoke session và xóa/ẩn danh hóa PII theo retention. |
| Phụ thuộc API | `GET /users/me`, `PATCH /users/me`, `POST /users/me/deletion-request`, `GET /users/me/deletion-request`, `POST /users/me/deletion-request/cancel`, `GET /users/{userId}` |
| Phụ thuộc dữ liệu | `users`, `user_sessions`, `account_deletion_requests`, `user_badges`, `audit_logs` |
| Xử lý ngoại lệ | Người dùng không tồn tại, dữ liệu không hợp lệ, thiếu quyền. |
| Tiêu chí nghiệm thu | Người dùng đăng nhập xem được hồ sơ; khi quản trị viên khóa tài khoản thì người dùng không gửi được đánh giá; người dùng tự gửi được yêu cầu xóa tài khoản và thấy trạng thái xử lý rõ ràng. |

### 3.3. Module khám phá quán

| Thành phần | Nội dung |
|---|---|
| Mục đích | Tìm kiếm và xem danh sách quán theo vị trí, từ khóa và bộ lọc. |
| Tác nhân | Khách chưa đăng nhập, người dùng đã đăng ký |
| Yêu cầu chức năng | REST-001 tìm kiếm; REST-002 liệt kê theo khung bản đồ; REST-003 lọc theo điểm tin cậy; REST-004 sắp xếp theo khoảng cách. |
| Quy tắc nghiệp vụ | Chỉ hiển thị công khai quán `ACTIVE`; kết quả nên ưu tiên quán có nhiều đánh giá xác minh và điểm tin cậy cao. |
| Phụ thuộc API | `GET /restaurants`, `GET /restaurants/nearby` |
| Phụ thuộc dữ liệu | `restaurants`, `restaurant_branches`, `reviews`, `favorites` |
| Xử lý ngoại lệ | Từ khóa rỗng, khung bản đồ sai, provider bản đồ lỗi. |
| Tiêu chí nghiệm thu | Tìm kiếm trả danh sách quán ACTIVE phù hợp và có metadata điểm tin cậy. |

### 3.4. Module chi tiết quán

| Thành phần | Nội dung |
|---|---|
| Mục đích | Hiển thị hồ sơ quán, phân rã điểm đánh giá, đánh giá và phản hồi của chủ quán. |
| Tác nhân | Khách chưa đăng nhập, người dùng, chủ quán, quản trị viên |
| Yêu cầu chức năng | REST-005 xem chi tiết; REST-006 xem đánh giá; REST-007 xem menu cơ bản. |
| Quy tắc nghiệp vụ | Đánh giá `HIDDEN/DELETED` không hiển thị công khai; đánh giá xác minh/tham khảo phải phân biệt rõ. |
| Phụ thuộc API | `GET /restaurants/{restaurantId}`, `GET /restaurants/{restaurantId}/reviews` |
| Phụ thuộc dữ liệu | `restaurants`, `reviews`, `review_media`, `menu_items` |
| Xử lý ngoại lệ | Quán không tồn tại, không ACTIVE, thiếu quyền xem dữ liệu quản trị. |
| Tiêu chí nghiệm thu | Người dùng thấy thông tin quán và đánh giá hợp lệ; quản trị viên có thể xem trạng thái nội bộ. |

### 3.5. Module đánh giá

| Thành phần | Nội dung |
|---|---|
| Mục đích | Cho phép người dùng tạo đánh giá 4 tiêu chí và theo dõi trạng thái xác minh. |
| Tác nhân | Người dùng đã đăng ký, người đánh giá đã xác minh, quản trị viên |
| Yêu cầu chức năng | REV-001 tạo đánh giá; REV-002 cập nhật draft; REV-003 tải media; REV-004 xóa mềm; REV-005 bình chọn hữu ích. |
| Quy tắc nghiệp vụ | Điểm 1-5; bình luận tối thiểu 50 ký tự; chủ quán không được đánh giá quán của mình; đánh giá có state machine riêng; người dùng có thể bỏ qua hóa đơn để review thành `REFERENCE_ONLY`; review `SUBMITTED` không có receipt sau 24 giờ tự chuyển `REFERENCE_ONLY`. |
| Phụ thuộc API | `POST /reviews`, `GET /reviews/{reviewId}`, `PATCH /reviews/{reviewId}`, `POST /reviews/{reviewId}/skip-verification`, `DELETE /reviews/{reviewId}` |
| Phụ thuộc dữ liệu | `reviews`, `review_media`, `review_votes`, `receipt_verifications` |
| Xử lý ngoại lệ | Bình luận quá ngắn, thiếu điểm, quán không ACTIVE, người dùng bị khóa quyền. |
| Tiêu chí nghiệm thu | Đánh giá hợp lệ tạo trạng thái `SUBMITTED`; đánh giá chỉ thành `VERIFIED` sau khi xác minh đạt hoặc quản trị viên duyệt; đánh giá bỏ qua/quá hạn upload hóa đơn chuyển `REFERENCE_ONLY`. |

### 3.6. Module xác minh hóa đơn

| Thành phần | Nội dung |
|---|---|
| Mục đích | Xử lý tải hóa đơn, kiểm tra hash, OCR, điểm rủi ro và quyết định xác minh. |
| Tác nhân | Người dùng đã đăng ký, hệ thống, quản trị viên |
| Yêu cầu chức năng | OCR-001 tải hóa đơn; OCR-002 kiểm tra trùng hash; OCR-003 OCR; OCR-004 chấm điểm rủi ro; OCR-005 quyết định thủ công. |
| Quy tắc nghiệp vụ | Multipart upload kèm `Idempotency-Key`; JPG/PNG/HEIC; tối đa 10MB; hash trùng bị từ chối/tạo cờ gian lận; OCR 60-79% chuyển quản trị viên rà soát; hóa đơn quá 48h tăng điểm rủi ro. |
| Phụ thuộc API | `POST /receipts`, `GET /receipts/{receiptVerificationId}`, `POST /admin/receipt-verifications/{receiptVerificationId}/decision` |
| Phụ thuộc dữ liệu | `receipt_verifications`, `fraud_flags`, `reviews`, `audit_logs` |
| Xử lý ngoại lệ | File sai định dạng, OCR timeout, hash trùng, lỗi lưu trữ. |
| Tiêu chí nghiệm thu | Hóa đơn rủi ro thấp tự động xác minh; rủi ro trung bình chuyển quản trị viên; hash trùng bị từ chối và tạo fraud flag; mobile retry cùng idempotency key không tạo receipt trùng. |

### 3.7. Module xác minh GPS

| Thành phần | Nội dung |
|---|---|
| Mục đích | Ghi nhận vị trí người dùng nếu được cho phép và tính rủi ro khoảng cách. |
| Tác nhân | Người dùng đã đăng ký, hệ thống |
| Yêu cầu chức năng | GPS-001 ghi nhận GPS; GPS-002 tính khoảng cách Haversine; GPS-003 thêm tín hiệu rủi ro. |
| Quy tắc nghiệp vụ | GPS tùy chọn; không có GPS không tự động từ chối; khoảng cách càng xa càng tăng điểm rủi ro. |
| Phụ thuộc API | Payload trong `POST /receipts` hoặc `POST /reviews/{reviewId}/gps` |
| Phụ thuộc dữ liệu | `receipt_verifications`, `fraud_flags` |
| Xử lý ngoại lệ | Người dùng từ chối quyền, độ chính xác thấp, tọa độ không hợp lệ. |
| Tiêu chí nghiệm thu | GPS trong 200m không tăng rủi ro; GPS không bật chỉ cộng rủi ro theo rule. |

### 3.8. Module điểm tin cậy

| Thành phần | Nội dung |
|---|---|
| Mục đích | Tính điểm tin cậy của quán dựa trên đánh giá có trọng số. |
| Tác nhân | Hệ thống, quản trị viên |
| Yêu cầu chức năng | TRUST-001 tính lại điểm; TRUST-002 phân rã điểm; TRUST-003 loại trừ đánh giá ẩn/xóa. |
| Quy tắc nghiệp vụ | Đánh giá xác minh có trọng số cao hơn đánh giá tham khảo; đánh giá bị từ chối không tính; điểm có thể cập nhật bằng job bất đồng bộ. |
| Phụ thuộc API | Internal job; `GET /restaurants/{id}` hiển thị kết quả. |
| Phụ thuộc dữ liệu | `reviews`, `users`, `restaurants` |
| Xử lý ngoại lệ | Không có đánh giá, job lỗi, dữ liệu thiếu. |
| Tiêu chí nghiệm thu | Khi trạng thái đánh giá đổi, điểm tin cậy được cập nhật lại trong SLA backend định nghĩa. |

### 3.9. Module chống gian lận

| Thành phần | Nội dung |
|---|---|
| Mục đích | Ghi nhận tín hiệu rủi ro và đưa ra quyết định xác minh theo điểm. |
| Tác nhân | Hệ thống, quản trị viên |
| Yêu cầu chức năng | FRAUD-001 tính rủi ro; FRAUD-002 tạo cờ gian lận; FRAUD-003 quản trị viên rà soát; FRAUD-004 audit quyết định. |
| Quy tắc nghiệp vụ | Theo chấm điểm rủi ro trong `Anti_Fraud_Specification.md`; điểm >=100 thì từ chối/tạo cờ gian lận. |
| Phụ thuộc API | Service nội bộ; endpoint quản trị. |
| Phụ thuộc dữ liệu | `fraud_flags`, `receipt_verifications`, `reviews`, `audit_logs` |
| Xử lý ngoại lệ | Thiếu tín hiệu, OCR lỗi, quyết định xung đột. |
| Tiêu chí nghiệm thu | Mọi cờ gian lận có nguồn, điểm, lý do và liên kết entity. |

### 3.10. Module cổng chủ quán

| Thành phần | Nội dung |
|---|---|
| Mục đích | Cho chủ quán claim quán, cập nhật thông tin và phản hồi đánh giá. |
| Tác nhân | Chủ quán, quản trị viên |
| Yêu cầu chức năng | MERCH-001 claim quán; MERCH-002 cập nhật hồ sơ; MERCH-003 phản hồi đánh giá; MERCH-004 báo cáo đánh giá. |
| Quy tắc nghiệp vụ | Claim cần quản trị viên duyệt; chủ quán không được xóa đánh giá; chủ quán không được đánh giá quán của mình. |
| Phụ thuộc API | `POST /merchant/claims`, `PATCH /merchant/restaurants/{restaurantId}`, `POST /merchant/reviews/{reviewId}/reply` |
| Phụ thuộc dữ liệu | `merchants`, `restaurant_claims`, `restaurants`, `audit_logs` |
| Xử lý ngoại lệ | Claim trùng, thiếu giấy tờ, chủ quán chưa được xác minh. |
| Tiêu chí nghiệm thu | Chủ quán chỉ chỉnh được quán đã claim approved. |

### 3.11. Module cổng quản trị

| Thành phần | Nội dung |
|---|---|
| Mục đích | Cung cấp hàng đợi vận hành để quản trị viên xử lý quán, hóa đơn, đánh giá, báo cáo và người dùng. |
| Tác nhân | Quản trị viên, siêu quản trị |
| Yêu cầu chức năng | ADM-001 hàng đợi rà soát; ADM-002 quyết định case; ADM-003 quản lý người dùng; ADM-004 audit log. |
| Quy tắc nghiệp vụ | Mọi quyết định cần lý do; siêu quản trị quản lý quản trị viên; hành động quan trọng ghi audit log. |
| Phụ thuộc API | `/admin/*` endpoints |
| Phụ thuộc dữ liệu | `audit_logs`, `moderation_reports`, `moderation_actions`, `receipt_verifications` |
| Xử lý ngoại lệ | Thiếu quyền, case đã xử lý, quyết định xung đột. |
| Tiêu chí nghiệm thu | Quyết định của quản trị viên cập nhật trạng thái entity và ghi audit log. |

### 3.12. Module thông báo

| Thành phần | Nội dung |
|---|---|
| Mục đích | Gửi thông báo cho người dùng/chủ quán/quản trị viên khi có sự kiện quan trọng. |
| Tác nhân | Người dùng, chủ quán, quản trị viên, hệ thống |
| Yêu cầu chức năng | NOTIF-001 tạo thông báo; NOTIF-002 đánh dấu đã đọc; NOTIF-003 liệt kê thông báo. |
| Quy tắc nghiệp vụ | Notification là P1 và không chặn MVP; MVP dùng polling/refetch trạng thái từ API. Nếu bật notification bằng feature flag, không gửi dữ liệu nhạy cảm trong payload. |
| Phụ thuộc API | P1: `GET /notifications`, `PATCH /notifications/{notificationId}/read`; MVP bắt buộc `GET /receipts/{receiptVerificationId}` và `GET /reviews/{reviewId}` để refetch trạng thái. |
| Phụ thuộc dữ liệu | `notifications` |
| Xử lý ngoại lệ | Người nhận không tồn tại, payload lỗi. |
| Tiêu chí nghiệm thu | MVP không cần notification để pass release; khi notification feature flag bật, quyết định quản trị tạo notification đúng loại và payload không chứa dữ liệu nhạy cảm. |

### 3.13. Module kiểm duyệt

| Thành phần | Nội dung |
|---|---|
| Mục đích | Xử lý báo cáo đánh giá/nội dung vi phạm và áp dụng hành động kiểm duyệt. |
| Tác nhân | Người dùng, chủ quán, quản trị viên |
| Yêu cầu chức năng | MOD-001 gửi báo cáo; MOD-002 phân loại; MOD-003 xử lý; MOD-004 đóng báo cáo; MOD-005 chặn/bỏ chặn người dùng. |
| Quy tắc nghiệp vụ | Một người dùng không tạo báo cáo mở trùng cùng lý do/đánh giá; hành động cần lý do; người dùng không được tự chặn chính mình. |
| Phụ thuộc API | `POST /moderation/reports`, `POST /users/{userId}/block`, `DELETE /users/{userId}/block`, `GET /admin/moderation/reports`, `POST /admin/moderation/reports/{reportId}/decision` |
| Phụ thuộc dữ liệu | `moderation_reports`, `moderation_actions`, `reviews`, `user_blocks`, `audit_logs` |
| Xử lý ngoại lệ | Báo cáo trùng, đánh giá không tồn tại, thiếu quyền. |
| Tiêu chí nghiệm thu | Báo cáo hợp lệ vào hàng đợi; report trùng bị chặn; block/unblock hoạt động; hành động của quản trị viên cập nhật trạng thái báo cáo. |

### 3.14. Module mobile app

| Thành phần | Nội dung |
|---|---|
| Mục đích | Cung cấp trải nghiệm mobile chính cho người dùng TrustBite. |
| Tác nhân | Khách chưa đăng nhập, người dùng đã đăng ký, người đánh giá đã xác minh. |
| Yêu cầu chức năng | MOB-001 home/bản đồ; MOB-002 tìm kiếm; MOB-003 xem chi tiết quán; MOB-004 đăng nhập OTP; MOB-005 gửi đánh giá; MOB-006 tải/chụp hóa đơn và GPS tùy chọn; MOB-007 hiển thị kết quả xác minh; MOB-008 hồ sơ/EXP; MOB-009 báo cáo/chặn người dùng; MOB-010 xóa tài khoản/cài đặt quyền riêng tư. |
| Quy tắc nghiệp vụ | Mobile không tự quyết định xác minh/gian lận; mọi quyết định lấy từ backend. GPS, camera và photo library phải có consent rõ ràng. Account deletion phải có xác nhận chủ động và giải thích hậu quả trước khi gửi request. |
| Phụ thuộc API | Toàn bộ public/user endpoints trong `API_Specification.md`. |
| Phụ thuộc dữ liệu | Không truy cập DB trực tiếp; chỉ dùng API. |
| Xử lý ngoại lệ | Mất mạng, upload gián đoạn, quyền GPS/camera bị từ chối, token hết hạn, OCR đang xử lý lâu, deletion request đã tồn tại, report trùng, block user lỗi. |
| Tiêu chí nghiệm thu | Người dùng hoàn tất được luồng đăng nhập → tìm quán → gửi đánh giá → upload hóa đơn → nhận trạng thái xác minh; đồng thời gửi được report/block và yêu cầu xóa tài khoản trên iOS/Android trong beta matrix. |

---

### 3.15. Module privacy/store readiness

| Thành phần | Nội dung |
|---|---|
| Mục đích | Đảm bảo build có thể submit App Store/Google Play và vận hành public beta không vi phạm privacy/safety gate. |
| Tác nhân | Người dùng, Release Manager, Legal, QA, App/Play reviewer |
| Yêu cầu chức năng | PRIV-001 account deletion; PRIV-002 web deletion link; SAFETY-001 report/block UGC; STORE-001 reviewer access và store declaration sign-off. |
| Quy tắc nghiệp vụ | Store metadata, App Privacy/Data Safety, content/age rating, permission declaration và Privacy Policy phải khớp hành vi app/SDK thực tế. |
| Phụ thuộc API | `POST /users/me/deletion-request`, `GET /users/me/deletion-request`, `POST /moderation/reports`, `POST /users/{userId}/block`, `DELETE /users/{userId}/block`. |
| Phụ thuộc dữ liệu | `account_deletion_requests`, `user_blocks`, `audit_logs`, vendor/SDK register. |
| Xử lý ngoại lệ | Reviewer không login được, privacy mapping thiếu SDK, data deletion URL lỗi, app xin quyền rộng không cần thiết. |
| Tiêu chí nghiệm thu | Store checklist, Data Safety/App Privacy mapping, reviewer notes, demo access và policy URLs được sign off trước submit. |

---

## 4. Yêu cầu phi chức năng

| Nhóm | Yêu cầu MVP |
|---|---|
| Hiệu năng | Tìm kiếm/liệt kê quán <1 giây với dataset MVP; request tải hóa đơn trả trạng thái khởi tạo <3 giây, OCR xử lý bất đồng bộ. |
| Khả dụng | Mục tiêu MVP 99.5%; không over-engineering cho 20,000 người dùng đồng thời. |
| Bảo mật | JWT/session an toàn, giới hạn tần suất, validate file upload, private object storage/signed URL khi truy cập ảnh riêng tư, idempotency cho upload. |
| Quyền riêng tư | GPS tùy chọn; hóa đơn phải che dữ liệu nhạy cảm trước khi public; retention theo policy. |
| Auditability | Hành động quan trọng của quản trị viên/chủ quán phải có audit log. |
| Observability | Ghi log job OCR, lỗi hàng đợi, lỗi API, quyết định gian lận, mobile crash và mobile error event. |
| Mobile compatibility | MVP phải kiểm thử trên device matrix tối thiểu trong `Device_Test_Matrix.md`; HEIC, GPS permission, camera/photo library và mạng yếu là case bắt buộc. |
| Mobile security | Token lưu trong secure storage; không log OTP/token/GPS gốc/toàn bộ text hóa đơn; xử lý token hết hạn an toàn. |
| Store readiness | Account deletion, web deletion link, UGC report/block, reviewer access, App Privacy/Data Safety và permission declarations phải pass trước submit. |

---

## 5. Tích hợp bên ngoài

| Dịch vụ | Dùng cho | Yêu cầu MVP |
|---|---|---|
| SMS Gateway | OTP | Bắt buộc |
| Map Provider | Bản đồ/tìm kiếm/vị trí | Bắt buộc |
| OCR Provider | Trích xuất chữ từ hóa đơn | Bắt buộc |
| Object Storage | Hóa đơn/media đánh giá | Bắt buộc |
| AI/LLM | Tóm tắt đánh giá | Tương lai |
| Payment/Refund | Nhiệm vụ bí mật | Tương lai |
