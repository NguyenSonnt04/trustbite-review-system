# Design

## Domain Model

`moderation_reports` (existing schema, not modified):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | `gen_random_uuid()` |
| `reporter_id` | UUID NOT NULL | FK `users(id)` ON DELETE RESTRICT |
| `entity_type` | VARCHAR(40) NOT NULL | CHECK in (`REVIEW`,`USER`,`RESTAURANT`) |
| `entity_id` | UUID NOT NULL | no FK (polymorphic target) |
| `reason_code` | VARCHAR(60) NOT NULL | FK `report_reason_codes(code)` |
| `description` | TEXT NULL | optional free text |
| `status` | VARCHAR(40) NOT NULL | default `SUBMITTED`; in (`SUBMITTED`,`UNDER_REVIEW`,`CLOSED`,`ACTION_TAKEN`) |
| | | `idx_reports_open_uniq(reporter_id, entity_type, entity_id) WHERE status NOT IN ('CLOSED','ACTION_TAKEN')` |

`report_reason_codes` is a seed table (`code` PK, `label`, `entity_type`). Seeded
by migration `008` with a provisional catalog (decision 0020).

## Application Flow

Input parsing/validation is done at the HTTP boundary
(`controllers/moderation.js`): `entityType` in the allowed set, `entityId` UUID,
`reasonCode` non-empty ≤ 60 chars, `description` optional string ≤ 1000 chars
(empty → null). The service receives normalized values.

`createReport(reporterId, { entityType, entityId, reasonCode, description })`:

1. Self-report guard (USER): `entityType === 'USER' && entityId === reporterId`
   → `422` (fast path, before the transaction).
2. In a transaction:
   - Look up `reasonCode`; missing → `422`; `entity_type` mismatch → `422`.
   - Verify the reported entity row exists in the mapped table
     (`REVIEW→reviews`, `USER→users`, `RESTAURANT→restaurants`); missing → `422`.
   - Self-report guard (owner-based): if the entity has an owner column
     (`REVIEW.user_id`) and it equals `reporterId` → `422`. RESTAURANT has no
     such guard — ownership is a merchant-claim relationship (merchant scope is
     P1/deferred), not a simple user id.
   - Pre-check for an existing open report by the same reporter for the same
     entity → `409 REPORT_DUPLICATE`.
   - Insert the report (`status = SUBMITTED`).
   - COMMIT and return `{ reportId, status }`.

The entity table is chosen from a fixed allow-list map keyed by the validated
`entityType`, so no user input reaches the SQL identifier.

## Interface Contract

`POST /api/v1/moderation/reports` (auth required)

- Body: `{ "entityType": "REVIEW"|"USER"|"RESTAURANT", "entityId": uuid,
  "reasonCode": string, "description"?: string }`
- `201` → `{ "reportId": uuid, "status": "SUBMITTED" }`
- Errors: `401 AUTH_REQUIRED`,
  `403 ACCOUNT_SUSPENDED` / `403 ACCOUNT_DELETED` (actor, via middleware),
  `409 DELETION_REQUEST_ACTIVE` (actor with open deletion request, via
  middleware), `409 REPORT_DUPLICATE`, `422 VALIDATION_ERROR`.

Note: the API spec does not define `404` for reports. A non-existent target
entity or unknown reason code is therefore returned as `422 VALIDATION_ERROR`,
not `404`.

## Data Model

No schema change. Migration `008` seeds `report_reason_codes` only (idempotent,
`ON CONFLICT DO NOTHING`; rollback documented in the migration). Postgres error
mapping: `23505` (open-report unique index) → `409 REPORT_DUPLICATE`, `23503`
(reason_code FK) → `422`, `22P02` → `422`.

## UI / Platform Impact

None in this slice. Mobile report UI (task 6.3) and admin triage (task 6.4) are
separate.

## Observability

No `moderation_actions` / `audit_logs` write on report creation: a submitted
report is a user action, and admin actions (which do write `moderation_actions`)
belong to task 6.4. Standard request logging applies.

## Alternatives Considered

1. Populate `admin_queues` (USER_REPORT) on report creation. Deferred:
   `moderation_reports.status` already represents the queue state; assignment
   semantics belong to admin processing (6.4).
2. Return `404` for unknown entity/reason. Rejected: not in the API contract.
