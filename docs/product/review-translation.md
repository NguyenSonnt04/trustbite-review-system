# Review Translation

## Purpose

TrustBite should let users read review comments in their preferred language without replacing the original review text. The feature behaves like a social app translation control: show the original comment first, let the user request a translation, then let the user return to the original.

## Product Behavior

- Review comments remain stored and displayed as originally written.
- If a review comment appears to be in a language different from the current app/user locale, the client may show a `Translate` action.
- When the user taps `Translate`, the client calls the TrustBite backend. The backend translates the review comment with Google Cloud Translation and returns translated text.
- After translation, the client shows the translated text, a small automatic-translation label, and a `View original` action.
- `View original` must not call the backend again; it only toggles the local UI back to the original text.
- Translation failures must leave the original text visible.

## Non-Goals

- Do not overwrite review comments with translated text.
- Do not use translated text for trust score, fraud scoring, receipt verification, or moderation decisions.
- Do not expose Google credentials to browser or mobile clients.
- Do not auto-translate every review on page load.
- Do not translate private, hidden, deleted, or otherwise unauthorized review content.

## Source Of Truth

The original `reviews.comment` value is the source of truth. A translation is derived display data. If the original comment changes, previously cached translations are invalid unless their source text hash still matches the current text.

## Provider

Production translation uses Google Cloud Translation through backend provider code.

Backend requirements:

- Google calls live behind `server/src/services/` and config modules.
- Credentials are configured with environment or secret management, never committed to source.
- The client calls only TrustBite APIs.
- Provider errors are mapped to stable API errors.

Suggested configuration:

```text
GOOGLE_TRANSLATION_PROJECT_ID=<project-id>
GOOGLE_TRANSLATION_LOCATION=global
GOOGLE_APPLICATION_CREDENTIALS=<runtime-secret-or-mounted-path>
```

## API Contract

Endpoint:

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
  "cached": true
}
```

Required errors:

| Status | Code | Meaning |
| ---: | --- | --- |
| 401 | `AUTH_REQUIRED` | User must be logged in. |
| 403 | `REVIEW_NOT_VISIBLE` | User is not allowed to view this review. |
| 404 | `REVIEW_NOT_FOUND` | Review does not exist or is not visible. |
| 409 | `REVIEW_TRANSLATION_STALE` | Cached source hash no longer matches current review text. |
| 422 | `UNSUPPORTED_TARGET_LOCALE` | Target locale is not supported. |
| 422 | `TRANSLATION_TEXT_EMPTY` | Review has no translatable comment text. |
| 429 | `TRANSLATION_RATE_LIMITED` | User or IP exceeded translation quota. |
| 503 | `TRANSLATION_PROVIDER_UNAVAILABLE` | Google provider is unavailable or timed out. |

## Data Model

Use a cache table so repeated translation requests do not repeatedly call Google.

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

Retention follows review retention. If a review is hard-deleted, translations should be deleted by cascade. If a review is soft-deleted, translations must not be returned to users.

## Rate Limits And Cost Controls

- Translate only on user action.
- Cache by `reviewId + targetLocale + sourceTextHash`.
- Limit translated input length. MVP default: 5,000 characters per request.
- Apply per-user translation limits. MVP default proposal: 60 translation requests per hour.
- Track provider call count separately from cache hits.

## Privacy And Store Notes

Review comment text is user-generated content. When translated, TrustBite sends the comment text to Google Cloud Translation. Privacy, vendor, and store data-safety documentation must disclose this provider use before production release.

Do not send phone numbers, tokens, GPS coordinates, receipt OCR text, receipt images, or hidden/deleted review data to the translation provider for this feature.

## UX Copy

Recommended English labels:

- `Translate`
- `View original`
- `Automatically translated`
- `Translation is unavailable right now`

Recommended Vietnamese labels:

- `Dịch`
- `Xem bản gốc`
- `Được dịch tự động`
- `Không dịch được lúc này`

## Acceptance Criteria

- A visible review with a different detected/source language can show `Translate`.
- Tapping `Translate` replaces the comment text with the translated text and shows `View original`.
- Tapping `View original` restores the original comment without another API call.
- Repeated requests for the same review, target locale, and source text hash return cached results.
- The backend rejects unauthorized, hidden, deleted, or unavailable reviews.
- Provider credentials never appear in client code or committed source.
- Provider failure returns a stable error and the UI keeps the original comment visible.
- API markdown, OpenAPI, privacy/vendor docs, and validation evidence are updated before implementation is marked complete.
