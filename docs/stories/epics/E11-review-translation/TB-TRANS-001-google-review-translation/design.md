# Design

## Domain Model

`ReviewTranslation` is derived display data for one review comment, one target locale, and one exact source text hash.

Business rules:

- Original review text remains canonical.
- Translations are generated only on user request.
- Translation is allowed only for reviews the caller can view.
- Hidden, deleted, rejected-private, or unauthorized reviews are not translated.
- Translation output is not used for trust score, fraud scoring, receipt verification, or moderation decisions.
- If the review comment changes, cached translations for the old source hash must not be reused.

## Application Flow

1. Client renders review comment in its original language.
2. Client decides whether to show `Translate` using known locale metadata or a simple language mismatch hint. The server remains authoritative for whether translation can happen.
3. User taps `Translate`.
4. Client calls `POST /api/v1/reviews/{reviewId}/translation` with `targetLocale`.
5. Backend validates auth, path params, request body, target locale, and review visibility.
6. Backend computes a stable SHA-256 hash of the current review comment.
7. Backend checks `review_translations` for `(review_id, target_locale, source_text_hash)`.
8. Cache hit: backend returns cached translation.
9. Cache miss: backend calls Google Cloud Translation through `translationService`, stores the result, and returns it.
10. Client displays translated text, `Automatically translated`, and `View original`.
11. User taps `View original`; client restores original text from local state.

## Interface Contract

Route:

```http
POST /api/v1/reviews/{reviewId}/translation
Authorization: Bearer <access token>
Content-Type: application/json
```

Request:

```json
{
  "targetLocale": "vi"
}
```

Response:

```json
{
  "reviewId": "uuid",
  "sourceLocale": "en",
  "targetLocale": "vi",
  "originalTextHash": "sha256...",
  "translatedText": "Mon an rat ngon, phuc vu nhanh.",
  "provider": "GOOGLE_TRANSLATE",
  "cached": false
}
```

Errors:

| Status | Code |
| ---: | --- |
| 401 | `AUTH_REQUIRED` |
| 403 | `REVIEW_NOT_VISIBLE` |
| 404 | `REVIEW_NOT_FOUND` |
| 409 | `REVIEW_TRANSLATION_STALE` |
| 422 | `UNSUPPORTED_TARGET_LOCALE` |
| 422 | `TRANSLATION_TEXT_EMPTY` |
| 429 | `TRANSLATION_RATE_LIMITED` |
| 503 | `TRANSLATION_PROVIDER_UNAVAILABLE` |

## Data Model

Suggested table:

```sql
CREATE TABLE review_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  target_locale VARCHAR(10) NOT NULL,
  source_locale VARCHAR(10),
  source_text_hash TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'GOOGLE_TRANSLATE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, target_locale, source_text_hash)
);
```

Index notes:

- The unique key supports cache lookup.
- Add an index on `review_id` if query plans require review-level cleanup.

Retention:

- Hard-deleted reviews cascade-delete translations.
- Soft-deleted/private reviews may keep cache rows internally but must not return them via API.
- Account deletion behavior follows review retention. If review text is deleted or anonymized, related translations must be deleted or become inaccessible.

## Provider Design

Use Google Cloud Translation from backend services only.

Suggested modules:

- `server/src/config/google.js`
- `server/src/services/translationService.js`
- `server/src/services/reviewTranslationService.js`

Provider constraints:

- No Google credentials in client code.
- No committed credential files.
- Provider timeout maps to `TRANSLATION_PROVIDER_UNAVAILABLE`.
- Only review comment text and target locale are sent for this feature.
- Do not send user phone number, token, GPS, receipt image, OCR text, or internal audit data.

## UI / Platform Impact

Review comment component state:

- `original`
- `loadingTranslation`
- `translated`
- `translationError`
- `showingOriginal`

Controls:

- Initial: `Translate`
- Loading: disabled inline spinner or text.
- Translated: `View original` plus `Automatically translated`.
- Error: keep original text and show `Translation is unavailable right now`.

The UI must avoid layout jump in dense review lists and must not fetch translations automatically during list rendering.

## Observability

Operational logs should include:

- request id,
- user id when available,
- review id,
- target locale,
- cache hit/miss,
- provider latency bucket,
- provider error code when applicable.

Logs must not include full review text, translated text, tokens, phone numbers, GPS, receipt OCR text, or provider credentials.

Metrics to consider:

- translation requests,
- cache hit rate,
- provider call count,
- provider failures/timeouts,
- rate-limit rejections.

## Alternatives Considered

1. Client-side Google Translate widget.
   - Rejected because it exposes provider behavior outside TrustBite control and does not fit API/privacy boundaries.
2. Auto-translate all comments.
   - Rejected due to cost, latency, and unnecessary provider exposure.
3. Use Bedrock/Claude for translation.
   - Deferred because the user requested Google and Google Cloud Translation is purpose-built for this feature.
