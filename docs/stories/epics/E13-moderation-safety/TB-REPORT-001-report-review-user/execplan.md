# Exec Plan

## Goal

Deliver the backend report vertical slice (task 6.1, PHASE 6 — Moderation &
Compliance) satisfying SAFETY-001 / BR-SAFE-002: authenticated users can report a
review, user, or restaurant into the moderation pipeline.

## Scope

In scope:

- `POST /api/v1/moderation/reports` route + controller (boundary validation) +
  `moderationService.createReport`.
- Idempotent seed of `report_reason_codes` (migration 008) + decision 0020.
- Boundary + service unit tests and a live-DB integration test.

Out of scope:

- Admin triage, `moderation_actions`, report status transitions (task 6.4).
- `admin_queues` population.
- Mobile/admin UI.
- Finalizing the reason-code taxonomy.

## Risk Classification

Risk flags:

- Authorization (authenticated action, actor state).
- Data model (idempotent seed data into an existing table).
- Public contracts (new API endpoint).
- Persistence (writes to `moderation_reports`).

Hard gates:

- Authorization + public contract → high-risk.

No new table/column/index/constraint is introduced; migration 008 is seed data
only, recorded via decision 0020.

## Work Phases

1. Discovery — README, intake, architecture, context rules, API spec, business
   rules, moderation policy, schema, models. (done)
2. Design — flow, contract, reason-code validation, duplicate guard. (done)
3. Validation planning — unit (boundary + service) + integration cases.
4. Implementation — migration/seed, service, controller, route mount.
5. Verification — `db:migrate`, `server:test:unit`, integration on live PG,
   `server:build`.
6. Harness update — story record + matrix + decision 0020.

## Stop Conditions

Pause for human confirmation if:

- The finalized reason-code taxonomy must be committed as product truth.
- Report creation is asked to trigger admin actions or status transitions
  (belongs to 6.4).
- A schema/column beyond seeding `report_reason_codes` is required.
