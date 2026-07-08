# Exec Plan

## Goal

Complete Phase 4 backend "Review & OCR" closeout for tasks 4.1 through 4.5,
excluding UI/mobile/admin UI tasks 4.6, 4.7, and 4.8.

## Scope

In scope:

- `POST /api/v1/reviews` backend closeout and HTTP proof.
- `POST /api/v1/receipts` receipt upload proof, duplicate-hash/idempotency
  behavior, and private S3 service boundary proof.
- Upload-to-OCR queue wiring after receipt persistence.
- Proof that PR #36 `TB-FRAUD-001` supplies OCR/verification services.
- `GET /api/v1/reviews/:reviewId/status` owner-scoped status API.
- Product docs, test matrix, story packet, Harness verify command, and trace
  evidence.

Out of scope:

- Review UI.
- Mobile review/OCR flow.
- Admin moderation or admin receipt-review UI.
- Rewriting OCR, Textract mapping, or receipt verification scoring from PR #36.

## Risk Classification

Risk flags:

- Authorization.
- Data model and persistence lifecycle.
- External provider boundary.
- Public API contracts.
- Existing behavior.
- Weak proof before this closeout.

Hard gates:

- Authorization.
- External provider behavior.
- Public contract changes.

Lane: high-risk.

## Work Phases

1. Discovery: read Harness docs, product docs, matrix/backlog, schema, review and
   receipt services, and PR #36 dependency evidence.
2. Red: add targeted tests for upload-to-OCR queueing and protected status API.
3. Green: wire receipt upload to enqueue OCR after commit and expose review
   status endpoint.
4. Hardening: add HTTP integration proof for review creation and S3 private
   boundary unit proof.
5. Docs/Harness: update product docs, story packet, matrix, verify command, and
   evidence.
6. Verification: run DB migration, server tests, syntax build, story verify, and
   matrix query.
7. Publish: commit logical changes, push the branch, and open a PR to `main`.

## Stop Conditions

Pause for human confirmation if:

- A schema migration becomes necessary.
- Existing verification or trust-score behavior from PR #36 needs to be changed.
- UI/mobile/admin UI work becomes required to prove the backend.
- Required DB/test proof is unavailable and cannot be restored locally.
