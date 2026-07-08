# Design

## Domain Model

`reviews` owns the user-authored review and the visible verification lifecycle.
`receipt_verifications` owns receipt evidence, OCR fields, fraud decisions, and
receipt-specific status. A review may accept one active receipt while it is in
the initial `SUBMITTED/UNVERIFIED` state.

## Application Flow

1. `POST /api/v1/reviews` validates the authenticated user's payload, restaurant
   state, optional branch ownership, and merchant self-review rule, then creates
   a private pending review.
2. `POST /api/v1/receipts` validates idempotency, ownership, file type, optional
   GPS/capture metadata, active receipt uniqueness, duplicate file hash, and S3
   storage. It persists the receipt and moves the review to `PROCESSING`.
3. After the receipt transaction commits, the backend enqueues
   `enqueueReceiptOcr(receiptVerificationId)`.
4. The OCR worker and verification service from `TB-FRAUD-001` update the receipt
   and review states.
5. `GET /api/v1/reviews/:reviewId/status` returns the owner-scoped status for
   polling.

## Interface Contract

`POST /api/v1/reviews`

- Success: `201 { reviewId, status: "SUBMITTED", nextStep: "UPLOAD_RECEIPT" }`.
- Validation errors: `422 VALIDATION_ERROR`, `RESTAURANT_NOT_ACTIVE`.
- Auth/ownership errors: `401 AUTH_REQUIRED`, `403 FORBIDDEN`.

`POST /api/v1/receipts`

- Multipart field: receipt image.
- Header: `Idempotency-Key`.
- Body fields: `reviewId`, `restaurantId`, optional `latitude`, `longitude`,
  `gpsAccuracyMeters`, `capturedAt`.
- Success: `202 { receiptVerificationId, status: "UPLOADED", processingStatus:
  "HASH_CHECKING" }`.
- Duplicate hash/idempotency errors: `409 DUPLICATE_RECEIPT_HASH`,
  `REQUEST_IN_PROGRESS`, `RECEIPT_ALREADY_UPLOADED`.

`GET /api/v1/reviews/:reviewId/status`

- Success: review status fields plus latest receipt status/decision metadata.
- Non-owner and missing rows both return `404 NOT_FOUND`.
- Private receipt file URLs and receipt hashes are not returned.

## Data Model

No migration is needed for this closeout. Existing `reviews` and
`receipt_verifications` columns cover submitted, processing, verified, rejected,
reference-only, and pending-admin-review states.

## UI / Platform Impact

No UI, mobile, or admin UI implementation is included. The endpoint shape is
intended for future web/mobile polling.

## Observability

OCR and verification audit evidence remains in the `TB-FRAUD-001` receipt
verification services. This closeout records Harness evidence for the review
backend lifecycle and status API.

## Alternatives Considered

1. Add a receipt-specific status endpoint now. Deferred because Phase 4 backend
   closeout only requires users to view their review/receipt state, which the
   owner-scoped review status endpoint covers.
2. Enqueue OCR before commit. Rejected because workers must only see committed
   receipt rows.
