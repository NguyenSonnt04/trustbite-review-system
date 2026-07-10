# TB-REPORT-001 Report Review / User / Restaurant

## Current Behavior

The `moderation_reports`, `moderation_actions`, and `report_reason_codes` tables
and their models exist, but there is no service, controller, or route. Users
cannot report a review, user, or restaurant, so the UGC-safety report requirement
(SAFETY-001, BR-SAFE-002) is unmet in the backend. `report_reason_codes` is also
unseeded.

## Target Behavior

An authenticated user can submit a content/user report.

- `POST /api/v1/moderation/reports` with `{ entityType, entityId, reasonCode,
  description? }` creates a `SUBMITTED` moderation report and returns
  `{ reportId, status }`.
- `reasonCode` must exist in `report_reason_codes` and its `entity_type` must
  match the reported `entityType`.
- A reporter cannot hold two open reports for the same entity
  (`idx_reports_open_uniq`) → `409 REPORT_DUPLICATE`.
- Suspended/deleted actors cannot report (existing `authMiddleware` gate).
- `report_reason_codes` is seeded with a provisional MVP catalog (decision 0020).

## Affected Users

- Community users reporting abusive/spam/fake content or accounts.
- Admins/moderation ops who later triage `SUBMITTED` reports (task 6.4).

## Affected Product Docs

- `trustbite-docs/04_Software_Engineering/API_Specification.md` (§7 Kiểm duyệt)
- `trustbite-docs/02_Business_Analysis/Functional_Specification.md` (SAFETY-001)
- `trustbite-docs/02_Business_Analysis/Business_Rules.md` (BR-SAFE-002)
- `trustbite-docs/08_Compliance_and_Privacy/Content_Moderation_Policy.md`
- `trustbite-docs/06_Database_Design/Data_Dictionary.md`

## Non-Goals

- Admin moderation queue / triage / `moderation_actions` writes (task 6.4).
- Populating `admin_queues` (USER_REPORT) — deferred to admin processing; the
  `moderation_reports.status` value is the queue state for MVP.
- Block/unblock (TB-BLOCK-001, delivered).
- Finalizing the reason-code taxonomy (provisional per decision 0020).

## Status

in-progress
