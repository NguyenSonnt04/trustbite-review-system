# Validation

## Proof Strategy

Prove owner scoping and idempotency at service/API boundaries, then prove the
Flutter state machine independently with deterministic fake services. Database
proof must show all review-verification side effects commit together and roll
back without residue.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Pagination validation, owner-scoped read, idempotent mark-read, verified EXP/rank/badge awards, duplicate processing, private payload allowlist |
| Integration | Auth required, recipient isolation, newest-first pagination, unread count, mark-read idempotency, verified review creates exactly-once awards and notifications |
| E2E | Authenticated mobile opens API-backed list and marks a row read |
| Platform | Flutter loading, empty, error/retry, refresh, accessibility semantics, Android debug build |
| Performance | Pagination capped at 100 rows; indexed recipient/time query |
| Logs/Audit | No sensitive notification payload data in logs; existing receipt decision audit retained |

## Fixtures

- Two authenticated users.
- Verified receipt/review fixture.
- Ten consecutive verified reviews for `RECEIPT_MASTER`.
- Five first-verified restaurant reviews for `EXPLORER`.
- Read and unread notifications owned by different users.

## Commands

```text
npm run db:migrate
npm run server:test:unit
npm run server:test:integration
npm run server:build
npm run mobile:test
cd mobile && flutter analyze --no-pub
cd mobile && flutter build apk --debug --no-pub
npm run harness -- story verify TB-NOTIF-001
```

## Acceptance Evidence

Verified on 2026-07-15:

- `npm run db:migrate`: current through migration `011`.
- Migration `011` reconciliation SQL executed inside a local transaction and
  rolled back successfully.
- `npm run server:test:unit`: 351 passed.
- `npm run server:test:integration`: 134 passed, 4 provider tests skipped.
- `npm run server:build`: syntax passed for 125 files.
- `npm run mobile:test`: 44 passed.
- `flutter analyze --no-pub`: no issues.
- `flutter build apk --debug --no-pub`: debug APK built; only existing
  Gradle/AGP/Kotlin deprecation warnings were reported.
- `harness-cli.exe story verify TB-NOTIF-001`: passed.
- Final high-confidence code review found no remaining P0/P1 defects.

Manual device E2E was not recorded, so the Harness E2E flag remains false.
FCM/APNs delivery, token registration, and OS notification permission prompts
and native permission strings remain deferred to the separate push-provider
slice.
