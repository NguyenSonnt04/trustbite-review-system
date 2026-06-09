# Tài liệu yêu cầu sản phẩm - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Tài liệu yêu cầu sản phẩm |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Quản lý sản phẩm |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu sản phẩm

TrustBite giúp người dùng chọn quán ăn dựa trên đánh giá có bằng chứng thực tế. MVP tập trung vào đánh giá đã xác minh bằng hóa đơn, trạng thái đánh giá minh bạch và quy trình quản trị đủ để xử lý trường hợp nghi vấn.

Sản phẩm được định hướng **mobile-first**: người dùng cuối thao tác chính trên iOS/Android app; admin portal dùng web để xử lý vận hành. Merchant portal đầy đủ thuộc P1/V1.1; trong MVP, giả thuyết chủ quán được kiểm chứng bằng admin/manual claim tối thiểu hoặc phỏng vấn vận hành, không chặn release MVP.

---

## 2. Chân dung người dùng

### P-A: Người dùng đã đăng ký

- Cần tìm quán đáng tin.
- Muốn biết đánh giá nào có bằng chứng.
- Sẵn sàng tải hóa đơn nếu dữ liệu nhạy cảm được bảo vệ.

### P-B: Người đánh giá đã xác minh

- Người dùng có lịch sử đánh giá thật.
- Muốn được ghi nhận bằng EXP/cấp hạng.
- Có thể đóng góp nhiều hơn cho cộng đồng.

### P-C: Chủ quán

- Chủ quán muốn xác nhận quyền quản lý/cập nhật thông tin quán.
- Muốn phản hồi đánh giá và báo cáo đánh giá sai sự thật.
- Không được tự đánh giá quán của mình.

### P-D: Quản trị viên

- Duyệt quán, hóa đơn, đánh giá nghi vấn và báo cáo.
- Cần audit log cho mọi quyết định.

---

## 3. Phạm vi sản phẩm

| Giai đoạn | Bao gồm |
|---|---|
| MVP | Mobile app người dùng: xác thực OTP, khám phá quán, đánh giá, xác minh hóa đơn bằng multipart upload, GPS tùy chọn, kết quả xác minh, hồ sơ/EXP; admin web: duyệt thủ công, kiểm duyệt, audit log; merchant claim chỉ ở mức tối thiểu/manual nếu cần |
| V1.1 | Cổng chủ quán chi tiết, thông báo, bình chọn hữu ích, danh sách yêu thích, điểm tin cậy nâng cao |
| Tương lai | tóm tắt AI, nhiệm vụ bí mật, hoàn tiền, đồ thị hành vi AI, hạ tầng quy mô lớn |

---

## 4. Định dạng đặc tả tính năng

Mỗi tính năng sử dụng định dạng chuẩn:

```markdown
### MÃ: Tên tính năng
- Tác nhân:
- Mục tiêu:
- Mức ưu tiên:
- Mô tả:
- Quy tắc nghiệp vụ:
- Dữ liệu vào:
- Dữ liệu ra:
- Điều kiện thành công:
- Điều kiện lỗi:
- Tiêu chí nghiệm thu:
```

---

## 5. Danh sách tính năng

### AUTH-001: Đăng ký/đăng nhập bằng OTP

- Tác nhân: Khách chưa đăng nhập, Người dùng đã đăng ký
- Mức ưu tiên: P0
- Mục tiêu: Cho phép người dùng xác thực bằng số điện thoại hoặc tài khoản liên kết (dự phòng).
- Dữ liệu vào: số điện thoại, mã OTP, hoặc token liên kết xã hội (Google/Apple).
- Dữ liệu ra: session/token đã xác thực.
- Quy tắc nghiệp vụ:
  - OTP gồm 6 chữ số.
  - OTP hết hạn sau 120 giây.
  - Tối đa 3 lần gửi OTP trong 10 phút cho một số điện thoại (Lưu trạng thái trên Redis).
  - Tối đa 5 lần nhập sai OTP trước khi khóa tạm thời (Khóa 15 phút cho lần đầu, khóa 24 giờ cho các lần tiếp theo trong ngày).
  - Hỗ trợ đăng nhập Google/Apple Sign-In làm phương án dự phòng khi SMS OTP thất bại hoặc chậm trễ.
- Điều kiện lỗi: OTP sai, OTP hết hạn, số điện thoại không hợp lệ, tài khoản bị khóa tạm thời, vượt rate limit.
- Tiêu chí nghiệm thu:
  - Bối cảnh người dùng nhập OTP đúng còn hạn, khi xác thực, thì người dùng đăng nhập thành công.
  - Bối cảnh người dùng yêu cầu OTP quá 3 lần/10 phút, khi gửi tiếp, thì hệ thống từ chối và trả thông báo rate limit.

### REST-001: Tìm kiếm và xem danh sách quán

- Tác nhân: Khách chưa đăng nhập, Người dùng
- Mức ưu tiên: P0
- Mục tiêu: Giúp người dùng tìm quán theo tên, khu vực, vị trí hoặc điểm tin cậy.
- Dữ liệu vào: từ khóa, vị trí, khung bản đồ, bộ lọc.
- Dữ liệu ra: danh sách quán, tọa độ, điểm tin cậy, số đánh giá đã xác minh/tham khảo.
- Quy tắc nghiệp vụ:
  - Chỉ hiển thị quán trạng thái ACTIVE.
  - Kết quả mặc định sắp xếp theo khoảng cách và điểm tin cậy.
  - Khách chưa đăng nhập được xem nhưng không được viết đánh giá/bình chọn/báo cáo.
- Tiêu chí nghiệm thu:
  - Bối cảnh người dùng tìm theo tên quán, khi có kết quả phù hợp, thì danh sách trả về trong thời gian mục tiêu < 1 giây ở MVP dataset.

### REST-002: Xem chi tiết quán

- Tác nhân: Khách chưa đăng nhập, Người dùng, Chủ quán, Quản trị viên
- Mức ưu tiên: P0
- Mục tiêu: Hiển thị thông tin quán, điểm tin cậy và đánh giá.
- Dữ liệu vào: restaurantId.
- Dữ liệu ra: hồ sơ quán, phân rã điểm đánh giá, đánh giá đã xác minh, đánh giá tham khảo.
- Quy tắc nghiệp vụ:
  - Đánh giá bị HIDDEN/DELETED không hiển thị công khai.
  - Đánh giá đã xác minh phải được phân biệt rõ với đánh giá tham khảo.
- Tiêu chí nghiệm thu:
  - Bối cảnh quán ACTIVE, khi mở chi tiết, thì người dùng thấy thông tin quán và danh sách đánh giá hợp lệ.

### REV-001: Gửi đánh giá quán

- Tác nhân: Người dùng đã đăng ký
- Mức ưu tiên: P0
- Mục tiêu: Cho phép người dùng gửi đánh giá dựa trên trải nghiệm thực tế.
- Dữ liệu vào: restaurantId, điểm món ăn, điểm giá, điểm phục vụ, điểm không gian, bình luận, thời điểm ghé quán, media tùy chọn.
- Dữ liệu ra: reviewId, trạng thái đánh giá, bước tiếp theo.
- Quy tắc nghiệp vụ:
  - Điểm mỗi tiêu chí từ 1 đến 5.
  - Bình luận tối thiểu 30 ký tự cho đánh giá thông thường (Reference) và tối thiểu 50 ký tự nếu muốn tải hóa đơn xác minh (Verified).
  - Quán phải ở trạng thái ACTIVE.
  - Người dùng bị khóa quyền đánh giá không được gửi đánh giá.
  - Chủ quán không được đánh giá quán mình sở hữu/claim.
  - Người dùng có thể bỏ qua xác minh hóa đơn; khi bỏ qua, đánh giá chuyển `REFERENCE_ONLY`.
  - Đánh giá `SUBMITTED` không có hóa đơn sau 24 giờ được job chuyển `REFERENCE_ONLY` để tránh trạng thái treo.
- Điều kiện lỗi: thiếu rating, comment quá ngắn, quán không ACTIVE, người dùng bị hạn chế.
- Tiêu chí nghiệm thu:
  - Bối cảnh người dùng gửi đánh giá hợp lệ, khi hệ thống lưu thành công, thì đánh giá có trạng thái SUBMITTED và nextStep là UPLOAD_RECEIPT hoặc SKIP_VERIFICATION.
  - Bối cảnh người dùng chọn bỏ qua hóa đơn, khi xác nhận, thì đánh giá chuyển REFERENCE_ONLY và hiển thị nhãn tham khảo.

### OCR-001: Upload và xác minh hóa đơn

- Tác nhân: Người dùng đã đăng ký
- Mức ưu tiên: P0
- Mục tiêu: Xác minh người dùng đã thật sự ăn tại quán.
- Dữ liệu vào:
  - Ảnh hóa đơn.
  - ID quán.
  - ID đánh giá.
  - Vị trí GPS nếu người dùng cho phép.
- Quy tắc nghiệp vụ:
  - MVP dùng multipart upload qua `POST /receipts` kèm `Idempotency-Key` để xử lý retry từ mobile.
  - Định dạng hỗ trợ: JPG, PNG, HEIC.
  - Dung lượng tối đa: 10MB.
  - Hóa đơn nên nằm trong vòng 48 giờ so với thời điểm đánh giá.
  - Một hóa đơn không được dùng để verify nhiều đánh giá.
  - Hệ thống chặn trùng hóa đơn bằng 2 lớp:
    1. SHA-256 hash của file ảnh gốc.
    2. Khóa trùng dữ liệu (Composite Transaction Hash) tạo từ: Tên quán chuẩn hóa + Ngày giờ giao dịch + Số hóa đơn/Transaction ID + Tổng tiền. Nếu trùng một trong hai lớp, hóa đơn bị tự động từ chối và cờ gian lận được ghi nhận.
  - OCR tên quán khớp 80-100% là rủi ro thấp; 60-79% cần quản trị viên rà soát; dưới 60% rủi ro cao.
- Dữ liệu ra:
  - VERIFIED.
  - PENDING_ADMIN_REVIEW.
  - REFERENCE_ONLY.
  - REJECTED.
- Điều kiện lỗi: file sai định dạng, file quá lớn, OCR thất bại, hash trùng, hóa đơn quá hạn.
- Tiêu chí nghiệm thu:
  - Bối cảnh người dùng tải hóa đơn hợp lệ, khi OCR khớp tên quán và thời gian, thì đánh giá được gắn VERIFIED.
  - Bối cảnh hóa đơn đã tồn tại hash, khi người dùng khác tải lại, thì đánh giá không được xác minh và cờ gian lận được ghi nhận.

### GPS-001: Xác minh GPS tùy chọn

- Tác nhân: Người dùng đã đăng ký
- Mức ưu tiên: P0
- Mục tiêu: Dùng GPS như tín hiệu hỗ trợ xác minh, không bắt buộc ở MVP.
- Dữ liệu vào: latitude, longitude, accuracy, capturedAt.
- Dữ liệu ra: gpsDistanceMeters, gpsRiskScore.
- Quy tắc nghiệp vụ:
  - GPS không bật không làm reject tự động.
  - GPS trong 200m là rủi ro thấp.
  - GPS lệch >200m được xử lý giảm hình phạt rủi ro theo thời gian gửi review:
    - Nếu gửi tại quán (trong vòng 1 giờ từ khi ăn): GPS >200m là rủi ro cao (+40 điểm).
    - Nếu viết review tại nhà/sau đó (từ 1-48 giờ): Giảm hình phạt định vị (chỉ cộng +10 điểm hoặc +0 điểm nếu thời gian giao dịch trên hóa đơn và ảnh EXIF khớp chính xác và OCR tên quán khớp >80%).
  - Ưu tiên đọc dữ liệu GPS từ metadata ảnh (EXIF) nếu được cấp quyền thư viện ảnh, trước khi lấy GPS thiết bị thực tế lúc upload.
- Tiêu chí nghiệm thu:
  - Bối cảnh người dùng không cấp GPS, khi tải hóa đơn hợp lệ, thì hệ thống vẫn xử lý OCR/hash và cộng điểm rủi ro theo rule.

### TRUST-001: Điểm tin cậy V1

- Tác nhân: Hệ thống
- Mức ưu tiên: P0
- Mục tiêu: Tính điểm quán dựa trên đánh giá có trọng số.
- Dữ liệu vào: điểm đánh giá, trạng thái xác minh, cấp hạng người dùng.
- Dữ liệu ra: điểm tin cậy của quán, phân rã điểm đánh giá.
- Quy tắc nghiệp vụ:
  - Đánh giá đã xác minh có trọng số cao hơn đánh giá tham khảo.
  - Đánh giá bị HIDDEN/DELETED không được tính điểm.
  - Trọng số ban đầu phải đơn giản và có thể điều chỉnh sau beta.
  - Việc tính toán điểm tin cậy quán được xử lý bất đồng bộ (asynchronous) qua Redis Queue để tránh làm chậm hệ thống.
- Tiêu chí nghiệm thu:
  - Bối cảnh đánh giá VERIFIED mới được tạo, khi job cập nhật điểm chạy, thì điểm tin cậy của quán được tính lại.

### ADM-001: Hàng đợi rà soát của quản trị viên

- Tác nhân: Quản trị viên
- Mức ưu tiên: P0
- Mục tiêu: Cho phép quản trị viên xử lý hóa đơn/đánh giá/báo cáo nghi vấn.
- Dữ liệu vào: bộ lọc hàng đợi, caseId, quyết định, lý do.
- Dữ liệu ra: trạng thái đã cập nhật, audit log.
- Quy tắc nghiệp vụ:
  - Mọi quyết định của quản trị viên phải có reason.
  - Mọi hành động của quản trị viên phải được ghi audit log.
  - Quản trị viên không được xóa vĩnh viễn dữ liệu nhạy cảm nếu chưa theo đúng quy trình lưu giữ dữ liệu/pháp lý.
- Tiêu chí nghiệm thu:
  - Bối cảnh hóa đơn PENDING_ADMIN_REVIEW, khi quản trị viên duyệt, thì đánh giá chuyển VERIFIED và audit log được ghi.

### MOD-001: Báo cáo đánh giá

- Tác nhân: Người dùng, Chủ quán, Quản trị viên
- Mức ưu tiên: P0
- Mục tiêu: Cho phép báo cáo nội dung sai, spam, xúc phạm hoặc vi phạm chính sách.
- Dữ liệu vào: reviewId, lý do, mô tả, bằng chứng tùy chọn.
- Dữ liệu ra: reportId, trạng thái báo cáo.
- Quy tắc nghiệp vụ:
  - Một người dùng chỉ được tạo một report đang mở cho cùng đánh giá/lý do.
  - Báo cáo nghiêm trọng có thể tạm ẩn đánh giá cho đến khi quản trị viên xử lý.
- Tiêu chí nghiệm thu:
  - Bối cảnh người dùng báo cáo đánh giá hợp lệ, khi gửi, thì report chuyển SUBMITTED và xuất hiện trong hàng đợi quản trị.

### MERCH-001: Chủ quán xác nhận quyền quản lý quán

- Tác nhân: Chủ quán
- Mức ưu tiên: P1 (Chuyển sang phạm vi V1.1, không triển khai ở MVP)
- Mục tiêu: Cho phép chủ quán yêu cầu xác minh quyền sở hữu.
- Dữ liệu vào: restaurantId, giấy tờ kinh doanh, thông tin liên hệ.
- Dữ liệu ra: claimId, trạng thái claim.
- Quy tắc nghiệp vụ:
  - Claim phải được quản trị viên duyệt trước khi chủ quán được chỉnh thông tin quán.
  - Chủ quán không được xóa đánh giá của người dùng.
- Tiêu chí nghiệm thu:
  - Bối cảnh chủ quán gửi claim đủ thông tin, khi quản trị viên duyệt, thì chủ quán được gán quyền quản lý quán.

### NOTIF-001: Thông báo cơ bản

- Tác nhân: Người dùng, Chủ quán, Quản trị viên
- Mức ưu tiên: P1
- Mục tiêu: Gửi thông báo khi có quyết định verification/report/claim.
- Dữ liệu vào: loại sự kiện, recipientId, payload.
- Dữ liệu ra: thông báoId.
- Quy tắc MVP:
  - Notification không chặn MVP.
  - MVP dùng polling/refetch khi người dùng mở lại màn hình kết quả xác minh hoặc app quay lại foreground.
  - Nếu module notification được bật bằng feature flag, thông báo phải tuân thủ privacy và không chứa dữ liệu nhạy cảm.
- Tiêu chí nghiệm thu:
  - Bối cảnh quản trị viên xử lý báo cáo và notification feature flag bật, khi quyết định được lưu, thì người tạo report nhận thông báo.

### GAME-001: EXP và rank cơ bản

- Tác nhân: Người dùng đã đăng ký, Hệ thống
- Mức ưu tiên: P0
- Mục tiêu: Khuyến khích người dùng đóng góp đánh giá thật.
- Quy tắc nghiệp vụ:
  - Đánh giá reference cộng ít EXP hơn verified đánh giá.
  - EXP từ đánh giá bị rejected/hidden có thể bị thu hồi.
  - Rank không được dùng để bỏ qua chống gian lận.
  - Hệ thống xử lý cập nhật EXP và thăng/hạ rank bất đồng bộ (async). Mọi tác động recalculate trọng số của review do đổi rank người dùng sẽ được xử lý trong background job.
- Tiêu chí nghiệm thu:
  - Bối cảnh đánh giá verified thành công, khi hệ thống cập nhật game hóa, thì người dùng được cộng EXP theo rule.


### PRIV-001: Xóa tài khoản và dữ liệu

- Tác nhân: Người dùng đã đăng ký
- Mức ưu tiên: P0 trước public beta/production
- Mục tiêu: Cho phép người dùng tự khởi tạo xóa tài khoản trong app và cung cấp web link/form xóa tài khoản/dữ liệu.
- Dữ liệu vào: xác nhận người dùng, lý do tùy chọn, platform, request metadata.
- Dữ liệu ra: deletionRequestId, trạng thái, scheduledDeletionAt hoặc completedAt.
- Quy tắc nghiệp vụ:
  - Không chỉ dùng email thủ công; mobile phải có luồng trong Settings > Account > Delete account.
  - Backend phải xóa hoặc ẩn danh hóa dữ liệu cá nhân theo `Data_Retention_Policy.md`.
  - Audit/fraud/security records có thể giữ trong thời hạn giới hạn nếu cần bảo vệ hệ thống hoặc nghĩa vụ pháp lý.
  - Sau khi request được xác nhận, refresh/session token bị revoke; nếu có grace period, trạng thái tài khoản là `DELETION_REQUESTED`.
- Tiêu chí nghiệm thu:
  - Bối cảnh người dùng đăng nhập, khi xác nhận xóa tài khoản, thì API tạo deletion request, revoke session và mobile hiển thị trạng thái/ước tính xử lý.
  - Bối cảnh người dùng chưa đăng nhập, khi mở web deletion link, thì có form xác minh danh tính và gửi request hợp lệ.

### SAFETY-001: UGC report/block và liên hệ hỗ trợ

- Tác nhân: Người dùng, Chủ quán, Quản trị viên
- Mức ưu tiên: P0 trước public beta/production
- Mục tiêu: Đáp ứng yêu cầu an toàn UGC của store và giảm lạm dụng cộng đồng.
- Dữ liệu vào: reviewId/userId, reasonCode, mô tả, block target.
- Dữ liệu ra: reportId, blockId hoặc trạng thái restrict.
- Quy tắc nghiệp vụ:
  - Review công khai phải có hành động “Báo cáo”.
  - User public/author card nếu hiển thị phải có cách block hoặc ẩn nội dung từ user đó.
  - Support/contact info phải hiển thị trong app hoặc trang hỗ trợ.
  - Nội dung bị report nghiêm trọng phải vào moderation queue và có SLA xử lý.
- Tiêu chí nghiệm thu:
  - Bối cảnh người dùng báo cáo review/user, khi gửi hợp lệ, thì report vào admin queue.
  - Bối cảnh người dùng block user khác, khi mở danh sách review, thì nội dung của user bị block không hiển thị hoặc được ẩn theo UX đã chốt.

### AI-001: Tóm tắt đánh giá bằng AI

- Tác nhân: Khách chưa đăng nhập, Người dùng
- Mức ưu tiên: Tương lai
- Mục tiêu: Tóm tắt đánh giá đã xác minh bằng AI.
- Ghi chú: Không thuộc MVP vì tốn chi phí và chưa cần để kiểm chứng giả thuyết cốt lõi.

### QUEST-001: nhiệm vụ bí mật

- Tác nhân: FOODGOD, Quản trị viên
- Mức ưu tiên: Tương lai
- Mục tiêu: Điều phối thẩm định bí mật khi có tranh chấp lớn.
- Ghi chú: Không thuộc MVP vì liên quan nhiệm vụ, hoàn tiền và vận hành phức tạp.

---

## 6. Chỉ số thành công

| Chỉ số | Mục tiêu MVP |
|---|---|
| Tỷ lệ tải hóa đơn | >= 60% đánh giá mới có tải hóa đơn trong beta |
| SLA hàng đợi quản trị | 95% trường hợp chờ xử lý xử lý trong 24 giờ làm việc |
| Chặn hóa đơn trùng | 100% hash duplicate bị phát hiện |
| Mức hiểu của người dùng về độ tin cậy | >= 70% người dùng hiểu khác biệt giữa Verified và Reference |
| Critical bug rate | 0 blocker bug trước public beta |
| Store readiness gate | 100% checklist App Store/Google Play P0 đạt trước public beta |
