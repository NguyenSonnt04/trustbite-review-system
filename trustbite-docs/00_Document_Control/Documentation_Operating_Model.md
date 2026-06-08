# Mô hình vận hành bộ tài liệu - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Mô hình vận hành tài liệu sống |
| Phiên bản | v1.0.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | PMO / Product Owner |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Bộ tài liệu TrustBite không được vận hành như một tập file mô tả tĩnh. Đây là **hệ thống tài liệu sống** đi theo vòng đời product: ý tưởng -> yêu cầu -> thiết kế -> phát triển -> kiểm thử -> release -> vận hành -> cải tiến.

Tài liệu phải giúp team trả lời nhanh 6 câu hỏi:

1. Sản phẩm làm gì?
2. Ai dùng?
3. Vì sao làm?
4. Làm như thế nào?
5. Làm xong kiểm tra ra sao?
6. Khi đưa vào chạy thì vận hành thế nào?

---

## 2. Mô hình nhóm tài liệu

Repo TrustBite giữ cấu trúc 10 thư mục hiện có để phù hợp với phạm vi Product, BA, UX, Engineering, Security, DB, QA, Compliance và Ops. Các thư mục này ánh xạ với mô hình vận hành product như sau:

| Lớp vận hành | Thư mục TrustBite | Vai trò |
|---|---|---|
| Document control | `00_Document_Control` | Danh mục, version, thuật ngữ, traceability, quy tắc cập nhật |
| Product strategy | `01_Product_Management` | Vision, charter, mô hình sản phẩm, roadmap, MVP scope, analytics |
| Product requirement | `01_Product_Management`, `02_Business_Analysis` | PRD, backlog, user story, rule, state machine, role/permission |
| UX/UI design | `03_UX_UI` | Flow, navigation, screen spec, design system, UX writing |
| Technical architecture | `04_Software_Engineering`, `05_Security_Algorithms`, `06_Database_Design` | Architecture, API, security, anti-fraud, database, migration |
| Development guideline | `04_Software_Engineering` | Quy chuẩn phát triển, Git workflow, code review, logging/error handling |
| QA/testing | `07_Testing_and_QA` | Test plan, test case, bug template, UAT, acceptance criteria, device matrix |
| Compliance/privacy | `08_Compliance_and_Privacy` | Privacy, retention, moderation policy |
| Release/deployment | `09_Operations_and_Maintenance`, `04_Software_Engineering/CI_CD_Pipeline.md` | Environment, deployment, release checklist, release notes, rollback |
| Operation/support | `09_Operations_and_Maintenance` | Monitoring, runbook, incident, backup/DR, support guide |

Không đổi tên thư mục theo `01_Product_Strategy`, `02_Product_Requirement`, ... để tránh phá liên kết hiện có. Thay vào đó, repo dùng tài liệu này để thống nhất cách đọc và vận hành.

---

## 3. Luồng truy vết bắt buộc

Mỗi thay đổi P0 phải truy vết được theo chuỗi:

```text
Product goal / hypothesis
  -> PRD requirement
  -> User story / business rule / state machine
  -> UX flow / screen spec / UX copy
  -> API contract / OpenAPI
  -> Database schema / data dictionary / migration
  -> Test case / UAT / acceptance criteria
  -> Release checklist / monitoring / runbook
```

`Traceability_Matrix.md` là điểm kiểm tra chính trước khi đưa capability P0 vào sprint hoặc release beta.

---

## 4. Quy tắc cập nhật theo loại thay đổi

| Loại thay đổi | Tài liệu phải kiểm tra/cập nhật |
|---|---|
| Đổi mục tiêu hoặc phạm vi MVP | `Project_Charter.md`, `MVP_Scope.md`, `Product_Requirements_Document_PRD.md`, `Product_Roadmap.md` |
| Thêm/sửa feature P0 | PRD, `Functional_Specification.md`, `User_Stories_Backlog.md`, `Business_Rules.md`, `Traceability_Matrix.md` |
| Đổi trạng thái nghiệp vụ | `State_Machines.md`, `Status_Mapping.md`, API, DB, QA/UAT |
| Đổi UX flow hoặc màn hình | `User_Flows.md`, screen spec liên quan, `Acceptance_Criteria.md`, tracking plan nếu có event |
| Đổi API | `API_Specification.md`, `openapi.yaml`, `OpenAPI_Guidelines.md` nếu cần, test contract |
| Đổi database | `PostgreSQL_Database_Schema.md`, `Data_Dictionary.md`, `ERD.md`, `Migration_and_Seed_Plan.md` |
| Đổi rule bảo mật/privacy | `Security_Threat_Model.md`, privacy/retention/moderation policy, release checklist |
| Đổi cách triển khai/release | `CI_CD_Pipeline.md`, `Deployment_Guide.md`, release checklist, runbook |
| Phát hiện bug production | `Monitoring_and_Incident_Runbook.md`, `Customer_Support_Guide.md`, incident note, test hồi quy |

---

## 5. Owner mặc định

| Nhóm tài liệu | Owner chính | Reviewer bắt buộc khi ảnh hưởng P0 |
|---|---|---|
| Strategy/PRD/Roadmap | Product Owner | BA, Engineering Lead, QA Lead |
| Business rule/state/permission | BA Lead | PO, Engineering Lead, QA Lead |
| UX/UI/screen/UX writing | UX Lead | PO, BA, Mobile/Admin Lead |
| API/architecture/development guideline | Engineering Lead | Security, QA, Mobile/Admin Lead |
| Security/privacy/anti-fraud | Security Lead | PO, Legal/Ops, Engineering Lead |
| Database/migration | DBA/Backend Lead | Engineering Lead, QA Lead |
| QA/UAT/bug template | QA Lead | PO, BA, Engineering Lead |
| Release/ops/runbook/support | DevOps/SRE/Ops Lead | PO, QA, Engineering Lead |

---

## 6. Definition of Ready cho tài liệu feature P0

Một feature P0 chỉ sẵn sàng đưa vào development khi có tối thiểu:

- Mục tiêu và out of scope trong PRD.
- User story và acceptance criteria.
- Business rule, validation và edge case chính.
- Trạng thái nghiệp vụ nếu feature có lifecycle.
- Flow/screen spec hoặc admin screen spec liên quan.
- API contract dự kiến hoặc xác nhận không cần API mới.
- DB impact hoặc xác nhận không đổi schema.
- Test case/UAT chính.
- Tracking event nếu feature ảnh hưởng funnel/product metric.
- Owner cho Product, Engineering và QA.

---

## 7. Definition of Done cho thay đổi tài liệu

Một thay đổi tài liệu được xem là hoàn tất khi:

- Không tạo mâu thuẫn với trạng thái, rule, API, DB và QA hiện có.
- Các tài liệu downstream đã được cập nhật nếu thay đổi ảnh hưởng P0.
- `Document_Index.md` có tài liệu mới hoặc trạng thái mới nếu cần.
- `Version_History.md` ghi nhận thay đổi đáng kể.
- `git diff --check` không báo lỗi whitespace.
- Tài liệu chưa được đánh dấu `Đã phê duyệt` nếu chưa đủ owner, reviewer, acceptance criteria và ngày hiệu lực.

---

## 8. Cách dùng nhanh theo vai trò

| Vai trò | Nên bắt đầu từ |
|---|---|
| Người mới vào team | `README.md`, `Glossary.md`, `Project_Charter.md`, `MVP_Scope.md` |
| Product/BA | PRD, Functional Spec, Business Rules, State Machines, Traceability Matrix |
| UX/UI | User Flows, Mobile/Admin Screen Spec, Design System, UX Writing Guidelines |
| Mobile/Admin/Web dev | SRS, API Specification, OpenAPI, Mobile/App architecture, Development Guidelines |
| Backend/DBA | Architecture, API, DB Schema, Data Dictionary, Migration Plan, Idempotency Design |
| QA | Acceptance Criteria, Test Plan, UAT, Device Matrix, Bug Report Template |
| DevOps/SRE/Ops | CI/CD, Deployment Guide, Release Checklist, Monitoring Runbook, Backup/DR |
| Support/CS | Customer Support Guide, Content Moderation Policy, Privacy Policy |
