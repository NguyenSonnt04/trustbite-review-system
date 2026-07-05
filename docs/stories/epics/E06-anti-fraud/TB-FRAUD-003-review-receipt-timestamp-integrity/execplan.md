# Exec Plan

## Goal

Prevent silent loss of receipt capture timestamp evidence and reject impossible future review visit timestamps.

## Scope

In scope:

- Add nullable `receipt_verifications.captured_at` through a versioned migration.
- Persist validated receipt `capturedAt` in receipt upload service SQL.
- Keep receipt `capturedAt` in idempotency request hashing.
- Reject future review `visitedAt` values before review insert.
- Add unit tests for timestamp persistence/validation and duplicate receipt hash fraud flag behavior.
- Update product verification documentation.

Out of scope:

- OCR extraction, receipt age scoring, or GPS proximity persistence beyond the existing upload fields.
- New public response fields for receipts.
- Changing duplicate hash index semantics.

## Risk Classification

Risk flags:

- Data model: adds a receipt timestamp evidence column.
- Audit/security: affects fraud evidence and duplicate-hash handling.
- Public contracts: future `visitedAt` becomes a validation error.
- Weak proof: receipt/review creation coverage was limited before this fix.

Hard gates:

- Data migration.
- Audit/security-adjacent anti-fraud behavior.

## Work Phases

1. Discovery: confirm receipt/review service SQL and current migration/index names.
2. Design: choose nullable `captured_at` rather than overloading OCR or server timestamps.
3. Validation planning: unit tests plus migration proof when local PostgreSQL is available.
4. Implementation: migration, service/model changes, validation guard.
5. Verification: targeted unit tests, server syntax check, migration/proof if infrastructure is available.
6. Harness update: record the missing local Harness CLI blocker if matrix commands cannot run.

## Stop Conditions

Pause for human confirmation if:

- Product asks `capturedAt` to become a trust-improving signal.
- Duplicate hash policy changes away from `status NOT IN ('OCR_FAILED')`.
- Migration fails against local PostgreSQL and schema direction is unclear.
- Validation requirements need to be weakened.
