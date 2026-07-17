# TB-MOBILE-REVIEW-001: Submit Verified Mobile Reviews

## Status

in-progress

## Lane

high-risk

## Product Contract

Signed-in mobile users can submit four restaurant ratings and a comment
immediately. A receipt image is optional: receipt-backed reviews follow backend
verification, while receipt-free reviews are published only as low-weight
reference reviews. The client never decides trust locally.

## Relevant Product Docs

- `docs/product/reviews.md`
- `docs/product/restaurant-discovery.md`
- `docs/ARCHITECTURE.md`

## Acceptance Criteria

- Signed-out users are sent through the existing login flow before reviewing.
- The form requires four ratings from 1 to 5 and a trimmed comment of at least
  50 characters.
- `POST /api/v1/reviews` creates the private review intent.
- An optional JPG, PNG, HEIC, or HEIF receipt is uploaded through
  `POST /api/v1/receipts` with a stable UUID-v4 idempotency key.
- Multipart filenames cannot inject or break MIME headers; control characters,
  quotes, and backslashes are replaced before serialization.
- Without a receipt, the client calls
  `POST /api/v1/reviews/:reviewId/skip-verification`; the backend publishes the
  review as `REFERENCE_ONLY/SKIPPED` with low trust weight.
- The mobile flow displays owner-scoped status from
  `GET /api/v1/reviews/:reviewId/status`.
- Receipt storage references, hashes, provider errors, and client-decided trust
  outcomes never appear in the UI.

## Design Notes

- GPS evidence remains optional and is omitted from this first mobile surface.
- Receipt selection supports camera and photo library.
- Review status can be refreshed manually and is polled while processing.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | JSON and multipart request contracts, stable idempotency key |
| Integration | Existing backend review/receipt/status suites |
| E2E | Login gate, form validation, optional receipt paths, submission and status UI |
| Platform | Flutter analyze, Android/iOS permission configuration, debug APK |
| Release | Full mobile suite |

## Harness Delta

Refresh the existing Harness story evidence with executable mobile proof.

## Evidence

- `review_submission_service_test.dart`: 4 passing contract tests covering the
  private review intent, optional receipt skip endpoint, authenticated
  multipart upload with a stable UUID-v4 idempotency key, and owner-scoped
  verification status.
- `review_creation_page_test.dart`: 5 passing widget tests covering required
  ratings/comment validation, receipt-free reference submission, verified
  receipt submission, transport-error recovery, and receipt retry without
  creating a second review or rotating the idempotency key.
- `trustbite_api_client_test.dart` proves JSON comments with Vietnamese text,
  smart punctuation, and emoji are transmitted as UTF-8.
- Backend skip-verification proof: 10 review service unit tests and 9 status
  integration tests passed, including public reference listing with no receipt
  record.
- `discover_page_test.dart`: the signed-out review CTA invokes the login
  boundary before opening the review flow, and loaded review reaction state is
  preserved when restaurant detail moves from an error state to success. The
  already-loaded menu also remains visible during that transition without a
  one-frame loading fallback.
- `review_submission_service_test.dart` proves hostile receipt filenames cannot
  inject an additional multipart header.
- `npm run server:test`: 561 tests passed with 4 opt-in provider tests skipped.
- `npm run mobile:test`: 62 tests passed.
- `flutter analyze`: no issues.
- `flutter build apk --debug`: debug APK built successfully. Existing
  Gradle/AGP/Kotlin future-support warnings remain unchanged.
- iOS includes camera and photo-library usage descriptions. Android uses the
  `image_picker` plugin configuration and the existing Internet permission.

2026-07-16 review hardening follow-up:

- Red/green widget proof preserves a successful reaction when restaurant detail
  moves from an error subtree to the loaded detail subtree, and preserves the
  loaded menu presentation through the retry frame with a stable section key.
- Multipart filename regression rejects CRLF/quoted-header injection.
- Full mobile suite passed 66 tests and `flutter analyze` reported no issues.
