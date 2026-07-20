# Validation

## Proof Strategy

Prove the provider request, authorization boundary, validation rules,
transactional persistence, primary replacement, audit record, idempotent
replay, compensation, public API propagation, and mobile rendering.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Private S3 put/get-sign/delete, owned-reference validation, signed URL TTL, config failures, file validation, persistence compensation. |
| Integration | `401`, `403`, admin success, fresh signed URL on idempotent replay, conflict, missing restaurant, invalid file, primary replacement, DB/audit persistence, public list/detail propagation. |
| E2E | Upload a disposable image to configured AWS, verify API URL and Flutter card/detail, then delete test data/object. |
| Platform | Server syntax and existing Flutter suite/analyze/build. |
| Logs/Audit | No secret or byte logging; successful upload has an audit row. |

## Fixtures

- Ordinary user and local-role administrator.
- Active and soft-deleted restaurants.
- Deterministic in-memory JPEG/PNG/WebP fixtures.
- Mock S3 success/failure responses for automated tests.

## Commands

```text
npm run db:migrate
npm run server:test
npm run server:build
npm run mobile:test
flutter analyze mobile
```

## Acceptance Evidence

- Focused signed-delivery proof passed 40 tests.
- Full server suite passed 340 tests with 2 provider cleanup tests skipped.
- Full mobile suite passed 61 tests and `flutter analyze mobile` reported no
  issues.
- `npm run server:build` passed 104 files.
- `npm run db:migrate` confirmed the schema is current with zero new
  migrations.
- Live AWS E2E requires the private restaurant-image bucket, IAM
  `PutObject/GetObject/DeleteObject` permissions, and the bucket/TTL runtime
  environment values. CloudFront is not required for this delivery mode.
