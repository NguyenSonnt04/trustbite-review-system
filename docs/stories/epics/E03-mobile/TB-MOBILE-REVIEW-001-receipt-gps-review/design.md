# Design

## Flow

1. Mobile loads active restaurants from `GET /api/v1/restaurants`.
2. The user opens a restaurant and selects **Viết đánh giá**.
3. Guests complete the existing authentication and profile flow.
4. Mobile validates four ratings and a comment of at least 50 characters.
5. Mobile requires one receipt image and a current GPS fix.
6. Mobile creates the private review with `POST /api/v1/reviews`.
7. Mobile uploads multipart evidence to `POST /api/v1/receipts` with a stable
   UUID v4 `Idempotency-Key`.
8. Mobile polls `GET /api/v1/reviews/:reviewId/status`.

## Security And Trust Boundary

The client only collects evidence. Express validates ownership, account state,
restaurant state, receipt content, GPS fields, and verification results.
Only `VERIFIED` plus `PUBLIC` reviews may appear in public APIs or rating
aggregation.

## Failure Behavior

Location denial, unavailable GPS, missing receipt, upload failure, rejected
verification, and reference-only verification remain non-public. Private
submitted reviews may be resumed after an interrupted evidence upload.
