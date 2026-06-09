# Backlog câu chuyện người dùng - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Backlog triển khai MVP |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | BA / Product Owner |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Quy ước backlog

| Trường | Ý nghĩa |
|---|---|
| Epic | Nhóm chức năng lớn. |
| Story ID | Mã story dùng để trace tới PRD/API/QA. |
| Priority | `P0` bắt buộc MVP, `P1` sau MVP/beta nếu có thời gian. |
| Dependency | Story/API/DB/UX cần có trước. |
| Definition of Ready | Điều kiện để đưa vào sprint. |
| Definition of Done | Điều kiện hoàn tất story. |

### Definition of Ready mặc định

Một story P0 chỉ được đưa vào sprint khi có:

- mô tả user story và acceptance criteria,
- API hoặc screen liên quan đã có draft,
- rule/status liên quan đã có trong `Business_Rules.md` hoặc `State_Machines.md`,
- test case hoặc tiêu chí QA tương ứng,
- dependency chính được xác định.

### Definition of Done mặc định

Một story P0 hoàn tất khi:

- implementation đạt acceptance criteria,
- API/schema/status cập nhật đúng tài liệu,
- test unit/integration/E2E liên quan đạt,
- không log dữ liệu nhạy cảm,
- lỗi blocker/critical bằng 0,
- QA xác nhận trên môi trường staging/beta nếu là luồng end-to-end.

---

## 2. Epic AUTH - Xác thực OTP

| Story ID | Priority | User story | Acceptance criteria | Dependency |
|---|---|---|---|---|
| AUTH-US-001 | P0 | Là khách chưa đăng nhập, tôi muốn yêu cầu OTP bằng số điện thoại để bắt đầu đăng nhập. | Số hợp lệ tạo OTP request; OTP hết hạn sau 120 giây; vượt 3 request/10 phút trả `RATE_LIMITED`; không log OTP thô. | API auth, SMS provider/mock |
| AUTH-US-002 | P0 | Là người dùng, tôi muốn nhập OTP để đăng nhập hoặc tạo tài khoản mới. | OTP đúng còn hạn trả access token và user; OTP sai trả `OTP_INVALID`; OTP hết hạn trả `OTP_EXPIRED`; 5 lần sai khóa tạm. | AUTH-US-001 |
| AUTH-US-003 | P0 | Là người dùng mobile, tôi muốn app refresh session an toàn khi token hết hạn. | Access token hết hạn được refresh; refresh revoked/expired đưa về auth state; token lưu secure storage. | User sessions |
| AUTH-US-004 | P0 | Là người dùng, tôi muốn đăng xuất để xóa session khỏi thiết bị. | Logout revoke session nếu backend hỗ trợ; mobile xóa token local; gọi API sau logout trả 401. | AUTH-US-003 |

---

## 3. Epic REST - Khám phá và xem quán

| Story ID | Priority | User story | Acceptance criteria | Dependency |
|---|---|---|---|---|
| REST-US-001 | P0 | Là khách chưa đăng nhập, tôi muốn xem danh sách quán ACTIVE gần mình hoặc theo mặc định. | Chỉ trả quán `ACTIVE`; có paging; p95 <1s với dataset MVP; empty/error state có retry. | DB seed, API restaurants |
| REST-US-002 | P0 | Là người dùng, tôi muốn tìm quán theo từ khóa để chọn nơi ăn. | Keyword/filter trả kết quả phù hợp; không trả DRAFT/SUSPENDED/CLOSED; analytics `restaurant_search_performed`. | REST-US-001 |
| REST-US-003 | P0 | Là người dùng, tôi muốn xem chi tiết quán để hiểu trust score và review. | Hiển thị hồ sơ, trust score, số verified/reference; HIDDEN/DELETED không public; loading/error/empty state. | REST-US-001 |
| REST-US-004 | P0 | Là người dùng, tôi muốn phân biệt review verified và reference trong danh sách review. | Badge có nhãn chữ; filter verified/reference/all hoạt động; copy giải thích trust dễ hiểu. | REST-US-003, UX copy |

---

## 4. Epic REV - Đánh giá

| Story ID | Priority | User story | Acceptance criteria | Dependency |
|---|---|---|---|---|
| REV-US-001 | P0 | Là người dùng đã đăng nhập, tôi muốn gửi review 4 tiêu chí để chia sẻ trải nghiệm. | Rating 1-5; comment >=50 ký tự; quán phải ACTIVE; review tạo `SUBMITTED`; API trả `nextStep`. | AUTH, REST |
| REV-US-002 | P0 | Là người dùng, tôi muốn thấy lỗi rõ khi review không hợp lệ. | Thiếu rating/comment ngắn/quán inactive/user restricted trả error code ổn định và mobile hiển thị đúng field. | REV-US-001 |
| REV-US-003 | P0 | Là người dùng, tôi muốn bỏ qua xác minh hóa đơn nếu không muốn upload. | Gọi `POST /reviews/{reviewId}/skip-verification`; review chuyển `REFERENCE_ONLY`; copy giải thích trọng số thấp. | REV-US-001 |
| REV-US-004 | P0 | Là hệ thống, tôi muốn tự chuyển review SUBMITTED không có receipt sau 24 giờ sang REFERENCE_ONLY. | Job chạy idempotent; chỉ ảnh hưởng review chưa có receipt; audit/system event khuyến nghị; QA kiểm được bằng thời gian giả lập. | REV-US-001, State machine |
| REV-US-005 | P0 | Là người dùng, tôi muốn xem trạng thái review sau khi upload/skip để biết review đang verified hay reference. | `GET /reviews/{reviewId}` trả status, verificationStatus, trustLabel; mobile refetch khi foreground. | REV/OCR |

---

## 5. Epic OCR - Upload và xác minh hóa đơn

| Story ID | Priority | User story | Acceptance criteria | Dependency |
|---|---|---|---|---|
| OCR-US-001 | P0 | Là người dùng, tôi muốn chọn/chụp ảnh hóa đơn JPG/PNG/HEIC dưới 10MB. | Mobile kiểm tra sơ bộ; backend validate lại; sai type trả `UNSUPPORTED_FILE_TYPE`; quá lớn trả `FILE_TOO_LARGE`. | Mobile permissions, API receipts |
| OCR-US-002 | P0 | Là người dùng, tôi muốn upload hóa đơn bằng multipart để bắt đầu xác minh. | `POST /receipts` nhận multipart; yêu cầu `Idempotency-Key`; trả `202`, `receiptVerificationId`, `processingStatus`. | OCR-US-001 |
| OCR-US-003 | P0 | Là người dùng mobile, tôi muốn retry upload không tạo receipt trùng. | Retry cùng idempotency key trả record cũ; payload khác cùng key trả `IDEMPOTENCY_CONFLICT`. | OCR-US-002 |
| OCR-US-004 | P0 | Là hệ thống, tôi muốn kiểm tra hash trùng để chặn reuse hóa đơn. | Hash trùng chuyển receipt `REJECTED`, review mặc định `REJECTED`, tạo `fraud_flags.DUPLICATE_RECEIPT_HASH`. | DB receipts/fraud |
| OCR-US-005 | P0 | Là hệ thống, tôi muốn OCR hóa đơn bất đồng bộ để không chặn API upload. | Worker xử lý queue; API upload p95 <3s; OCR timeout retry; sau retry lỗi chuyển `PENDING_ADMIN_REVIEW`. | Queue/worker/OCR mock |
| OCR-US-006 | P0 | Là hệ thống, tôi muốn tính risk score V1 để quyết định trạng thái xác minh. | 0-30 verified; 31-60 pending admin; 61-99 reference; >=100 rejected; trạng thái review/receipt đồng bộ. | Anti-fraud rules |
| OCR-US-007 | P0 | Là người dùng, tôi muốn xem kết quả xác minh sau khi OCR hoàn tất hoặc pending. | Mobile polling/refetch `GET /receipts/{receiptVerificationId}`; hiển thị processing/verified/pending/reference/rejected; không cần notification. | OCR-US-002 |

---

## 6. Epic GPS - Tín hiệu vị trí tùy chọn

| Story ID | Priority | User story | Acceptance criteria | Dependency |
|---|---|---|---|---|
| GPS-US-001 | P0 | Là người dùng, tôi muốn GPS là tùy chọn khi upload hóa đơn. | Từ chối GPS vẫn upload được; copy nói rõ không auto reject; analytics không gửi tọa độ gốc. | OCR-US-002, UX copy |
| GPS-US-002 | P0 | Là hệ thống, tôi muốn tính khoảng cách GPS bằng Haversine nếu có dữ liệu. | Trong 200m +0; 200-500m +20; >500m +40; accuracy >100m +15; tọa độ sai bị bỏ qua/validate. | Anti-fraud rules |

---

## 7. Epic ADM - Admin portal MVP

| Story ID | Priority | User story | Acceptance criteria | Dependency |
|---|---|---|---|---|
| ADM-US-001 | P0 | Là quản trị viên, tôi muốn xem dashboard hàng đợi để biết case cần xử lý. | Hiển thị số case theo receipt/moderation/claim, SLA bucket, link vào queue; auth admin bắt buộc. | Admin auth/RBAC |
| ADM-US-002 | P0 | Là quản trị viên, tôi muốn lọc hàng đợi hóa đơn theo trạng thái/risk/thời gian chờ. | Queue có cột caseId, user masked, restaurant, risk, status, age, SLA; filter/sort/paging hoạt động. | API admin queues |
| ADM-US-003 | P0 | Là quản trị viên, tôi muốn mở chi tiết hóa đơn để xem bằng chứng trước khi quyết định. | Case detail có ảnh private qua signed URL TTL ngắn, OCR text masked khi cần, GPS distance, risk breakdown, audit history. | Receipt storage/API |
| ADM-US-004 | P0 | Là quản trị viên, tôi muốn duyệt/từ chối/đánh dấu reference hóa đơn kèm reason. | Decision bắt buộc reason; cập nhật receipt/review theo mapping; ghi audit log; case đóng không xử lý lại trừ super admin override. | State mapping |
| ADM-US-005 | P0 | Là quản trị viên, tôi muốn xử lý report kiểm duyệt. | Report queue/detail; action `NO_ACTION`, `HIDE_REVIEW`, `DELETE_REVIEW`, `RESTRICT_USER_REVIEW`; reason/audit bắt buộc. | MOD stories |
| ADM-US-006 | P0 | Là quản trị viên, tôi muốn xem audit log của case. | Audit hiển thị actor, role, action, previous/new status, reason, createdAt; không lộ dữ liệu nhạy cảm không cần thiết. | Audit logs |
| ADM-US-007 | P0 | Là quản trị viên, tôi muốn duyệt claim tối thiểu nếu có chủ quán tham gia beta. | Claim approve/reject/cancel kèm reason; cấp quyền owner tối thiểu; merchant portal đầy đủ không bắt buộc. | Merchant claim API |

---

## 8. Epic MOD - Kiểm duyệt

| Story ID | Priority | User story | Acceptance criteria | Dependency |
|---|---|---|---|---|
| MOD-US-001 | P0 | Là người dùng, tôi muốn báo cáo review vi phạm. | Tạo report `SUBMITTED`; report trùng cùng user/review/reason trả `REPORT_DUPLICATE`; vào admin queue. | Review detail |
| MOD-US-002 | P0 | Là hệ thống/admin, tôi muốn ẩn review vi phạm. | Admin action `HIDE_REVIEW` chuyển review `HIDDEN`; review không public và không tính trust score; audit log có reason. | ADM-US-005 |

---

## 9. Epic GAME - EXP/rank cơ bản

| Story ID | Priority | User story | Acceptance criteria | Dependency |
|---|---|---|---|---|
| GAME-US-001 | P0 | Là người đánh giá, tôi muốn nhận EXP khi review verified/reference hợp lệ. | Verified cộng EXP cao hơn reference; rejected/hidden không cộng hoặc thu hồi; rank không bypass fraud. | REV/OCR |
| GAME-US-002 | P0 | Là người dùng, tôi muốn xem EXP/rank trong hồ sơ. | Profile hiển thị expPoints, rankCode, review history cơ bản; loading/error/empty state. | API users/gamification |

---


---

## 10. Epic PRIV/SAFETY - Store readiness, xóa tài khoản và an toàn UGC

| Story ID | Priority | User story | Acceptance criteria | Dependency |
|---|---|---|---|---|
| PRIV-US-001 | P0 | Là người dùng, tôi muốn xóa tài khoản trong app để kiểm soát dữ liệu cá nhân. | Settings có Delete account; xác nhận rõ hậu quả; API tạo deletion request; token bị revoke; trạng thái xử lý hiển thị rõ. | Auth, Privacy policy, DB deletion request |
| PRIV-US-002 | P0 | Là người dùng không đăng nhập được, tôi muốn có web link/form yêu cầu xóa tài khoản/dữ liệu. | Store listing và app có link; form xác minh danh tính; request đi vào hàng đợi/tự động xử lý; CS có template phản hồi. | Support guide |
| SAFETY-US-001 | P0 | Là người dùng, tôi muốn report review/user vi phạm. | Report action rõ ràng; reason code chuẩn; report trùng bị chặn; admin queue nhận report. | MOD-US-001, Content policy |
| SAFETY-US-002 | P0 | Là người dùng, tôi muốn block user gây phiền toái. | Block có hiệu lực ngay; nội dung của blocked user bị ẩn/giảm hiển thị; có unblock nếu UX chốt. | User/block API |
| STORE-US-001 | P0 | Là Release Manager, tôi muốn có checklist store để không bị reject vì metadata/privacy/reviewer access. | Store checklist pass 100%; App Privacy/Data Safety/Content Rating/App Access có owner sign-off; evidence lưu trong release folder. | Mobile release checklist |

## 11. Epic NOTIF/MERCH P1

| Story ID | Priority | User story | Acceptance criteria | Dependency |
|---|---|---|---|---|
| NOTIF-US-001 | P1 | Là người dùng, tôi muốn nhận thông báo khi có kết quả verification/report. | Chỉ triển khai khi feature flag bật; payload không chứa dữ liệu nhạy cảm; không chặn MVP. | Notification module |
| MERCH-US-001 | P1 | Là chủ quán, tôi muốn gửi claim quán qua portal để quản lý hồ sơ. | Claim đủ giấy tờ chuyển pending/admin review; portal đầy đủ thuộc V1.1. | Admin claim MVP |
| VOTE-US-001 | P1 | Là người dùng, tôi muốn bình chọn review hữu ích. | Không vote trùng; không cho guest vote; endpoint có rate limit. | Review detail |
| FAV-US-001 | P1 | Là người dùng, tôi muốn lưu quán yêu thích. | Lưu/xóa favorite; không trùng; hiển thị trong profile. | Restaurant detail |
