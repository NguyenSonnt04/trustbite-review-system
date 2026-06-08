# TrustBite documentation repo

## Mục đích repo

Repo này là **kho tài liệu triển khai** cho TrustBite, không phải repo source code ứng dụng. TrustBite là nền tảng đánh giá ẩm thực tin cậy, ưu tiên đánh giá có bằng chứng thực tế: hóa đơn, thời gian ghé quán, GPS tùy chọn và kiểm duyệt minh bạch.

Mục tiêu của tài liệu là giúp các nhóm Product, BA, UX/UI, Engineering, Security, DB, QA, Compliance và Ops làm việc thống nhất trước/sau khi triển khai MVP.

## Sự thật sản phẩm cần giữ nhất quán

- Định hướng **mobile-first**: người dùng cuối dùng mobile app iOS/Android; admin portal là web; merchant portal thuộc P1/V1.1 nếu chưa cần cho MVP.
- MVP kiểm chứng 3 giả thuyết:
  1. Người dùng có sẵn sàng tải hóa đơn để đổi lấy đánh giá đáng tin cậy không?
  2. Đánh giá đã xác minh có làm tăng niềm tin khi chọn quán không?
  3. Chủ quán có sẵn sàng tham gia nền tảng minh bạch hóa chất lượng không?
- P0/MVP gồm: OTP auth, tìm/xem quán ACTIVE, viết đánh giá 4 tiêu chí, upload hóa đơn, hash duplicate check, OCR cơ bản, GPS tùy chọn, risk scoring V1, admin queue, moderation, audit log, EXP/rank cơ bản.
- GPS là **optional**. Thiếu GPS không được tự động reject đánh giá/hóa đơn.
- Backend là nguồn sự thật cho trạng thái review/receipt/fraud. Mobile chỉ hiển thị/refetch trạng thái từ API.
- Quyết định của quản trị viên luôn cần `reason` và phải ghi `audit_logs`.
- Ảnh hóa đơn gốc là riêng tư; không public trực tiếp; nếu hiển thị bằng chứng thì phải dùng bản đã che dữ liệu nhạy cảm.

## Cấu trúc thư mục

```text
00_Document_Control/          Danh mục, lịch sử phiên bản, thuật ngữ
01_Product_Management/        Charter, PRD, MVP scope, personas, roadmap, analytics
02_Business_Analysis/         Functional spec, backlog, role matrix, business rules, state machines
03_UX_UI/                     Screen list, user flows, mobile navigation/screen specs, design system
04_Software_Engineering/      SRS, API, architecture, tech stack, AWS, CI/CD, mobile architecture, OpenAPI
05_Security_Algorithms/       Anti-fraud, gamification, threat model
06_Database_Design/           PostgreSQL schema, ERD, data dictionary
07_Testing_and_QA/            Acceptance criteria, test plans, UAT, device matrix
08_Compliance_and_Privacy/    Privacy, retention, moderation policy
09_Operations_and_Maintenance/ Backup/DR, mobile release checklist
assets/                       Hình ảnh/sơ đồ
```

## Tài liệu nguồn theo loại thay đổi

Đọc đúng nhóm tài liệu trước khi sửa:

| Loại thay đổi | Tài liệu cần kiểm tra/cập nhật |
|---|---|
| Phạm vi MVP / ưu tiên | `01_Product_Management/Project_Charter.md`, `MVP_Scope.md`, `Product_Requirements_Document_PRD.md` |
| Tính năng / nghiệp vụ | `02_Business_Analysis/Functional_Specification.md`, `Business_Rules.md`, `State_Machines.md`, `Role_Permission_Matrix.md` |
| UX/mobile flow | `03_UX_UI/Mobile_Navigation_Map.md`, `Mobile_Screen_Specification.md`, `User_Flows.md`, `Wireframe_Requirements.md`, `Design_System.md` |
| API contract | `04_Software_Engineering/API_Specification.md`, `OpenAPI_Guidelines.md`, `Software_Requirements_Specification_SRS.md` |
| Kiến trúc / tech stack | `04_Software_Engineering/System_Architecture_Design.md`, `Tech_Stack_Specification.md`, `Mobile_App_Architecture.md`, `AWS_Cloud_Infrastructure.md`, `CI_CD_Pipeline.md` |
| Database | `06_Database_Design/PostgreSQL_Database_Schema.md`, `ERD.md`, `Data_Dictionary.md` |
| Fraud / trust score / security | `05_Security_Algorithms/Anti_Fraud_Specification.md`, `Security_Threat_Model.md`, `02_Business_Analysis/Business_Rules.md` |
| QA / nghiệm thu | `07_Testing_and_QA/Acceptance_Criteria.md`, `Test_Plan.md`, `Mobile_Test_Plan.md`, `UAT_Test_Cases.md`, `Device_Test_Matrix.md` |
| Privacy / retention / moderation | `08_Compliance_and_Privacy/Privacy_Policy.md`, `Data_Retention_Policy.md`, `Content_Moderation_Policy.md` |
| Release / vận hành | `09_Operations_and_Maintenance/Mobile_Release_Checklist.md`, `Backup_and_Disaster_Recovery.md` |

## Quy tắc đồng bộ tài liệu

- Khi thay đổi P0, phải kiểm tra tác động tới PRD, Functional Spec, SRS, API/DB và QA.
- Khi đổi trạng thái nghiệp vụ, cập nhật `State_Machines.md` và test case liên quan.
- Khi đổi API, cập nhật `API_Specification.md`, `OpenAPI_Guidelines.md` nếu cần, và checklist/test QA liên quan.
- Khi đổi schema/table/status DB, cập nhật `PostgreSQL_Database_Schema.md`, `Data_Dictionary.md`, `ERD.md` và test/migration notes liên quan.
- Khi thêm tài liệu mới, cập nhật `README.md`, `00_Document_Control/Document_Index.md` và nếu là thay đổi đáng kể thì cập nhật `00_Document_Control/Version_History.md`.
- Không tự đánh dấu tài liệu `Đã phê duyệt` nếu chưa có đủ owner, version, reviewer, acceptance criteria, impact analysis và ngày hiệu lực như quy định trong `README.md`.
- Nếu tài liệu mâu thuẫn, ưu tiên tài liệu mới hơn trong `Version_History.md`, nhưng vẫn ghi rõ mâu thuẫn hoặc cập nhật đồng bộ thay vì sửa một nơi.

## Quy ước nội dung

- Ngôn ngữ tài liệu: tiếng Việt, trực tiếp, rõ điều kiện nghiệp vụ và tiêu chí nghiệm thu.
- Giữ nguyên thuật ngữ trong `00_Document_Control/Glossary.md`.
- Dùng mã tính năng/quy tắc/test nhất quán: `AUTH-001`, `REV-001`, `OCR-001`, `BR-REV-001`, `MOB-REC-001`, v.v.
- Dùng trạng thái đúng như `02_Business_Analysis/State_Machines.md`, ví dụ: `SUBMITTED`, `VERIFIED`, `REFERENCE_ONLY`, `PENDING_ADMIN_REVIEW`, `REJECTED`, `HIDDEN`, `DELETED`.
- API conventions: base URL `/api/v1`, JSON UTF-8, UUID, ISO-8601 kèm timezone, error response chuẩn theo `OpenAPI_Guidelines.md`.
- DB conventions: PostgreSQL 15+ PostGIS, tên bảng/cột `snake_case`, bảng vận hành có `created_at`/`updated_at`, trạng thái đồng bộ với state machines.
- Không chốt màu sắc/visual style cuối cùng nếu chỉ dựa trên docs hiện tại; `Design_System.md` vẫn là định hướng.

## Bảo mật và quyền riêng tư

- Không đưa secret, OTP thật, token, số điện thoại đầy đủ, toàn bộ text hóa đơn hoặc GPS gốc vào ví dụ/log trừ khi đã được ẩn/masking.
- OTP phải được hash trước khi lưu; token thô không lưu trong DB.
- Receipt upload chỉ nhận JPG/PNG/HEIC, tối đa 10MB theo rule MVP.
- Duplicate receipt hash là tín hiệu reject/fraud flag mạnh.
- OCR/GPS dùng risk scoring; không dùng GPS như điều kiện reject tuyệt đối.
- Dữ liệu nhạy cảm trên hóa đơn cần che nếu hiển thị công khai.

## Công nghệ tham chiếu hiện tại

- Mobile MVP ưu tiên: React Native + TypeScript; Flutter + Dart là phương án thay thế nếu team chốt lại.
- Admin/Merchant web: Next.js + TypeScript.
- Backend: Node.js 20+ LTS, NestJS, TypeScript, Prisma ORM.
- Database/cache/queue: PostgreSQL 15+ + PostGIS, Redis + BullMQ.
- OCR/storage/auth/infra: AWS Textract hoặc tương đương, S3-compatible storage, OTP SMS, AWS managed/container services.

Nếu chốt framework mobile khác hoặc đổi kiến trúc lớn, cập nhật `04_Software_Engineering/Mobile_App_Architecture.md` và các tài liệu liên quan trước khi coi là quyết định chính thức.

## Lệnh hữu ích trong repo

Repo chưa có package manager/build system. Dùng các lệnh kiểm tra tài liệu cơ bản:

```bash
# Xem trạng thái git
git status --short --branch

# Liệt kê tài liệu Markdown
find . -name '*.md' -not -path './.git/*' | sort

# Tìm nội dung trong tài liệu
rg -n "PENDING_ADMIN_REVIEW|OCR-001|BR-" --glob '*.md'

# Kiểm tra whitespace lỗi trong diff
git diff --check
```

Không thêm dependency, config build hoặc source code ứng dụng vào repo này trừ khi người dùng yêu cầu rõ ràng.

## Checklist trước khi kết thúc thay đổi

- Đã đọc tài liệu nguồn phù hợp với loại thay đổi.
- Không tạo mâu thuẫn giữa PRD, BA, SRS, API, DB và QA.
- Nếu đổi P0/API/DB/state, đã cập nhật tài liệu downstream liên quan.
- Đã giữ đúng thuật ngữ, trạng thái, error code và business rule hiện có.
- Đã chạy `git diff --check` cho thay đổi Markdown.
- Nếu thay đổi lớn, đã cập nhật `Version_History.md` và `Document_Index.md` khi cần.
