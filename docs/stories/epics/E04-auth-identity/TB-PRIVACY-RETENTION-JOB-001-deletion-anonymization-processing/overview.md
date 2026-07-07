# Overview

## Current Behavior

`TB-PRIVACY-DELETION-001` implements the authenticated deletion request endpoints for creating, reading, and cancelling account deletion requests. The request endpoint already creates `account_deletion_requests`, sets `users.deletion_requested_at`, and revokes active local `user_sessions`/`push_tokens` at request time. Under the Cognito-first auth boundary, that local revocation does not by itself prove Cognito-issued access tokens are unusable; the processor must close the gap by setting local `DELETED` state, retaining a deleted-account provider-subject deny mapping or safely unmapping identity data, and/or completing provider cleanup.

The backend now has a deletion processor that selects due deletion requests, transitions them through `PROCESSING`, commits a fail-closed `users.status = DELETED` guard before non-rollbackable cleanup, calls Cognito admin cleanup when a mapped `users.cognito_sub` exists, calls TrustBite-owned S3 object cleanup through service boundaries, tombstones covered profile/session/device/review/receipt/media/merchant-claim data, minimizes receipt proof hashes/transaction fields and review proof fields, clears covered receipt/claim decider references, removes or minimizes covered relationship/system rows, detaches price observations, invalidates restaurant review summaries, recomputes restaurant aggregates from remaining public trusted reviews, minimizes moderation/audit free text, resolves covered admin assignments, marks the request `COMPLETED`, retains `users.cognito_sub` as a deleted-account deny mapping when present, and records privacy/audit evidence. If `users.cognito_sub` is `NULL`, the processor treats Cognito cleanup as skipped because there is no mapped provider identity to delete. The processor also persists durable cleanup state, attempt counts, retry errors, lease tokens/expiry, and legal-hold skips on `account_deletion_requests`. Real LocalStack S3 `DeleteObject` smoke passes through the configured storage boundary. Current LocalStack community does not expose Cognito IdP admin APIs, so Cognito admin cleanup is proven locally with a Cognito-compatible admin client test double through the real provider boundary; real AWS or LocalStack pro smoke remains optional platform evidence, not a blocker for this backend story. Decision `0015-account-deletion-retention-scope` accepts the current account-owned retention scope and defers per-provider/per-object work items, per-category expiry, restaurant-image ownership, and broader restaurant/menu/branch content ownership to future high-risk stories.

## Target Behavior

A backend deletion/anonymization processor completes accepted account deletion requests according to `Data_Retention_Policy.md`, `BR-PRIV-007`, and the Cognito-first auth boundary:

- select due `account_deletion_requests` in `REQUESTED` state,
- safely claim/process each request without duplicate completion or permanently stuck `PROCESSING` rows by using short DB claims, a committed local fail-closed guard, retryable `PROCESSING` handling, and per-request locking while preserving current `REQUESTED`/`PROCESSING` active-request semantics,
- revoke remaining local product session/device rows and active push tokens without reviving backend-owned refresh-token/session ownership,
- delete/disable/sign out the mapped Cognito account where `users.cognito_sub` is present and provider configuration supports it, proving the required provider identifier before implementation instead of assuming any non-null value is sufficient. If the row has no mapped Cognito identity (`users.cognito_sub IS NULL`), record provider cleanup as skipped; if a mapped identity exists but cleanup cannot be proven, stop with an explicit provider/schema blocker that keeps the story/request incomplete rather than allowing deletion completion while provider PII remains,
- delete or anonymize TrustBite-owned profile avatar objects, receipt/review media objects, merchant-claim evidence objects, and database URLs when they are in scope for the deleting user, or stop with an explicit storage/provider blocker; that blocker keeps the story/request incomplete rather than allowing deletion completion while TrustBite-owned objects remain active without a legal/fraud/audit retention reason,
- anonymize or delete user PII that does not need to be retained, including profile fields, while retaining identity mapping values only when they are the minimum security/audit data needed to reject otherwise-valid old provider tokens,
- apply an explicit schema-backed retention map for phone-keyed OTP history, local session/device secrets, push-token ciphertext/fingerprints, user-owned reviews, receipts/OCR/GPS data, review media, review translation caches when/if migrated, notification titles/bodies/payloads/delivery errors, saved lists, follows, blocks, idempotency rows, local roles/gamification rows, merchant authority/claim/reply records, review aggregates/summaries/price observations, and audit/fraud/legal records,
- preserve only legal/audit/fraud minimum records with an explicit retained-data reason where applicable,
- mark the request `COMPLETED`, set `completed_at`, set `users.status = DELETED`, and set `users.deleted_at`,
- ensure old Cognito-compatible tokens and any local trusted identity paths are rejected through existing auth/local status checks or unmapped-identity checks after deletion,
- do not rely on request-time `user_sessions` revocation or scheduler immediacy to invalidate Cognito access tokens; add/update the account-deletion API/auth story so open `REQUESTED`/`PROCESSING` requests block protected mutations except explicitly allowed deletion status/cancel operations.

## Affected Users

- Users who submitted account deletion requests.
- Support/privacy operators validating deletion completion.
- Security/legal reviewers validating retained minimum records.
- Backend operators running or monitoring scheduled privacy jobs.

## Affected Product Docs

- `trustbite-docs/01_Product_Management/Product_Requirements_Document_PRD.md`
- `trustbite-docs/02_Business_Analysis/Business_Rules.md`
- `trustbite-docs/02_Business_Analysis/State_Machines.md`
- `trustbite-docs/02_Business_Analysis/Status_Mapping.md`
- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/04_Software_Engineering/Review_Translation_Feature.md`
- `trustbite-docs/06_Database_Design/PostgreSQL_Database_Schema.md`
- `trustbite-docs/08_Compliance_and_Privacy/Data_Retention_Policy.md`
- `docs/product/authentication.md`
- `docs/product/provider-integrations.md`
- `docs/decisions/0010-cognito-first-auth-boundary.md`
- `docs/decisions/0011-auth-provider-adapter-boundary.md`
- `docs/decisions/0012-admin-roles-source-of-truth.md`
- `docs/decisions/0015-account-deletion-retention-scope.md`
- `docs/stories/epics/E04-auth-identity/TB-PRIVACY-DELETION-001-account-lock-deletion/`

## Non-Goals

- No new account deletion request API shape beyond `TB-PRIVACY-DELETION-001` unless processor discovery proves a request-time fix is required.
- No public web deletion form implementation; that remains a separate web/store-compliance slice.
- No mobile delete-account entry implementation.
- No hard-delete of the `users` row because related audit/fraud/legal references require controlled retention.
- No arbitrary schema changes beyond the accepted cleanup-state migration for retry, lease, and legal-hold proof. If safe completion needs provider-key fields, per-object cleanup rows, per-category retention expiry, or broader ownership markers, pause for a high-risk migration/decision update.
- No final legal rewrite of Privacy Policy or Terms copy.
