# TB-REVIEW-001: Create Verified Food Reviews

## Current Behavior

After PR #36, `TB-FRAUD-001` provides the OCR and receipt verification
dependency for Phase 4. The backend has service-level review creation and
receipt upload behavior, but Phase 4 backend closeout needs API-level proof,
upload-to-OCR queue wiring, owner-scoped status polling, and synchronized
product/Harness evidence.

## Target Behavior

Authenticated users can create a review, upload one private receipt for that
review, have OCR verification queued automatically, and poll the review/receipt
verification state through a protected owner-only API.

## Affected Users

- Authenticated users creating food reviews.
- Backend workers processing receipt OCR.
- Future web/mobile clients that need a stable status contract.

## Affected Product Docs

- `docs/product/reviews.md`
- `docs/product/verification.md`
- `docs/TEST_MATRIX.md`

## Non-Goals

- Review creation UI.
- Mobile review/OCR screens.
- Admin moderation or admin receipt-review UI.
- Re-implementing the OCR/verification service merged through PR #36.
