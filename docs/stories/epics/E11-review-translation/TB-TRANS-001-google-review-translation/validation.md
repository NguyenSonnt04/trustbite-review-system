# Validation

## Proof Strategy

Prove API validation, cache behavior, authorization/visibility behavior, provider failure handling, and client toggle behavior before marking the story complete.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Validate `targetLocale` pattern; compute source hash; reject empty comment; map provider timeout to stable error. |
| Integration | Visible review translates; cache hit avoids provider call; hidden/deleted/unauthorized review is rejected; unsupported locale is rejected. |
| E2E | User taps `Dịch`, sees translated text, then taps `Xem bản gốc` without a second provider call. |
| Platform | Review list/detail layout remains stable for loading, translated, original, and error states. |
| Performance | Provider timeout is bounded; cache hit is fast; rate limit rejects abusive callers. |
| Logs/Audit | Logs omit full text, tokens, phone numbers, GPS, OCR text, and credentials. |

## Fixtures

- Visible review with non-empty comment.
- Hidden review.
- Deleted review.
- Unauthorized review.
- Mock Google success.
- Mock Google timeout/failure.
- Existing cache row for `(review_id, target_locale, source_text_hash)`.

## Commands

```text
npm run client:build
npm run harness -- query matrix
```

Current repo notes: no automated server test/lint/build command exists yet; implementation must add or document backend proof.

## Acceptance Evidence

To be filled during implementation.
