# 0020 Report Reason Code Catalog (Provisional MVP Seed)

Date: 2026-07-10

## Status

Accepted

## Context

`moderation_reports.reason_code` is a NOT NULL foreign key to the seed table
`report_reason_codes(code)`. The schema baseline (`001_init_schema.sql`) creates
`report_reason_codes` but seeds no rows, and there is no committed seed mechanism
in the repo. Without seeded reason codes, every real
`POST /api/v1/moderation/reports` request fails the FK, so the P0 UGC-safety
report feature (SAFETY-001, BR-SAFE-002, BR-STORE-002) cannot function or be
tested in staging/UAT.

Product docs describe "chọn reason code và mô tả" but do not enumerate a full
catalog; only `SPAM_OR_FAKE` (REVIEW) appears, in the API spec example.

## Decision

Seed a small, provisional MVP catalog of `report_reason_codes` via idempotent
migration `008_seed_report_reason_codes.sql`, one set per `entity_type`:

- REVIEW: `SPAM_OR_FAKE`, `OFFENSIVE_CONTENT`, `IRRELEVANT_CONTENT`, `OTHER_REVIEW`
- USER: `ABUSIVE_BEHAVIOR`, `IMPERSONATION`, `SPAM_ACCOUNT`, `OTHER_USER`
- RESTAURANT: `INCORRECT_INFO`, `CLOSED_OR_NONEXISTENT`, `INAPPROPRIATE_LISTING`, `OTHER_RESTAURANT`

Codes are globally unique (the table PK is `code`), and the report service
validates that the chosen code's `entity_type` matches the reported entity type.

The catalog is explicitly PROVISIONAL. Product/Ops own the final taxonomy and
localized labels; the seed is idempotent so it can be extended without conflict.

## Alternatives Considered

1. Defer seeding entirely and rely on operators. Rejected: leaves the endpoint
   returning `422` for every request, so the P0 feature is non-functional and
   untestable end-to-end.
2. Seed only `SPAM_OR_FAKE`. Rejected: too thin to exercise USER/RESTAURANT
   report paths required by the contract.
3. Entity-prefixed codes (e.g. `REVIEW_SPAM_OR_FAKE`). Rejected: the API spec
   example uses the bare code `SPAM_OR_FAKE` for a REVIEW report.

## Consequences

Positive:

- The report endpoint is functional and testable in local/staging/UAT.
- Idempotent seed satisfies the Migration_and_Seed_Plan idempotency rule.

Tradeoffs:

- The specific codes/labels are provisional engineering choices, not a
  finalized product taxonomy.

## Follow-Up

- Product/Ops to confirm or replace the catalog and finalize localized labels.
- Extend the seed (idempotent) when the taxonomy is finalized.
