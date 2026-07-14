# Reviews Product Contract

Reviews are authenticated user submissions tied to a restaurant and optional
branch. A review becomes trusted only after backend receipt/OCR verification
finishes; clients may show progress, but must not decide trust outcomes.

## Create Review

`POST /api/v1/reviews` is protected by Cognito-backed Express auth plus local
TrustBite account-state checks.

Request body:

- `restaurantId`: required UUID for an active, non-deleted restaurant.
- `branchId`: optional UUID; when present, it must belong to the restaurant and
  be active.
- `foodRating`, `priceRating`, `serviceRating`, `ambienceRating`: integers from
  1 to 5.
- `comment`: required trimmed text with at least 50 characters.
- `visitedAt`: optional ISO-8601 datetime, never in the future.

Rules:

- Suspended, deleted, or review-restricted users cannot create reviews.
- Active merchants cannot review their own restaurant.
- Creation stores a `SUBMITTED` review with `verification_status=UNVERIFIED`,
  `trust_label=PENDING_VERIFICATION`,
  `public_visibility=PRIVATE_UNTIL_DECISION`, and `trust_weight_bucket=NONE`.
- Success returns `201` with `reviewId`, `status`, and
  `nextStep=UPLOAD_RECEIPT`.

## Receipt Upload

`POST /api/v1/receipts` accepts one multipart receipt image for the authenticated
owner's submitted review. The endpoint requires an `Idempotency-Key` header.

Rules:

- The review must belong to the authenticated user and be in the
  `SUBMITTED/UNVERIFIED` pre-receipt state.
- `restaurantId` must match the review restaurant. This remains explicit in the
  Phase 4 backend API to catch stale clients; a future API simplification may
  derive it from `reviewId` only.
- Supported receipt files are JPG/JPEG, PNG, HEIC, and HEIF within the backend
  size limit.
- Latitude, longitude, and positive GPS accuracy are required together.
  `capturedAt` remains optional metadata. Invalid or incomplete GPS evidence is
  rejected before storage or persistence.
- The selected restaurant or branch must have backend coordinates available;
  otherwise receipt upload fails closed because proximity cannot be verified.
- S3 object handling stays behind `server/src/services/s3ReceiptStorageService.js`.
  The API persists private `s3://...` object references, never public URLs or
  public ACLs.
- Duplicate non-failed receipt image hashes are rejected as
  `DUPLICATE_RECEIPT_HASH` and record a fraud flag when persistence is
  available.
- On successful persistence, the review moves to
  `verification_status=PROCESSING`, `trust_label=PROCESSING`, and the receipt
  OCR job is enqueued after the database transaction commits.
- If the post-commit OCR enqueue is unavailable, the already-persisted receipt
  is not rolled back or deleted. The backend parks the receipt and review at
  `PENDING_ADMIN_REVIEW`, records system audit/idempotency evidence, and returns
  that durable state so clients can poll the status API instead of trusting a
  non-existent queue job. Queue/provider error messages are not persisted into
  receipt decision metadata returned by the status API; users receive a fixed
  public manual-review reason.

## Verification Lifecycle

Receipt OCR and verification are owned by `TB-FRAUD-001` and provider/service
boundaries under `server/src/services/`. Review lifecycle states are synchronized
by the backend:

| Outcome | Review status | Verification status | Visibility | Trust weight |
| --- | --- | --- | --- | --- |
| Pending receipt/OCR | `SUBMITTED` | `PROCESSING` | `PRIVATE_UNTIL_DECISION` | `NONE` |
| Verified | `VERIFIED` | `VERIFIED` | `PUBLIC` | high/full bucket from verification |
| Rejected | `REJECTED` | `REJECTED` or `DUPLICATE_REJECTED` | `PRIVATE` | `NONE` |
| Reference only | `REFERENCE_ONLY` | `REFERENCE_ONLY` | `PRIVATE` | `NONE` |
| Admin review | `PENDING_ADMIN_REVIEW` | `PENDING_ADMIN_REVIEW` | `PRIVATE` | `NONE` |

## Status API

`GET /api/v1/reviews/:reviewId/status` is protected and owner-scoped. It returns
the authenticated user's review status and latest receipt decision metadata.
Non-owners receive `404 NOT_FOUND` to avoid leaking review existence.

The response omits private storage details such as receipt file URLs and hashes.

## Out Of Scope

Phase 4 backend closeout does not implement review UI, mobile review flows,
admin moderation UI, or public polling UX. Those remain separate UI/mobile/admin
stories.

`TB-MOBILE-REVIEW-001` adds the mobile review flow. Only `VERIFIED` reviews may
be public or affect restaurant ratings; every other outcome remains private.
