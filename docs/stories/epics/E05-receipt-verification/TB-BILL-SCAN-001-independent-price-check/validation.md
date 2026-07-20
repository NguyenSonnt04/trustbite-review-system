# Validation

## Proof Strategy

Use deterministic Textract and Bedrock test doubles for repeatable contract
proof. A live AWS invocation is optional deployment proof and is not required
to claim local implementation.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Gemma JSON validation, unmatched mappings, delta threshold at 1,000/1,001 VND, overall result |
| Integration | auth, branch ownership, idempotency replay/conflict, persistence, owner-only reads, provider errors, private-field omission |
| E2E | Mobile select branch, scan, wait, and open result page |
| Platform | Flutter analyze and Android debug build |
| Performance | Bound menu/model payload and provider timeout |
| Logs/Audit | No image bytes, object URL, hash, prompt, OCR text, or credentials |

## Fixtures

- Active restaurant with two active branches.
- Available branch menu items with VND prices.
- OCR response containing matched, mismatched, and unknown items.
- Bedrock response mapping OCR indexes to menu item IDs.

## Commands

```text
npm run db:migrate
npm run server:test:unit
npm run server:test:integration
npm run server:build
npm run mobile:test
cd mobile && flutter analyze
cd mobile && flutter build apk --debug
```

## Acceptance Evidence

- `npm run db:migrate`: migrations through `013` current.
- `npm run server:test`: 710 passed, 4 provider tests skipped.
- `npm run server:build`: 154 server files passed syntax validation.
- `npm run mobile:test`: 108 passed.
- `flutter analyze mobile`: no issues.
- `flutter build apk --debug`: built
  `mobile/build/app/outputs/flutter-apk/app-debug.apk`.
- `npm run verify:tb-aws-localstack`: provider-boundary audit and claimed
  LocalStack S3/SES proof passed; Textract and Bedrock remain deterministic
  adapter proof because the local image reports those services unavailable.
