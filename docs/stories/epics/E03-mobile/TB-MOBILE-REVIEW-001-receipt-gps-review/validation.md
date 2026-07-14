# Validation

## Backend

- Missing or partial GPS evidence is rejected before storage or persistence.
- Non-positive GPS accuracy is rejected.
- Only verified reviews are public and included in restaurant ratings.
- Rejected, reference-only, and pending outcomes remain private.
- Review ownership and private receipt metadata protections remain intact.

## Mobile

- Guests are routed through authentication before reviewing.
- Ratings, 50-character comment, receipt, and GPS are required.
- Multipart upload includes auth, idempotency, receipt, and GPS fields.
- Processing, verified, private failure, retry, permission, and network states
  are rendered from backend responses.

## Commands

```text
npm run db:migrate
npm run server:test:unit
npm run server:test:integration
npm run server:build
npm run mobile:pubget
cd mobile && flutter analyze
npm run mobile:test
cd mobile && flutter build apk --debug --no-pub
```

## Evidence

2026-07-15:

- Full server suite passed: 61 files, 538 tests, 4 opt-in provider tests skipped.
- Full mobile suite passed: 43 tests.
- `flutter analyze` passed with no issues.
- Server syntax check passed for 132 files.
- Database migrations were current with 0 pending.
- Android debug APK built successfully.
- Harness story verification passed.
