# TRUSTBITE - Kho tài liệu

TrustBite là nền tảng đánh giá ẩm thực tập trung vào đánh giá có bằng chứng thực tế: hóa đơn, thời gian ghé quán, dữ liệu vị trí tùy chọn và quy trình kiểm duyệt minh bạch.

Bộ tài liệu này được chuẩn hóa theo hướng **tài liệu sống, triển khai và vận hành được**: Ý tưởng → Yêu cầu → Thiết kế → Phát triển → Kiểm thử → Release → Vận hành → Cải tiến.

Repo giữ cấu trúc theo chuyên môn để dễ phân quyền, nhưng cách dùng phải đi theo vòng đời product. Mô hình vận hành chi tiết nằm tại `00_Document_Control/Documentation_Operating_Model.md`.

---

## 1. Cây tài liệu

```text
docs_trustbite/
├── 00_Document_Control/
│   ├── Document_Index.md
│   ├── Version_History.md
│   ├── Glossary.md
│   ├── Documentation_Operating_Model.md
│   └── Traceability_Matrix.md
│
├── 01_Product_Management/
│   ├── Project_Charter.md
│   ├── Product_Requirements_Document_PRD.md
│   ├── MVP_Scope.md
│   ├── Product_Model.md
│   ├── User_Personas.md
│   ├── Product_Roadmap.md
│   └── Product_Analytics_Tracking_Plan.md
│
├── 02_Business_Analysis/
│   ├── Functional_Specification.md
│   ├── User_Stories_Backlog.md
│   ├── Role_Permission_Matrix.md
│   ├── Business_Rules.md
│   ├── State_Machines.md
│   └── Status_Mapping.md
│
├── 03_UX_UI/
│   ├── Screen_List.md
│   ├── User_Flows.md
│   ├── Wireframe_Requirements.md
│   ├── Mobile_Navigation_Map.md
│   ├── Mobile_Screen_Specification.md
│   ├── Admin_Portal_Screen_Specification.md
│   ├── Design_System.md
│   └── UX_Writing_Guidelines.md
│
├── 04_Software_Engineering/
│   ├── Software_Requirements_Specification_SRS.md
│   ├── API_Specification.md
│   ├── System_Architecture_Design.md
│   ├── Tech_Stack_Specification.md
│   ├── AWS_Cloud_Infrastructure.md
│   ├── High_Availability_Scaling_Strategy.md
│   ├── CI_CD_Pipeline.md
│   ├── Development_Guidelines.md
│   ├── Mobile_App_Architecture.md
│   ├── OpenAPI_Guidelines.md
│   ├── Idempotency_and_Retry_Design.md
│   └── openapi.yaml
│
├── 05_Security_Algorithms/
│   ├── Anti_Fraud_Specification.md
│   ├── Gamification_Design.md
│   └── Security_Threat_Model.md
│
├── 06_Database_Design/
│   ├── PostgreSQL_Database_Schema.md
│   ├── ERD.md
│   ├── Data_Dictionary.md
│   └── Migration_and_Seed_Plan.md
│
├── 07_Testing_and_QA/
│   ├── Test_Plan.md
│   ├── UAT_Test_Cases.md
│   ├── Acceptance_Criteria.md
│   ├── Mobile_Test_Plan.md
│   ├── Device_Test_Matrix.md
│   └── Bug_Report_Template.md
│
├── 08_Compliance_and_Privacy/
│   ├── Privacy_Policy.md
│   ├── Data_Retention_Policy.md
│   ├── Content_Moderation_Policy.md
│   ├── Store_Privacy_Data_Safety_Mapping.md
│   └── Terms_of_Service_Outline.md
│
├── 09_Operations_and_Maintenance/
│   ├── Backup_and_Disaster_Recovery.md
│   ├── Deployment_Guide.md
│   ├── Mobile_Release_Checklist.md
│   ├── Store_Submission_Readiness_Checklist.md
│   ├── Release_Notes.md
│   ├── Customer_Support_Guide.md
│   └── Monitoring_and_Incident_Runbook.md
│
└── assets/
    └── trustbite_architecture.png
```

---

## 2. Cách đọc theo vòng đời product

| Giai đoạn | Tài liệu bắt đầu | Kết quả cần có |
|---|---|---|
| Strategy | Project Charter, Product Model, Roadmap, MVP Scope | Hiểu sản phẩm làm gì, ai dùng, vì sao làm, thành công đo thế nào |
| Requirement | PRD, Functional Spec, User Stories, Business Rules, State Machines | Dev/QA hiểu đúng nghiệp vụ, edge case và trạng thái |
| Design | User Flows, Mobile/Admin Screen Spec, Design System, UX Writing | UI có đủ logic, trạng thái loading/empty/error/success và copy privacy/trust |
| Engineering | Architecture, API, OpenAPI, DB, Security, Development Guidelines | Có contract kỹ thuật, schema, guideline code/review |
| QA | Acceptance Criteria, Test Plan, UAT, Bug Report Template | Biết kiểm tra thế nào và báo lỗi ra sao |
| Release | CI/CD, Deployment Guide, Mobile Release Checklist, Release Notes | Có checklist build/deploy/rollback và ghi nhận bản phát hành |
| Store submission | Store Submission Readiness, Store Privacy/Data Safety Mapping, Mobile Release Checklist | Có metadata, privacy/data safety/account deletion/UGC/reviewer access đủ để gửi App Store/Google Play |
| Operation | Monitoring Runbook, Backup/DR, Customer Support Guide | Có dashboard, runbook, escalation và hướng dẫn CS/Ops |

Nguyên tắc chính: thay đổi P0 phải truy vết được từ Product → BA → UX → API → DB → QA → Release/Ops trong `Traceability_Matrix.md`.

---

## 3. Mức ưu tiên triển khai

| Mức ưu tiên | Nhóm việc | Tài liệu liên quan |
|---|---|---|
| P0 | Phạm vi MVP, quy tắc nghiệp vụ lõi, phân quyền, trạng thái nghiệp vụ | Project Charter, PRD, Functional Specification, Business Rules, Role Permission Matrix, State Machines |
| P0 | Hợp đồng API, mobile architecture và dữ liệu | API Specification, OpenAPI Guidelines, openapi.yaml, Idempotency and Retry Design, Mobile App Architecture, SRS, DB Schema, Status Mapping, Data Dictionary |
| P0 | Nghiệm thu và kiểm thử | Acceptance Criteria, UAT Test Cases, Test Plan, Mobile Test Plan, Device Test Matrix |
| P0 | App store readiness: privacy/data safety, account deletion, UGC report/block, reviewer access, age/content rating | Store Submission Readiness, Store Privacy/Data Safety Mapping, Privacy Policy, Content Moderation Policy, Mobile Release Checklist |
| P1 | Cổng chủ quán, kiểm duyệt nâng cao và notification | Functional Specification, SRS, API, DB, Mobile Release Checklist |
| P2 | Tóm tắt AI, nhiệm vụ bí mật, đồ thị gian lận nâng cao, hạ tầng quy mô lớn | Roadmap và tài liệu kỹ thuật tương lai |

---

## 4. Ranh giới MVP

MVP của TrustBite tập trung chứng minh 3 giả thuyết:

1. Người dùng có sẵn sàng tải hóa đơn để đổi lấy đánh giá đáng tin cậy không?
2. Đánh giá đã xác minh có làm tăng niềm tin khi chọn quán không?
3. Chủ quán có sẵn sàng tham gia nền tảng minh bạch hóa chất lượng không?

Các chức năng không phục vụ trực tiếp 3 giả thuyết này được chuyển sang V1.1 hoặc tương lai.

---

## 5. Tóm tắt công nghệ

TrustBite được định hướng **mobile-first**. Mobile app là client chính cho người dùng cuối; web được dùng cho admin portal và merchant portal.

| Lớp | Công nghệ đề xuất |
|---|---|
| Mobile app | React Native + TypeScript là phương án ưu tiên MVP; Flutter + Dart là phương án thay thế nếu team mạnh về Flutter |
| Admin portal | Next.js, TypeScript |
| Merchant portal | Next.js, TypeScript ở V1.1 hoặc khi cần kiểm chứng giả thuyết chủ quán |
| Backend | Node.js, NestJS, TypeScript, Prisma ORM |
| Database | PostgreSQL + PostGIS |
| Cache/Queue | Redis + BullMQ |
| OCR | AWS Textract hoặc OCR provider tương đương |
| Storage | S3-compatible object storage |
| Auth | OTP SMS, access token + refresh/session token |
| Infra | AWS container/managed services, RDS, S3, Redis, mobile beta distribution |

---

## 6. Điều kiện app-store-ready

Trước khi đưa TrustBite lên TestFlight, Google Play Internal/Closed Testing hoặc production, phải có đủ:

- Privacy Policy URL, Terms URL, Support URL và Account/Data Deletion URL công khai.
- Luồng xóa tài khoản trong app và web link/form theo store requirement.
- Mapping Apple App Privacy / Google Play Data Safety khớp dữ liệu thực tế và SDK đang dùng.
- UGC safety: lọc nội dung cơ bản, report review/user, block/restrict user và contact hỗ trợ.
- Reviewer access: demo account/OTP test/demo mode, backend hoạt động và seed data.
- Android target API/permission strategy và iOS permission purpose strings đã được rà soát.

Chi tiết nằm tại `09_Operations_and_Maintenance/Store_Submission_Readiness_Checklist.md` và `08_Compliance_and_Privacy/Store_Privacy_Data_Safety_Mapping.md`.

---

## 7. Quy tắc trạng thái tài liệu

Tài liệu chỉ được đánh dấu `Đã phê duyệt` khi có đủ:

- chủ sở hữu,
- phiên bản,
- người rà soát,
- tiêu chí nghiệm thu,
- tác động tới API/database/QA nếu có,
- ngày hiệu lực.

Trong giai đoạn phân tích, tài liệu nên để trạng thái `Bản nháp` hoặc `Đang rà soát`.
