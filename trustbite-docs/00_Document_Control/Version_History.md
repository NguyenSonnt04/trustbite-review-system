# Lịch sử phiên bản tài liệu - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Lịch sử phiên bản |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | PMO |
| Ngày cập nhật | 2026-06-07 |

---

| Phiên bản | Ngày | Tác giả | Tóm tắt | Trạng thái |
|---|---|---|---|---|
| v1.0.0 | 2026-06-01 | Initial Team | Bộ tài liệu ý tưởng/định hướng kỹ thuật ban đầu | Đã thay thế |
| v2.0.0 | 2026-06-07 | Rà soát tài liệu | Chuẩn hóa cấu trúc, tách MVP/V1/Tương lai, bổ sung BA/API/DB/QA docs | Đang rà soát |
| v2.1.0 | 2026-06-07 | Gộp cập nhật repo | Kéo cập nhật mới nhất từ repo, thêm sơ đồ kiến trúc và đồng bộ tài liệu hạ tầng AWS theo chuẩn MVP | Đang rà soát |
| v2.2.0 | 2026-06-07 | Rà soát mobile-first | Cập nhật định hướng mobile-first, bổ sung mobile architecture, UX mobile, analytics, OpenAPI, threat model, mobile QA và release checklist | Đang rà soát |
| v2.3.0 | 2026-06-07 | Chuẩn hóa implementation-ready MVP | Chốt multipart upload, idempotency, skip receipt thành REFERENCE_ONLY, notification P1/refetch MVP, decision-state mapping, backlog sprint-ready, admin portal spec, monitoring/runbook và privacy consent copy | Đang rà soát |
| v2.4.0 | 2026-06-07 | Bổ sung production-readiness baseline | Thêm traceability matrix, status mapping API/DB/UI, idempotency retry design, OpenAPI baseline, migration/seed plan và cập nhật DB/API/index liên quan | Đang rà soát |
| v2.5.0 | 2026-06-07 | Chuẩn hóa tài liệu sống | Bổ sung mô hình vận hành tài liệu theo vòng đời product, product model, UX writing, development guideline, deployment guide, release notes, bug template và support guide | Đang rà soát |
| v2.6.0 | 2026-06-07 | Rà soát product/store readiness | Chuẩn hóa ngày tài liệu, thêm checklist App Store/Google Play, mapping Privacy/Data Safety, luồng xóa tài khoản, UGC report/block và cập nhật API/DB/QA liên quan | Đang rà soát |

## Quy tắc kiểm soát thay đổi

- Mọi thay đổi P0 phải cập nhật PRD, Functional Spec, SRS, API/DB nếu bị ảnh hưởng.
- Mọi thay đổi trạng thái nghiệp vụ phải cập nhật State Machines và Test Cases.
- Mọi thay đổi API phải cập nhật API Specification, `openapi.yaml` và QA regression checklist.
- Mọi thay đổi P0 phải cập nhật `Traceability_Matrix.md`.
- Tài liệu chỉ chuyển `Đã phê duyệt` sau khi PO, BA, Engineering và QA sign-off.
- Mọi tài liệu mới hoặc đổi cách vận hành tài liệu phải cập nhật `Document_Index.md` và xem xét cập nhật `Documentation_Operating_Model.md`.