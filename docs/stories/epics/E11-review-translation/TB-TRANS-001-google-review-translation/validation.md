# Validation

## Proof Strategy

The story is complete only when the backend, UI, provider boundary, cache behavior, and documentation are all proven. Provider calls should be tested with a mocked Google service in automated tests and a controlled real-provider smoke only when credentials are available.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Validate `targetLocale`; compute stable source text hash; select cache hit/miss; map Google timeout/error to `TRANSLATION_PROVIDER_UNAVAILABLE`; reject empty comment. |
| Integration | `POST /reviews/{reviewId}/translation` returns translation for visible review; returns cached result on second request; rejects hidden/deleted/unauthorized review; returns `UNSUPPORTED_TARGET_LOCALE`; handles provider failure. |
| E2E | User taps `Translate`, sees translated text and `View original`; tapping `View original` restores original without another network call; provider failure keeps original visible. |
| Platform | Mobile and web review list/detail layouts do not shift or hide controls in long comments. |
| Performance | Translation request stays bounded by provider timeout; cache hit avoids provider call; long comments over limit are rejected or trimmed according to final API decision. |
| Logs/Audit | Logs include request id, user id, review id, target locale, cache hit/miss, provider latency; logs exclude full text, tokens, phone, GPS, OCR text, and credentials. |

## Fixtures

- User A with an English review visible to User B.
- User B app locale `vi`.
- Hidden review.
- Deleted review.
- Unauthorized/private review if the implementation has private visibility.
- Mock Google provider success response.
- Mock Google provider timeout.
- Existing cached translation row matching review id, target locale, and source text hash.
- Stale cached translation row with non-matching source text hash.

## Commands

Use the smallest available command set. Current repo notes say there is no automated server test/lint/build command yet, so implementation must add or document a backend validation path before claiming automated proof.

```text
npm run client:build
npm run dev
npm run harness -- query matrix
```

`npm run harness -- query matrix` is currently blocked locally when the Harness CLI binary is missing.

## Acceptance Evidence

To be filled during implementation:

- API docs updated.
- OpenAPI updated.
- Privacy/vendor docs updated.
- Migration/model added if cache table is implemented.
- Automated tests or documented backend validation path added.
- Manual UI smoke evidence recorded.
