# Đặc tả màn hình mobile - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Mobile screen specification |
| Phiên bản | v1.1.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | UX Lead / Product Manager |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Phạm vi

Tài liệu này mô tả yêu cầu chức năng, trạng thái và nội dung cần có cho các màn hình mobile MVP. Tài liệu **không chốt màu sắc, bố cục pixel-level, typography, icon set hoặc visual style cuối cùng**.

---

## 2. Trạng thái bắt buộc cho mọi màn hình dữ liệu

Mỗi màn hình có dữ liệu từ API phải có:

- Loading state.
- Error state.
- Empty state nếu dữ liệu rỗng.
- Retry action khi phù hợp.
- Auth-required state nếu người dùng cần đăng nhập.
- Offline/network weak messaging nếu request thất bại vì kết nối.

---

## 3. Màn hình MVP

### MOB-001: Home Map/List

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Người dùng tìm và duyệt quán gần mình hoặc theo từ khóa. |
| Thành phần | Search input, map/list toggle hoặc bottom sheet, filter chips, restaurant cards, trust signal, verified review count. |
| State | Loading restaurants, no result, map permission denied, API error. |
| Analytics | `restaurant_search_performed`, `restaurant_detail_viewed`. |


### MOB-002: Search Results

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Người dùng xem kết quả tìm kiếm theo từ khóa, vị trí hoặc filter. |
| Thành phần | Search query, filter chips, sort, restaurant cards, no-result suggestion, map/list transition. |
| State | Loading, no result, location permission denied, API error, retry. |
| Analytics | `restaurant_search_performed`, `restaurant_filter_changed`, `restaurant_detail_viewed`. |

### MOB-003: Restaurant Detail

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Người dùng hiểu độ tin cậy của quán và xem đánh giá. |
| Thành phần | Tên quán, địa chỉ, điểm tin cậy, số đánh giá verified/reference, CTA viết đánh giá, tab review, merchant reply nếu có. |
| State | Restaurant not found, suspended/closed, reviews empty, reviews loading. |
| Trust UX | Phải giải thích được khác biệt giữa Verified và Reference trong ngôn ngữ ngắn, dễ hiểu. |

### MOB-004: OTP Request / Verify

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Người dùng đăng nhập bằng số điện thoại và OTP. |
| Thành phần | Phone input, request OTP, OTP input, resend countdown, rate limit message. |
| State | OTP sent, OTP expired, wrong OTP, rate limited, network error. |
| Security | Không hiển thị OTP trong log/debug UI. |

### MOB-005: Write Review

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Người dùng gửi đánh giá 4 tiêu chí. |
| Thành phần | 4 rating inputs, comment field, character counter, visitedAt, media optional, submit CTA. |
| State | Draft, validation error, submitting, submit failed, submitted. |
| Validation | Rating 1-5, comment tối thiểu 50 ký tự, restaurant ACTIVE. |

### MOB-006: Receipt Upload

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Người dùng tải/chụp hóa đơn để xác minh đánh giá. |
| Thành phần | File picker/camera action, preview, file constraints, privacy notice, GPS optional prompt, upload progress. |
| State | Permission denied, file too large, unsupported type, uploading, upload failed, uploaded. |
| Privacy | Nói rõ ảnh gốc lưu riêng tư và GPS là tùy chọn. |

### MOB-007: Verification Result

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Người dùng hiểu trạng thái xác minh sau upload. |
| Thành phần | Status badge, explanation, next action, estimated/admin review note nếu pending. |
| State | Processing, verified, pending admin review, reference only, rejected. |
| Copy | Không dùng ngôn ngữ đổ lỗi; giải thích vì sao có thể cần admin rà soát. |

### MOB-008: Profile Overview

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Người dùng xem hồ sơ, EXP, rank và lịch sử đóng góp. |
| Thành phần | Display name, avatar, rank, EXP, review history, settings link. |
| State | Not logged in, loading, API error, no reviews. |

### MOB-009: Report Review / Block User

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Người dùng báo cáo đánh giá/nội dung vi phạm và hạn chế tương tác từ người dùng lạm dụng. |
| Thành phần | Reason selector, description, evidence optional P1, submit CTA, block user toggle/action sheet, link chính sách cộng đồng. |
| State | Submitted, duplicate report, validation error, API error, blocked, already blocked. |
| Safety | Không yêu cầu người báo cáo tự liên hệ người bị báo cáo; copy phải nêu TrustBite sẽ rà soát theo chính sách. |
| API | `POST /moderation/reports`, `POST /users/{userId}/block`, `DELETE /users/{userId}/block`. |

### MOB-010: Account Settings and Privacy

| Nhóm | Yêu cầu |
|---|---|
| Mục tiêu | Người dùng quản lý tài khoản, quyền riêng tư và yêu cầu xóa tài khoản/dữ liệu. |
| Thành phần | Edit profile, logout, delete account entry, privacy policy link, terms link, data deletion web link, permission explanation, blocked users list P1 nếu cần. |
| State | Save failed, logout failed, delete confirmation, delete request submitted, deletion pending, request already exists, API error. |
| Delete account UX | Trước khi gửi yêu cầu, hiển thị hậu quả: logout khỏi thiết bị, ẩn/xóa PII theo retention, review có thể bị xóa/ẩn danh hóa, audit/fraud/legal records có thể giữ tối thiểu. |
| Confirmation | Yêu cầu hành động xác nhận rõ ràng, ví dụ tick checkbox hoặc nhập `XÓA TÀI KHOẢN`; không đặt CTA xóa ở vị trí dễ bấm nhầm. |
| Store compliance | Luồng trong app phải hoạt động cho mọi người dùng có tài khoản; link web deletion phải mở được ngoài app. |
| API | `POST /users/me/deletion-request`, `GET /users/me/deletion-request`, `POST /users/me/deletion-request/cancel` nếu có grace period. |

---

## 4. Copy và trust language

- Dùng từ ngắn, rõ, tránh thuật ngữ kỹ thuật khi không cần.
- `Verified`: đánh giá có bằng chứng đủ tin cậy.
- `Reference`: đánh giá có thể hữu ích nhưng chưa đủ bằng chứng để tính trọng số cao.
- `Pending admin review`: đang được kiểm tra thủ công khi tín hiệu tự động chưa đủ rõ.
- `Rejected`: không đủ điều kiện xác minh hoặc vi phạm rule.

---

## 5. Accessibility mobile

- Touch target tối thiểu theo chuẩn platform.
- Badge màu phải có nhãn chữ.
- Form error nằm gần field liên quan.
- VoiceOver/TalkBack label cho CTA, rating input và trạng thái xác minh.
- Không phụ thuộc vào màu để truyền đạt trạng thái.
- Hỗ trợ dynamic text ở mức hợp lý cho màn hình P0.
