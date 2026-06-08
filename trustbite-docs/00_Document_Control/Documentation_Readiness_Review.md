# Báo cáo review và chuẩn hóa bộ tài liệu TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Báo cáo review/readiness |
| Phiên bản | v1.0.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | PMO / PO |
| Ngày cập nhật | 2026-06-07 |
| Phạm vi | Review tài liệu trong `docs_trustbite.zip`, chỉnh sửa để dùng cho vận hành, phát triển sản phẩm và chuẩn bị submit App Store/Google Play |

---

## 1. Kết luận tổng quan

Bộ tài liệu gốc đã có nền tảng tốt: cấu trúc theo chuyên môn rõ ràng, có PRD/BA/API/DB/QA/security/ops, có OpenAPI, có mobile-first direction, có privacy và moderation baseline. Tuy nhiên, để đưa vào phát triển sản phẩm thật và submit lên kho ứng dụng, bản gốc còn thiếu một số gate quan trọng về store compliance, data safety, account deletion, UGC safety và truy vết end-to-end.

Sau khi chỉnh sửa, bộ tài liệu đã được nâng từ mức **implementation-ready nội bộ** lên mức **product/store-readiness baseline**. Có thể dùng làm nguồn tham chiếu để chia sprint, build API/backend/mobile, lập test plan, vận hành beta và chuẩn bị hồ sơ App Store/Google Play. Bản này chưa thay thế tư vấn pháp lý hoặc bảo đảm được Apple/Google phê duyệt; các phần Terms/Privacy/Data Safety vẫn cần Legal và Release Manager kiểm tra theo build thực tế.

---

## 2. Các vấn đề chính phát hiện trong bản gốc

| Nhóm vấn đề | Mức độ | Nhận xét |
|---|---:|---|
| Ngày cập nhật tương lai | Cao | Nhiều tài liệu ghi ngày cập nhật sau ngày rà soát thực tế, dễ gây sai lệch audit/version history. |
| Thiếu checklist submit store riêng | Cao | Có release checklist mobile nhưng chưa đủ App Store/Google Play gates: reviewer access, content rating, app privacy, data deletion, permission declaration. |
| Thiếu mapping App Privacy/Data Safety | Cao | Chưa có bảng quy chiếu dữ liệu TrustBite sang Apple App Privacy/Google Play Data Safety, đặc biệt receipt image, OCR, GPS, phone, analytics/crash và SDK bên thứ ba. |
| Account deletion chưa đủ product/API/DB/QA | Cao | Có nhắc quyền xóa dữ liệu nhưng chưa có luồng trong app, web deletion link, API contract, DB workflow, test/UAT, support process. |
| UGC report/block chưa đủ store-readiness | Cao | Có moderation/report nhưng chưa đủ baseline report/block/contact/filter để giảm rủi ro bị reject do UGC. |
| Traceability còn thiếu release gates | Trung bình | Một số P0 compliance requirement chưa liên kết PRD → BA → UX → API → DB → QA → Ops. |
| Terms of Service thiếu khung | Trung bình | Cần outline để Legal viết điều khoản công khai trước public beta. |
| OpenAPI thiếu một số endpoint P0 store/privacy | Trung bình | `openapi.yaml` chưa có account deletion, block/unblock user, GPS endpoint độc lập. |

---

## 3. Những chỉnh sửa đã thực hiện

### 3.1. Chuẩn hóa tài liệu điều phối

- Chuẩn hóa ngày cập nhật về `2026-06-07`.
- Bổ sung/chuẩn hóa metadata document control cho toàn bộ tài liệu Markdown.
- Cập nhật `README.md`, `Document_Index.md`, `Version_History.md` và `Traceability_Matrix.md` để phản ánh bản `v2.6.0`.
- Thêm release gate cho store readiness vào traceability.

### 3.2. Bổ sung tài liệu mới

| Tài liệu mới | Mục đích |
|---|---|
| `08_Compliance_and_Privacy/Store_Privacy_Data_Safety_Mapping.md` | Mapping dữ liệu TrustBite sang Apple App Privacy/Google Play Data Safety; kiểm soát SDK/vendor/permission. |
| `08_Compliance_and_Privacy/Terms_of_Service_Outline.md` | Khung nội dung để Legal soạn Terms of Service công khai. |
| `09_Operations_and_Maintenance/Store_Submission_Readiness_Checklist.md` | Checklist submit App Store/Google Play, reviewer notes, metadata, evidence và các lỗi không được submit. |
| `00_Document_Control/Documentation_Readiness_Review.md` | Bản copy báo cáo review này trong repo tài liệu. |

### 3.3. Account deletion/data deletion

Đã bổ sung xuyên suốt các lớp tài liệu:

- Product/BA: PRD, MVP Scope, Functional Spec, User Stories, Business Rules, Role Permission.
- UX: Account Settings/Delete Account, UX writing, screen list.
- API/OpenAPI: `POST /users/me/deletion-request`, `GET /users/me/deletion-request`, `POST /users/me/deletion-request/cancel`.
- DB: `account_deletion_requests`, `users.deletion_requested_at`, `users.deleted_at`, indexes và migration plan.
- Privacy/Ops: Privacy Policy, Data Retention Policy, Customer Support Guide.
- QA/UAT: acceptance criteria, test plan, mobile test plan, UAT cases.

### 3.4. UGC safety/report/block

Đã bổ sung baseline store-readiness cho nội dung người dùng tạo:

- Report review/user action từ mobile.
- Block/unblock user: `POST /users/{userId}/block`, `DELETE /users/{userId}/block`.
- DB `user_blocks`.
- Moderation policy bổ sung filter/report/block/contact/SLA.
- QA/UAT bổ sung test case duplicate report, block/unblock và admin decision audit.

### 3.5. API và OpenAPI

- Cập nhật `API_Specification.md` lên `v1.4.0`.
- Cập nhật `openapi.yaml` từ 20 paths lên 24 paths.
- Thêm các schema: account deletion, block user, GPS signal.
- Mở rộng error enum: `DELETION_REQUEST_ALREADY_EXISTS`, `DELETION_REQUEST_NOT_FOUND`, `CANNOT_BLOCK_SELF`, `USER_ALREADY_BLOCKED`, `GPS_PERMISSION_REQUIRED`, `INVALID_GPS_SIGNAL`.
- Chuẩn hóa path parameter tên rõ hơn: `{receiptVerificationId}`, `{reportId}`, `{reviewId}`, `{userId}`.

### 3.6. Database và migration

- Cập nhật `PostgreSQL_Database_Schema.md` lên `v2.6.0`.
- Thêm bảng `account_deletion_requests` và `user_blocks`.
- Thêm index phục vụ truy vấn account deletion và block/unblock.
- Cập nhật Data Dictionary, ERD, Migration/Seed Plan.
- Bổ sung job xử lý account deletion trong khuyến nghị vận hành dữ liệu.

### 3.7. QA, mobile release và vận hành

- Bổ sung acceptance criteria cho account deletion, web deletion link, UGC report/block và store gate.
- Bổ sung mobile test cases cho delete account, web deletion link, report/block và permission theo ngữ cảnh.
- Bổ sung UAT-007, UAT-008, UAT-009.
- Mở rộng `Mobile_Release_Checklist.md` với App Privacy/Data Safety, account deletion, reviewer access, target API, content rating và Android media permissions.
- Mở rộng `Customer_Support_Guide.md` với quy trình CS cho data deletion và nội dung nguy hại.

---

## 4. Kết quả kiểm tra kỹ thuật sau chỉnh sửa

| Kiểm tra | Kết quả |
|---|---|
| OpenAPI parse YAML | Đạt |
| OpenAPI version | `3.1.0` |
| OpenAPI paths | 24 |
| OpenAPI schemas | 35 |
| OpenAPI `$ref` kiểm tra | 127 refs, 0 missing refs |
| Ngày cập nhật tương lai sau ngày rà soát | 0 hit trong tài liệu vận hành sau chuẩn hóa |
| Metadata `Thông tin tài liệu` trong Markdown | Đạt cho toàn bộ docs trừ `README.md` và `AGENTS.md` theo thông lệ |
| Số file thay đổi so với bản gốc | 57 file |

---

## 5. Mức độ sẵn sàng hiện tại

| Nhóm | Trước review | Sau chỉnh sửa | Ghi chú |
|---|---:|---:|---|
| Product/BA readiness | 7.5/10 | 8.8/10 | Đã thêm store/privacy P0 và traceability. |
| Engineering readiness | 7.0/10 | 8.5/10 | OpenAPI hợp lệ, API/DB bổ sung privacy/safety endpoints. |
| Mobile UX readiness | 6.8/10 | 8.3/10 | Đã thêm account settings, delete account, report/block, copy privacy. |
| QA/UAT readiness | 7.0/10 | 8.6/10 | Đã thêm acceptance/test/UAT cho release blockers. |
| Compliance/store readiness | 5.5/10 | 8.2/10 | Đã có checklist và mapping, nhưng cần Legal/Release Manager sign-off theo build thật. |
| Operations readiness | 7.0/10 | 8.4/10 | Đã bổ sung support, release gate và store submission evidence. |

Điểm trên là đánh giá tài liệu, không phải đánh giá code/implementation.

---

## 6. Việc còn phải làm trước production/public store

| Việc còn lại | Owner khuyến nghị | Lý do |
|---|---|---|
| Legal chốt Privacy Policy, Terms of Service và Data Retention public copy | Legal/PO | Tài liệu hiện là baseline nội bộ, chưa phải văn bản pháp lý cuối. |
| Chốt vendor/SDK thực tế và DPA/privacy manifest | Security/Legal/Mobile | Store declarations phải khớp SDK thật trong build. |
| Tạo URL công khai: Privacy, Terms, Support, Account/Data Deletion | PO/Web/Ops | Cần cho App Store/Google Play metadata. |
| Implement thật API/DB/job account deletion | Backend/DBA/Security | Tài liệu đã có contract nhưng code cần triển khai và kiểm thử. |
| Implement thật report/block UX/API | Mobile/Backend/Ops | Cần cho UGC safety gate. |
| Chuẩn bị demo account/OTP reviewer flow | Release Manager/Backend | Reviewer phải truy cập được tính năng account-based. |
| Chuẩn bị screenshots không chứa PII thật | Design/Mobile/Release | Store metadata không được dùng dữ liệu nhạy cảm thật. |
| Hoàn tất Google Play Data Safety và Apple App Privacy theo build thực tế | Release Manager/Legal | Không khai báo theo giả định; phải theo app + SDK thật. |
| Security review/pentest tối thiểu | Security/Engineering | Receipt, GPS, phone, token, admin queue là vùng nhạy cảm. |
| UAT trên thiết bị thật | QA/Mobile/PO | Đặc biệt camera/photo picker, HEIC, GPS denied, offline/retry. |

---

## 7. Cách dùng bộ tài liệu sau chỉnh sửa

1. Dùng `README.md`, `Document_Index.md`, `Documentation_Operating_Model.md` để định hướng cách vận hành tài liệu sống.
2. Dùng `Traceability_Matrix.md` làm bảng kiểm khi đưa story vào sprint; không build P0 nếu thiếu link PRD/BA/UX/API/DB/QA.
3. Dùng `MVP_Scope.md`, `PRD`, `Functional_Specification`, `User_Stories_Backlog` để chốt sprint backlog.
4. Dùng `API_Specification.md`, `openapi.yaml`, `PostgreSQL_Database_Schema.md`, `Migration_and_Seed_Plan.md` để triển khai backend/mobile contract.
5. Dùng `Mobile_Screen_Specification.md`, `UX_Writing_Guidelines.md`, `Mobile_Test_Plan.md` để build và QA mobile app.
6. Trước beta/store submission, bắt buộc chạy `Mobile_Release_Checklist.md`, `Store_Submission_Readiness_Checklist.md`, `Store_Privacy_Data_Safety_Mapping.md` và UAT-007/008/009.

---

## 8. Nguồn chính thức đã dùng để chuẩn hóa store-readiness

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Apple Offering account deletion in your app: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Google Play Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play target API requirements: https://support.google.com/googleplay/android-developer/answer/11926878
- Google Play Photo/Video permissions policy: https://support.google.com/googleplay/android-developer/answer/15800983
- Google Play Content ratings: https://support.google.com/googleplay/android-developer/answer/9898843

---

## 9. Khuyến nghị quyết định tiếp theo

Bản tài liệu hiện có thể dùng để bắt đầu implementation sprint và chuẩn bị beta, nhưng nên tạo một buổi sign-off 90 phút với PO, BA, Tech Lead, Mobile Lead, QA Lead, Legal và Ops để đóng 5 điểm: scope P0, privacy/data deletion, UGC safety, API/DB migration, và store submission checklist. Sau buổi đó mới nên chuyển một số tài liệu từ `Đang rà soát` sang `Đã phê duyệt`.
