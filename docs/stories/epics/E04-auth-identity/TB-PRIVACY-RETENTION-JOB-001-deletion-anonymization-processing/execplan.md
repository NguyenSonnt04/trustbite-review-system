# Exec Plan

## Goal

Implement and prove the backend account deletion/anonymization processing job so deletion requests do not remain permanently open after the in-app request API accepts them, and so completion truly covers TrustBite database PII, local product session/device state, Cognito/provider identity state, and TrustBite-owned profile-avatar/receipt/media/claim-evidence object references.

## Scope

In scope:

- Discovery of schema-backed PII fields and related records affected by account deletion.
- A server-side processor/service that handles due `account_deletion_requests` in small transactionally safe batches.
- State transitions `REQUESTED -> PROCESSING -> COMPLETED` with row locking or equivalent concurrency safety, while preserving that `REQUESTED` and `PROCESSING` are the only active/open deletion states in the current API duplicate/status contract.
- A concrete recovery/idempotency rule for already-`PROCESSING` rows before implementation proceeds: claim into `PROCESSING` with a committed local `DELETED` fail-closed guard, retry `PROCESSING` rows using a per-request session-level `pg_try_advisory_lock` held on the same dedicated pool client for the full provider/storage cleanup attempt, skip lock-busy rows instead of blocking the batch, and pause for a high-risk migration/decision if leases, retry counters, failure reasons, per-provider/object cleanup status, or legal hold markers are required.
- Session and push-token revocation during processing, even if request-time revocation already ran, plus explicit proof that idempotent no-op revocation works and a valid Cognito token cannot still mutate the account during `REQUESTED`, `PROCESSING`, or after completion, including proof that any identity unmapping cannot be defeated by verified-phone fallback.
- Ownership for the open-deletion mutation guard: this story must implement the Express auth/API guard, or explicitly depend on a merged and proven `TB-PRIVACY-DELETION-001` change, that rejects protected mutations for users with an open `REQUESTED` or `PROCESSING` deletion request while allowing only documented deletion status/cancel exceptions. This cannot remain only a pre-implementation decision when the story is claimed complete.
- Cognito/provider account cleanup for the mapped identity where configuration supports it, keeping all provider SDK calls behind `server/src/services/` or `server/src/config/`. Before implementation, prove whether `users.cognito_sub` is sufficient for the Cognito admin API or stop for a provider/schema decision that stores the needed username/handle. If provider cleanup cannot be proven locally, document the exact blocker and do not claim provider-side deletion complete or request completion; local `DELETED`/unmapped-identity rejection still needs integration proof with otherwise-valid Cognito-compatible tokens.
- PII anonymization/deletion mapping for `users`, phone-keyed `otp_verifications`, and implemented user-owned tables that currently exist in `server/migrations/001_init_schema.sql` plus `server/migrations/002_add_users_cognito_sub.sql`. Treat those migrations as the implementation schema source of truth; product schema docs are reference material when they agree with migrated tables and must not cause SQL against non-migrated tables. If `review_translations` or other product-schema-only tables are migrated before implementation, add them to the retention map then; otherwise call out the product-vs-migration gap as out of scope/blocking for that table.
- TrustBite-owned profile avatar, receipt/review media, and merchant-claim evidence object cleanup, or an explicit blocker if S3/provider object deletion needs its own provider story. Do not mark account deletion complete while TrustBite-owned avatar, receipt/media, or claim-evidence URLs remain active without a documented legal/fraud/audit retained-data reason. `users.avatar_url` is nullable and may be cleared only after owned-object cleanup/retention is resolved; current URL columns such as `receipt_verifications.file_url`, `review_media.url`, and `restaurant_claims.evidence_url` are `NOT NULL`, so the implementation must use row deletion, inactive status plus a non-sensitive tombstone value, or retained-with-reason handling rather than attempting to set those fields to `NULL`. Object deletion must first prove URL-to-owned-object parsing with a bucket/prefix allowlist so arbitrary external URLs are never deleted.
- Audit/privacy evidence for processing start, completion, skipped/legal-hold cases if supported by schema, and failures without leaking sensitive PII.
- A local smoke command or script for running the processor once.
- DB transaction/rollback proof for the anonymization mapping and completion state.
- Provider-cleanup proof or documented provider blocker for Cognito identity and TrustBite-owned S3/profile-avatar/receipt/media/claim-evidence objects.
- Harness matrix/story evidence update after validation.

Out of scope:

- In-app deletion request/status/cancel endpoints already covered by `TB-PRIVACY-DELETION-001` unless fixes are necessary for the processor.
- Public web deletion form/API identity verification.
- Mobile UI delete-account entry point.
- New legal retention policy decisions.
- Physical deletion of audit/fraud/legal-minimum records beyond the retention policy.
- Changing Cognito-first authentication ownership or introducing backend-issued refresh-token/session ownership.

## Risk Classification

Risk flags:

- Auth.
- Data model/deletion/retention.
- Audit/security/privacy.
- External provider behavior: Cognito identity cleanup and possible S3/profile-avatar/receipt/media/claim-evidence object deletion.
- Existing behavior.
- Weak proof.
- Multi-domain: users, Cognito identity mapping, sessions, push tokens, reviews, receipts, media, notifications, idempotency, social/saved-list/gamification records, audit/fraud records.

Hard gates:

- Data loss/deletion.
- Audit/security.
- Auth/local account status enforcement.
- External provider behavior.
- Removing or weakening validation requirements.

Lane: high-risk.

## Work Phases

1. Confirm retention rules from `Data_Retention_Policy.md`, `BR-PRIV-007`, `Status_Mapping.md`, and the account deletion state machine.
2. Inventory exact schema columns from `server/migrations/001_init_schema.sql` and `server/migrations/002_add_users_cognito_sub.sql`, plus existing models/services for user PII and user-owned records.
3. Define the anonymization/retention map before production code changes. The map must cover at least `users`, phone-keyed `otp_verifications`, `user_roles`, `user_sessions`, `user_follows`, merchant-owned `merchants`/`restaurant_merchants`/`restaurant_claims`/`review_replies`, `reviews`, `review_tags`, `receipt_verifications`, `receipt_line_items`, `receipt_line_item_menu_maps`, `review_media`, `review_votes`, `price_history`, `review_summaries`, `user_badges`, `exp_transactions`, `user_saved_lists`, `user_saved_list_restaurants`, `moderation_reports`, `moderation_actions`, `fraud_flags`/`fraud_flag_entities`, `push_tokens`, `notifications`, `notification_delivery_logs`, `idempotency_keys`, `audit_logs`, `account_deletion_requests`, `user_blocks`, and `admin_queue_assignments`, even when the selected action is “retain with reason” or “no direct PII change”. The map must identify sensitive free-text/blob/object fields such as avatar URLs, deletion reasons, moderation descriptions/action reasons, audit metadata, notification titles/bodies/payloads/delivery errors, session hashes, device labels, push token ciphertext/fingerprints, claim evidence URLs, review replies, OCR text, receipt timestamps/totals/invoice numbers, GPS fields, and review-summary text. It must also call out every `NOT NULL` sensitive field that needs deletion or a schema-valid tombstone instead of `NULL`, and every relationship-only table where the only schema-valid choices are delete or retain-with-reason. Treat `restaurant_images.image_url`/`restaurant_images.caption` and restaurant/menu/branch business-content tables as out of scope unless a separate ownership/schema decision proves they are merchant-owned and in scope.
4. Decide the job failure/retry strategy before implementation. The default for the current schema is: short transaction claims due rows into `PROCESSING`, commits `users.status = 'DELETED'` as the local fail-closed guard, keeps `completed_at`/`users.deleted_at` unset and leaves `cognito_sub`, original phone, and owned URLs available as durable cleanup handles until cleanup finishes, then finalizes anonymization/completion. A processor retry must scan `PROCESSING` rows and attempt a per-request session-level `pg_try_advisory_lock` on a dedicated pool client held until provider/storage cleanup finishes and unlock happens; lock-busy rows are skipped and counted rather than blocking the batch. If that strategy cannot satisfy the needed rollback/retry/observability guarantees, add a schema/decision story for lease/error/provider/object status instead of leaving rows stranded in `PROCESSING`. Do not introduce new enum/check values such as `FAILED`, `LEGAL_HOLD`, `ANONYMIZED`, or a new user deletion-pending status without migration, product docs, and status-mapping updates.
5. Implement, or explicitly depend on a merged/proven implementation of, the request-time open-deletion guard before processor completion is claimed. Current code revokes local `user_sessions` and push tokens at request time but Cognito access tokens can still authenticate while `users.status` remains `ACTIVE`; the owned guard must block protected mutations for open `REQUESTED`/`PROCESSING` deletion requests while still allowing explicitly documented deletion status/cancel operations. Do not rely only on immediate due processing for `scheduled_deletion_at IS NULL`, because any scheduler delay leaves a mutation window. Reconcile this with the product grace-period deletion-pending intent without inventing a new `users.status` value unless a migration/product-status update is accepted. The cancellation rule for this story is user-cancellable only while `REQUESTED`; `PROCESSING` returns the agreed state-conflict error unless a later schema-safe operator-abort design is accepted.
6. Decide the provider cleanup strategy before implementation: prove the Cognito admin identifier/username needed for delete/disable/global sign-out, choose account delete plus global sign-out when supported, disable only when an accepted legal/retention rule allows provider PII to remain, and choose TrustBite-owned S3/profile-avatar/receipt/media/claim-evidence object deletion or retained-object reason. Keep provider calls isolated behind services/config. A generic retained-data reason cannot be used to mark provider-owned identity PII complete unless the retention policy/legal decision explicitly requires keeping that provider identity.
7. Add or update automated proof where practical for state transitions, reconciled `PROCESSING` cancellation semantics, duplicate/concurrency safety, idempotent session/push-token no-op behavior, anonymization mapping, provider-boundary behavior, deleted-user rejection or safe unmapping with otherwise-valid Cognito-compatible tokens and verified-phone fallback prevention, fail-closed behavior after provider/object success plus later DB failure, open-request mutation behavior, restaurant `trust_score`/review-count recomputation or an explicit trust-score dependency blocker, review summary invalidation, and rollback/idempotency.
8. Implement the smallest processing service/job entrypoint behind `server/src/services/` or a server job module.
9. Validate with `npm run server:build`, `npm run db:migrate`, and DB transaction/rollback smoke proof against local PostgreSQL when available.
10. Run or document provider cleanup proof for Cognito and S3/profile-avatar/receipt/media/claim-evidence objects. If LocalStack lacks coverage, use an explicit local/test provider double that preserves command semantics and fail-closed behavior, or document the blocker; do not expand cleanup to restaurant/menu/branch content without a separate ownership/schema decision.
11. Update `TB-PRIVACY-DELETION-001` references, Harness matrix evidence, and trace.

## Stop Conditions

Pause for human confirmation if:

- The anonymization map would remove data that the retention policy says to retain.
- The schema lacks a required marker for retained legal/audit/fraud data, provider username/handle storage, provider cleanup status, object cleanup status, legal hold, or retry/failure tracking.
- A schema migration becomes necessary.
- Product wants immediate hard deletion instead of anonymization and retained minimum records.
- Cognito account cleanup, global sign-out, or S3/profile-avatar/receipt/media/claim-evidence object cleanup is required but cannot be proven safely in the current provider boundary.
- The proposed completion path would leave Cognito identity PII, active TrustBite-owned avatar/receipt/media/claim-evidence object URLs, local session hashes, push-token ciphertext/fingerprints, stale restaurant trust scores/review counts, or review summaries containing deleted-user content in place without an explicit legal/fraud/audit retention rule.
- Cognito cleanup requires a provider username/handle that the current schema does not store; do not assume `users.cognito_sub` is sufficient without provider proof.
- Validation cannot prove rollback/no-residue behavior for DB-affecting changes.
- Any implementation path would rely on backend-owned access/refresh/session issuance instead of Cognito-first auth.
