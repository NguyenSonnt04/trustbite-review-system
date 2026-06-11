# Design

## Domain Model

Use the canonical contract in `trustbite-docs/04_Software_Engineering/Review_Translation_Feature.md`.

`ReviewTranslation` is derived display data for a review comment, target locale, and source text hash. The original review comment remains authoritative.

## Application Flow

1. Client renders the original review comment.
2. User taps `Dịch`.
3. Client calls `POST /api/v1/reviews/{reviewId}/translation`.
4. Backend verifies auth and review visibility.
5. Backend computes the current source text hash.
6. Backend returns cache hit or calls Google Cloud Translation and stores the result.
7. Client displays translated text, `Được dịch tự động`, and `Xem bản gốc`.

## Interface Contract

See `trustbite-docs/04_Software_Engineering/Review_Translation_Feature.md` and `trustbite-docs/04_Software_Engineering/openapi.yaml`.

## Data Model

Implementation must add the `review_translations` cache table and the lookup index defined in the canonical spec.

## UI / Platform Impact

Review components need local state for original text, loading, translated text, error state, and toggle state.

## Observability

Logs and metrics should track request id, user id when available, review id, target locale, cache hit/miss, provider latency, and provider error class. Do not log full original or translated text.

## Alternatives Considered

1. Client-side Google Translate widget.
2. Auto-translate every review on load.
3. Bedrock/Claude translation.

All are out of scope for this story.
