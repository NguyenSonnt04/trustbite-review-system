# Validation

## Proof Strategy

Do not mark this story implemented until the processor proves state transitions, transaction safety, PII anonymization, provider cleanup/blocker handling, profile-avatar/receipt/media/claim-evidence object cleanup/blocker handling, session/push-token revocation plus secret minimization, review aggregate/summary invalidation, and audit/privacy evidence against the migrated PostgreSQL schema.

The first proof target is backend/database/provider-boundary only. E2E/store evidence remains tied to separate mobile/web deletion flow stories, but this story cannot claim completion if the backend processor leaves known TrustBite account PII active in Cognito, TrustBite-owned profile-avatar/receipt/media/claim-evidence storage, local session/device secret rows, push-token secret rows, or review summaries/aggregates without an accepted legal/fraud/audit retained-data reason. A provider/storage blocker may be recorded as partial evidence, but it is not completion evidence for this story or for a specific deletion request.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Due-request selection rule; `REQUESTED -> PROCESSING -> COMPLETED` transition guard; `PROCESSING` remains an active/open deletion state for status/duplicate guards; cancellation after processing starts follows the accepted `REQUESTED`-only user-cancel rule unless a later schema-safe operator abort is documented; recovery/idempotency rule for `PROCESSING` claims; per-request `pg_try_advisory_lock` concurrency guard, including same-client lock ownership, lock-busy skip behavior, and `skipped` count mapping; open `REQUESTED`/`PROCESSING` mutation blocking with status/cancel exceptions; anonymized phone tombstone generation preserves uniqueness, fits `VARCHAR(20)`, and cannot be used as a real contact value; Cognito subject retained-deny mapping or safe unmapping rule plus verified-phone fallback prevention; PII field mapping clears display and classifies/clears avatar only after storage cleanup/retention handling; schema-valid `NOT NULL` tombstones for review comments, receipt/media/claim URLs, receipt line-item values, merchant business names, deterministic session hash tombstones, push-token secrets, notification titles, saved-list names, and idempotency UUID/hash/endpoint values; delete-vs-retain handling for relationship-only tables; review translation cache handling when/if migrated; review aggregate/summary invalidation including zero-review trust-score/default behavior; owned-object URL parser refuses external hosts/buckets/prefixes; result count mapping. |
| Integration | Migrated DB fixture with active user, `users.cognito_sub`, active or already-revoked session, active or already-inactive push token, due deletion request, review, receipt verification with OCR/GPS/file URLs/receipt times/totals, receipt line items/menu maps, review media, review votes/tags, notification and delivery log, saved list, idempotency key, review summary/price history, merchant/claim/reply records, moderation/audit/fraud rows first claims `PROCESSING` with local `users.status = DELETED` while preserving cleanup handles, then completes with `account_deletion_requests.status = COMPLETED`, `completed_at` set, sessions revoked and session secrets deleted/tombstoned, push tokens inactive and token secrets deleted/tombstoned, `users.deleted_at` set, phone/display anonymized or cleared only after provider/storage cleanup or retained reasons are durable, `cognito_sub` either retained on the `DELETED` tombstone row or safely unmapped only with provider/deny-list proof, avatar URL cleared only after owned-object cleanup/ownership refusal/retention handling, old verified-phone Cognito tokens cannot remap the tombstoned user or create/attach to an active row, relationship-only tables are deleted or retained with reason, merchant authority deactivated/minimized where applicable, schema-valid review/receipt/media/notification/saved-list handling, deleted review excluded from aggregates/summaries, restaurant `trust_score` and review counts recomputed from the retained non-deleted review set or explicitly blocked because the trust-score calculator/story is absent, zero-review aggregate behavior follows the accepted neutral/default rule or blocks, audit evidence written using existing `audit_logs` columns only, and otherwise-valid Cognito-compatible tokens rejected during `REQUESTED`, `PROCESSING`, and after completion. |
| Provider boundary | Cognito provider cleanup service is added behind the service/config boundary or the absence of such a boundary is documented as a blocker that prevents completion for mapped identities; before implementation, tests or provider docs prove whether non-null `users.cognito_sub` is sufficient for the Cognito admin username/identifier or a schema/provider decision is needed; cleanup is called with the correct provider identifier without logging it; `users.cognito_sub IS NULL` is treated as no mapped provider identity and skips Cognito cleanup; already-missing provider user is idempotent; provider failure for a mapped identity blocks completion unless a legal/fraud/audit retention decision explicitly permits retaining provider identity data; global sign-out alone is not accepted as provider PII deletion; no backend-issued token/session behavior is introduced. |
| Storage boundary | TrustBite-owned `users.avatar_url`, `receipt_verifications.file_url`, `receipt_verifications.redacted_file_url`, `review_media.url`, and merchant claim evidence objects are deleted or retained with explicit reason; nullable avatar URLs are cleared only after object cleanup/ownership refusal/retention handling is durable; `NOT NULL` URL columns use deletion/cascade or non-sensitive tombstones instead of `NULL`; URL parsing proves the object belongs to the configured TrustBite bucket/prefix before deletion and refuses arbitrary external URLs; already-missing objects are idempotent; raw object keys/URLs are not logged. Do not claim cleanup coverage for `restaurant_images.image_url` / `restaurant_images.caption`, restaurant profile, menu, branch, operating-hours, category, amenity, or payment-method content unless a separate ownership/schema decision proves they are merchant-owned and in scope. |
| Negative/abuse | `CANCELLED` and already `COMPLETED` requests are ignored; future `scheduled_deletion_at` is ignored; `PROCESSING` is still returned/blocked as an active deletion request for existing status/duplicate logic; user cancellation after claim is rejected as non-cancellable unless a later schema-safe operator abort is documented; concurrent workers cannot complete the same request twice; a committed `PROCESSING` row is retried under a per-request lock and cannot be stranded without a documented schema/migration blocker; claim rollback leaves the request `REQUESTED`; processing rollback leaves no partial DB anonymization if an error occurs before commit; provider/object cleanup repeat after retry is safe and has durable cleanup handles; provider/object cleanup success followed by a later DB failure still leaves the account fail-closed for authentication/mutations during retry; open `REQUESTED`/`PROCESSING` users cannot continue mutating data with still-valid Cognito access tokens except explicitly allowed deletion status/cancel operations. |
| E2E | Not required for this backend job slice; covered by separate app/web deletion flow stories. |
| Platform | LocalStack or explicit test doubles for Cognito/S3 cleanup where real LocalStack behavior is unavailable; store checklist depends on this plus mobile/web entry points. |
| Performance | Batch size is bounded, uses locked deletion-request selection, and does not scan/process unbounded user rows. If due-request scale requires it, add migration proof for a due-job index instead of claiming performance from the current open-request-only unique index. |
| Logs/Audit | Job output/logs contain counts and opaque ids only; audit/privacy records omit raw tokens, session hashes, push token ciphertext/fingerprints, full phone numbers, Cognito subjects, S3 keys/URLs, GPS, receipt OCR text/totals/timestamps, account deletion reasons, moderation descriptions, notification payloads, and sensitive free-form reasons. |

## Fixtures

- Active user with `phone_number`, `display_name`, `avatar_url`, `cognito_sub`, matching `otp_verifications.phone_number` history, active `user_sessions`, active `push_tokens`, and a due `REQUESTED` deletion request.
- User with future `scheduled_deletion_at` request.
- User with `CANCELLED`, `PROCESSING`, and `COMPLETED` deletion requests.
- User-owned review with `comment`, public status/visibility/trust fields, review tags/votes/replies, receipt verification with raw and redacted file URLs, OCR text/name/invoice/time/total fields, GPS fields, receipt line items/menu maps, review media, price history, review summary, saved list/restaurants, follow/block records, notification plus delivery log, idempotency keys, relationship-only rows, moderation reports/actions where the user is reporter/admin or where the deleted user's review/receipt/user row is the target entity, audit logs where the user is actor or target entity, fraud flag/entity rows, and merchant-owned records where the same user owns a merchant profile/claim/reply or appears as a `decided_by`/admin/audit actor.
- Cognito cleanup fixture or test double for success, no mapped provider identity, already-deleted provider user, and provider failure.
- S3/profile-avatar/receipt/media/claim-evidence cleanup fixture or test double for success, already-missing object, provider failure, and external/unowned URL refusal.
- Concurrency fixture with two processor invocations attempting to claim or retry the same due/`PROCESSING` request under the per-request lock.
- Rollback fixture that injects a DB failure during claim and finalization, plus a provider/object success followed by DB failure, proving no partial DB anonymization and fail-closed retry state remain.
- User/profile fixture also includes `exp_points`, `rank_code`, `review_restricted_until`, `user_roles`, `user_badges`, `exp_transactions`, `user_follows`, `user_blocks`, `admin_queues`, and `admin_queue_assignments`, plus ownership-unknown `restaurant_images` and restaurant/menu/branch business-content rows to prove the out-of-scope blocker path is respected.

## Commands

Expected commands after implementation:

```text
npm run server:build
npm run db:migrate
# server job smoke command to be added with the implementation
# DB transaction/rollback SQL proof for anonymization and completion state
# Cognito cleanup smoke/test-double proof or explicit provider blocker
# S3/profile-avatar/receipt/media/claim-evidence cleanup smoke/test-double proof or explicit provider blocker
```

If local PostgreSQL, Docker, LocalStack, or provider-compatible test doubles are unavailable, record the blocker and do not claim the affected integration/provider proof.

The repo now has `npm run server:test` for the full Vitest server suite, `npm run test:integration --prefix server` for DB-backed integration proof, and `npm run server:build` for syntax proof. `npm run server:build` remains syntax proof only, not behavior proof.

## Acceptance Evidence

2026-07-06 backend processor and cleanup-boundary proof:

- Added `server/src/services/accountDeletionProcessor.js` with `processDueAccountDeletions({ batchSize })` for due `REQUESTED`/`PROCESSING` rows.
- Extended the processor retention map to remove or minimize covered relationship/system rows: `user_roles`, `user_badges`, `exp_transactions`, `user_saved_lists` and child restaurants, inbound/outbound `user_follows`, inbound/outbound `user_blocks`, `review_tags`, `review_votes`, `notifications` and cascaded `notification_delivery_logs`, and `idempotency_keys`.
- Extended review-derived cleanup: detaches `price_history.review_id` for deleted-user reviews, deletes stale restaurant-level `review_summaries`, and recomputes affected `restaurants.trust_score`, `verified_review_count`, and `reference_review_count` from remaining public trusted reviews, with `trust_score = NULL` when no eligible reviews remain.
- Extended moderation/admin/audit minimization for covered references: nulls `moderation_reports.description`, tombstones `moderation_actions.reason`, resolves active `admin_queue_assignments` for the deleted admin user, preserves fraud-minimum `fraud_flag_entities` references, and scrubs existing audit `reason`/metadata to an audit-minimum retained-data marker.
- Extended receipt/review proof minimization: deleted-user reviews now use neutral ratings, `verification_status = 'DELETED'`, and `visited_at = NULL`; deleted-user receipt verifications now receive deterministic tombstone `file_hash_sha256`, `transaction_unique_hash = NULL`, `status = 'DELETED'`, `fraud_risk_score = 0`, `decision = NULL`, `decision_reason = NULL`, and `decided_by = NULL`; cross-record `receipt_verifications.decided_by` and `restaurant_claims.decided_by` references to the deleted user are cleared without tombstoning other users' receipt/claim content.
- Updated completion `retained_data_reason` to a non-PII reason covering security audit minimum, fraud minimum, retained Cognito deny mapping, and audit/fraud references. Integration proof covers retained `fraud_flag_entities` for deleted-user `USER` and `RECEIPT_VERIFICATION` entities.
- Added `server/scripts/process-deletions.mjs` and `npm run deletions:process --prefix server` as the local job entrypoint. Do not run it against a shared/dev database unless the due deletion-request set is intentional.
- Added Cognito admin cleanup boundary in `server/src/services/identityProviders/cognitoProvider.js`. Unit proof covers global sign-out before admin delete, Cognito `UserNotFoundException` idempotency, and existing JWKS/token verification behavior. AWS Cognito API docs state admin `Username` can be the local user's `sub` when username is not an alias attribute, so this implementation uses retained `users.cognito_sub` as the configured cleanup identifier.
- Added `server/src/services/objectStorage.js` with TrustBite-owned S3 URL parsing and `DeleteObject` cleanup. Unit proof covers configured bucket/prefix parsing for `s3://` and LocalStack path-style URLs, external-host refusal, wrong-bucket refusal, wrong-prefix refusal, and no `DeleteObject` call for unowned URLs.
- Updated route-independent integration proof in `server/tests/integration/accountDeletionProcessor.integration.test.js` covering a due deletion request, committed fail-closed `REQUESTED -> PROCESSING` with `users.status = DELETED` before cleanup, Cognito cleanup call, TrustBite-owned avatar/receipt/redacted-receipt/review-media/merchant-claim object cleanup calls, `PROCESSING -> COMPLETED`, core user PII tombstoning, `users.deleted_at`, session revocation, push-token inactivation/secret tombstoning, receipt/review/media/merchant-claim tombstones, relationship/system row cleanup, derived review/restaurant aggregate cleanup, moderation/admin/audit minimization, completion audit evidence without reason leakage, retained `users.cognito_sub`, and auth rejection for an otherwise-valid retained Cognito subject.
- Added negative integration proof that provider cleanup failure leaves the request retryable in `PROCESSING`, keeps `users.status = DELETED`, preserves phone/cleanup handles, does not mark `completed_at`, and continues to reject otherwise-valid retained Cognito identity tokens.
- Updated `server/package.json` test scripts to run Vitest with `--no-file-parallelism` for the full server suite and integration suite because DB-backed integration tests share one PostgreSQL database and processor tests can otherwise race with deletion-request API tests.
- `npm run docker:up` passed after Docker Desktop was started.
- `npm run db:migrate` passed with 0 applied migrations.
- `npm run test:unit --prefix server -- tests/unit/auth/cognitoProvider.test.js tests/unit/storage/objectStorage.test.js` passed; because the repo script includes all unit tests, Vitest reported 9 files / 93 tests passed.
- `npm run test:integration --prefix server -- tests/integration/accountDeletionProcessor.integration.test.js` passed; because the repo script includes all integration tests, Vitest reported 5 files / 26 tests passed after the added retention-map coverage.
- `npm run server:test` passed with 14 files / 119 tests.
- `npm run server:build` passed with syntax check over 84 files.
- `npm run harness -- story verify TB-PRIVACY-RETENTION-JOB-001` passed; the configured command ran `npm run server:test && npm run server:build` with 14 files / 119 tests and 84-file syntax proof.

2026-07-06 durable cleanup state, retry/lease, and legal-hold proof:

- Added migration `server/migrations/004_add_account_deletion_cleanup_state.sql` for `account_deletion_requests.cleanup_state`, `cleanup_attempts`, `cleanup_last_error_code`, `cleanup_last_error_at`, `cleanup_lease_token`, `cleanup_lease_expires_at`, `legal_hold`, `legal_hold_reason`, and a due-cleanup partial index.
- Extended `server/src/services/accountDeletionProcessor.js` so claim/retry writes `CLEANUP_IN_PROGRESS`, increments attempts, stores a lease token/expiry before external cleanup, records provider/storage cleanup failures as durable `RETRYABLE` state with a redacted error code/time, clears lease/error state on completion, and marks `legal_hold` rows as `LEGAL_HOLD` without calling provider or storage cleanup.
- Added integration proof that provider failure leaves the request in `PROCESSING` with `cleanup_state = RETRYABLE`, `cleanup_attempts = 1`, redacted error code/time, no lease, no `completed_at`, and fail-closed local account status; a second run retries the same row, observes `CLEANUP_IN_PROGRESS` with attempt 2 and a lease during provider cleanup, then completes and clears retry/lease fields.
- Added integration proof that a due request with `legal_hold = true` is skipped as `LEGAL_HOLD`, retains the active user row, does not call Cognito/storage cleanup, records the non-PII legal-hold reason, and does not invent a new deletion-request status.
- Red/green proof: the first targeted integration run failed on missing `legal_hold` column; after migration/service changes, `npm run test:integration --prefix server -- tests/integration/accountDeletionProcessor.integration.test.js` passed with 5 files / 27 tests.
- `npm run server:test` passed with 14 files / 120 tests.
- `npm run server:build` passed with syntax check over 84 files.
- `npm run db:migrate` passed after the migration with 0 applied migrations on rerun.

2026-07-06 rollback and Cognito-compatible cleanup proof:

- Added integration proof that a DB failure during the claim transaction returns a `FAILED` processor result with `reason = claim_persistence_failed`, rolls back the request to `REQUESTED`, leaves `cleanup_state = PENDING`, keeps `cleanup_attempts = 0`, keeps the user `ACTIVE`, and does not call Cognito or object cleanup. The test trigger is dropped in `finally`, and the fixture user is removed by the integration cleanup helper.
- Added integration proof that Cognito/object cleanup success followed by a DB failure during finalization returns `FAILED` with `reason = completion_persistence_failed`, rolls back partial anonymization, marks the request `PROCESSING`/`RETRYABLE` with `cleanup_last_error_code = COMPLETION_PERSISTENCE_FAILED`, clears the lease, keeps cleanup handles durable, and leaves the local account `DELETED`/fail-closed for retry.
- Added a Cognito-compatible admin cleanup test double that exercises the real `CognitoIdentityProvider.deleteUser` boundary. The double records `AdminUserGlobalSignOutCommand` before `AdminDeleteUserCommand`, verifies the configured `UserPoolId` and `Username`, deletes the in-memory provider user, and proves a second cleanup maps Cognito `UserNotFoundException` to idempotent `{ alreadyMissing: true }`.
- Red/green proof: targeted `npm run test:integration --prefix server -- accountDeletionProcessor.integration.test.js` first failed on the two new rollback/finalization cases, then passed after processor retry handling was updated. Passing output: 5 integration files / 30 tests passed, 1 skipped file / 2 skipped tests.
- Added decision `docs/decisions/0015-account-deletion-retention-scope.md`, accepting request-level cleanup state and the current account-owned retention scope while deferring per-provider/per-object work tables, per-category expiry, restaurant-image ownership, and broader restaurant/menu/branch content ownership to future high-risk stories.
- Final validation refresh:
  - `npm run test:integration --prefix server -- accountDeletionProcessor.integration.test.js` passed with 5 integration files / 30 tests and 1 skipped file / 2 skipped tests.
  - `npm run db:migrate` passed with 0 applied migrations.
  - Due-request precheck returned `{"count":0}`, then `node --import ./tests/helpers/env.js scripts/process-deletions.mjs --batch-size 1` from `server/` passed with `{"processed":0,"completed":0,"skipped":0,"failed":0,"results":[]}`.
  - `npm run server:test` passed with 14 files / 123 tests and 1 skipped file / 2 skipped tests.
  - `npm run server:build` passed with syntax check over 84 files.
  - `npm run harness -- story verify TB-PRIVACY-RETENTION-JOB-001` passed; the configured command ran `npm run server:test && npm run server:build` with 14 files / 123 tests and 84-file syntax proof.

2026-07-06 LocalStack provider/storage smoke proof:

- Added `server/tests/integration/providerCleanupLocalStack.integration.test.js`, gated by `RUN_LOCALSTACK_PROVIDER_SMOKE=true`, so default integration/server suites do not depend on optional LocalStack provider availability.
- Pinned Docker Compose LocalStack to `localstack/localstack:4.4.0` and corrected the requested Cognito service name to `cognito-idp`. This avoids current `latest` image startup failure without requiring a developer-specific `LOCALSTACK_AUTH_TOKEN`.
- Extended `server/src/config/aws.js` plus the Cognito/S3 service client factories to consume `AWS_ENDPOINT_URL`/`LOCALSTACK_ENDPOINT_URL`, env credentials, and S3 path-style mode for local provider proof.
- Ran `npm run docker:up`; LocalStack 4.4.0 started healthy on `127.0.0.1:4566`, with S3 available in the health output.
- Ran `$env:RUN_LOCALSTACK_PROVIDER_SMOKE='true'; $env:AWS_ENDPOINT_URL='http://127.0.0.1:4566'; $env:AWS_ACCESS_KEY_ID='test'; $env:AWS_SECRET_ACCESS_KEY='test'; $env:AWS_REGION='ap-southeast-1'; npm run test:integration --prefix server -- tests/integration/providerCleanupLocalStack.integration.test.js`; Vitest reported 6 integration files / 29 tests passed.
- The smoke creates a real LocalStack S3 bucket/object, calls `S3ObjectStorage.deleteOwnedObject` through the configured service boundary, and proves `HeadObject` no longer finds the object.
- The same smoke probes Cognito IdP by creating a temporary user pool before attempting admin cleanup. Current LocalStack community health does not expose Cognito IdP, and the API returns `InternalFailure` stating `cognito-idp` is not included in the current license plan or not emulated. Local Cognito admin cleanup proof therefore uses the Cognito-compatible admin test double above; real AWS or LocalStack pro smoke remains optional platform evidence.

Completion scope and deferred follow-up:

- Decision `0015-account-deletion-retention-scope.md` accepts request-level cleanup state for this story. Per-provider cleanup status, per-object cleanup status, provider username/handle storage beyond retained `users.cognito_sub`, and per-category retained-data expiry are future high-risk stories if operations/legal/product need them.
- `restaurant_images.image_url` / `restaurant_images.caption` and broader restaurant/menu/branch business content remain out of scope because the migrated schema lacks user/merchant ownership markers for those rows. The processor must not delete or rewrite them by guesswork.
- Real LocalStack S3 `DeleteObject` smoke passes. Cognito admin cleanup has explicit provider-boundary test-double proof because current local LocalStack community does not emulate Cognito IdP admin APIs.
- Open deletion request mutation blocking is owned and proven by `TB-PRIVACY-DELETION-001`; this story proves the processor's fail-closed `PROCESSING`/`DELETED` state and completed deleted-account rejection.
- Full completion evidence for this story is now represented by the acceptance evidence above plus final validation command outputs and Harness matrix/trace updates.

2026-07-07 review follow-up:

- Updated `processDueAccountDeletions` so skipped requests are excluded from later selections in the same batch instead of terminating or repeatedly reselecting the skipped row.
- Added integration regression proof for both skipped legal-hold rows and advisory-lock-busy rows, confirming later due requests are processed in the same run.
- `npm run test:integration --prefix server -- tests/integration/accountDeletionProcessor.integration.test.js` passed with 5 integration files / 32 tests and 1 skipped file / 2 skipped tests.
- `npm run server:build` passed with syntax check over 84 files.
- Updated `S3ObjectStorage.deleteOwnedObject` to fail closed with `S3_BUCKET_CONFIG_MISSING` when a non-empty cleanup URL is present but `AWS_S3_BUCKET_NAME` / bucket config is missing, so the processor marks the request retryable instead of completing after clearing DB pointers.
- Added unit and integration regression proof that missing bucket config does not call `DeleteObject`, returns a failed processor result with `reason = external_cleanup_failed`, keeps the request in `PROCESSING`/`RETRYABLE`, preserves the object URL cleanup handle, and leaves the local account fail-closed.
- Added `summarizeDeletionJobResult` and changed `server/scripts/process-deletions.mjs` to print only aggregate counters, avoiding per-request `requestId` / `userId` leakage in operational logs.
- Red/green proof: the new targeted unit tests first failed on missing bucket classification and missing log-summary helper, then passed after the fix.
- `npm run test:unit --prefix server -- tests/unit/storage/objectStorage.test.js tests/unit/privacy/deletionJobLogging.test.js` passed with 10 unit files / 95 tests.
- `npm run test:integration --prefix server -- tests/integration/accountDeletionProcessor.integration.test.js` passed with 5 integration files / 33 tests and 1 skipped file / 2 skipped tests.
- Due-request precheck returned `{"count":0}`, then `node --import ./tests/helpers/env.js scripts/process-deletions.mjs --batch-size 1` from `server/` passed with aggregate-only output `{"processed":0,"completed":0,"skipped":0,"failed":0}`.
- `npm run harness -- story verify TB-PRIVACY-RETENTION-JOB-001` passed; the configured command ran `npm run server:test && npm run server:build` with 15 server test files / 128 tests and 85-file syntax proof.

2026-07-07 review follow-up for request-reason minimization:

- Added integration regression proof that a completed account deletion request clears `account_deletion_requests.reason` while retaining the explicit `retained_data_reason`.
- Red/green proof: `npm run test:integration --prefix server -- tests/integration/accountDeletionProcessor.integration.test.js` first failed because the completed row still contained `Sensitive deletion reason`, then passed after the processor cleared `reason` during the completion update.
- `npm run test:integration --prefix server -- tests/integration/accountDeletionProcessor.integration.test.js` passed with 5 integration files / 33 tests and 1 skipped file / 2 skipped tests.
- `npm run server:build` passed with syntax check over 85 files.
- `npm run harness -- story verify TB-PRIVACY-RETENTION-JOB-001` passed; the configured command ran `npm run server:test && npm run server:build` with 15 server test files / 128 tests and 85-file syntax proof.

2026-07-07 review follow-up for provider identifier and receipt menu-map cleanup:

- Changed `CognitoIdentityProvider.deleteUser` to fail closed with `CognitoUsernameRequiredError` / `COGNITO_USERNAME_REQUIRED` when the provider username is missing, so the deletion processor cannot treat missing `users.cognito_sub` as successful provider cleanup.
- Added integration regression proof that a due deletion request for a row with `users.cognito_sub IS NULL` fails with `reason = external_cleanup_failed`, leaves the request in `PROCESSING` / `RETRYABLE`, keeps `completed_at` unset, and leaves the local user fail-closed as `DELETED` without calling object cleanup.
- Changed receipt anonymization to delete `receipt_line_item_menu_maps` for the deleted user's receipt line items before tombstoning retained line-item text/prices, so retained receipts no longer reveal exact purchased menu items through the join table.
- Red/green proof: `npm run test:integration --prefix server -- tests/integration/accountDeletionProcessor.integration.test.js` first failed because one receipt menu-map row remained and the missing-Cognito-sub request completed; after the fix, the command passed with 5 integration files / 34 tests and 1 skipped file / 2 skipped tests.
- `npm run test:unit --prefix server -- tests/unit/auth/cognitoProvider.test.js` passed with 10 unit files / 96 tests.
- `npm run server:build` passed with syntax check over 85 files.
- `npm run db:migrate` passed with 0 applied migrations.
- `npm run harness -- story verify TB-PRIVACY-RETENTION-JOB-001` passed; the configured command ran `npm run server:test && npm run server:build` with 15 server test files / 130 tests, 1 skipped file / 2 skipped tests, and 85-file syntax proof.

2026-07-07 review follow-up for optional Cognito identity cleanup:

- Updated the processor contract so `users.cognito_sub IS NULL` means there is no mapped Cognito provider identity to clean up. The processor now skips Cognito admin cleanup for those rows, still completes local deletion/anonymization, and records `providerCleanup = { skipped: true, reason: 'no_mapped_cognito_identity' }` in completion audit metadata.
- Kept mapped Cognito identity failures fail-closed/retryable: when `users.cognito_sub` is present and provider cleanup rejects, the request remains `PROCESSING` / `RETRYABLE` and the local account remains `DELETED`.
- Added regression coverage for the no-mapped-provider path and adjusted mapped-provider failure coverage. Local DB-backed red/green execution was blocked because Docker Desktop was not running (`dockerDesktopLinuxEngine` pipe missing); rerun the targeted integration command after local Postgres is available.

2026-07-07 review follow-up for deletion job dotenv loading:

- Changed `server/scripts/process-deletions.mjs` to import `dotenv/config` before config-bound service imports, matching the server entrypoint pattern and allowing the documented `server/.env` local/server configuration to load before `config/app.js` validates AWS Cognito settings.
- Due-request precheck returned `{"count":0}`, then `npm run deletions:process --prefix server -- --batch-size 1` passed with aggregate-only output `{"processed":0,"completed":0,"skipped":0,"failed":0}`.
- `npm run server:build` passed with syntax check over 85 files.
- `npm run harness -- story verify TB-PRIVACY-RETENTION-JOB-001` passed; the configured command ran `npm run server:test && npm run server:build` with 15 server test files / 130 tests, 1 skipped file / 2 skipped tests, and 85-file syntax proof.

2026-07-07 review follow-up for LocalStack provider smoke safety:

- Changed `server/tests/integration/providerCleanupLocalStack.integration.test.js` so the S3 and Cognito cleanup smoke paths inject the same LocalStack SDK clients that created the smoke resources. When `AWS_ENDPOINT_URL` is unset, the services no longer build fresh default AWS clients for the cleanup call.
- `npm run test:integration --prefix server -- tests/integration/providerCleanupLocalStack.integration.test.js` passed with 5 integration files / 34 tests and 1 skipped file / 2 skipped tests.
- With LocalStack 4.4.0 running locally, `$env:RUN_LOCALSTACK_PROVIDER_SMOKE='true'; $env:AWS_ENDPOINT_URL=''; $env:LOCALSTACK_ENDPOINT_URL=''; npm run test --prefix server -- tests/integration/providerCleanupLocalStack.integration.test.js` passed with 1 file / 2 tests.

2026-07-07 review follow-up for retryable-failure batch starvation:

- Added integration regression proof that a retryable row-specific cleanup failure does not starve later due deletion requests in the same batch. The first request fails provider cleanup and remains `PROCESSING` / `RETRYABLE`; the second due request is still selected and completed in the same `batchSize: 2` run.
- Changed `processDueAccountDeletions` so `FAILED` request ids are excluded from later selections in the same batch, matching the existing skip-continuation behavior for legal-hold and advisory-lock-busy rows, instead of breaking the batch loop.
- Red/green proof: `npm run test:integration --prefix server -- tests/integration/accountDeletionProcessor.integration.test.js` first failed with `processed: 1` instead of `processed: 2`; after the processor loop fix, the same command passed with 5 integration files / 35 tests and 1 skipped file / 2 skipped tests.
- `npm run server:build` passed with syntax check over 85 files.
- `npm run db:migrate` passed with 0 applied migrations.
- Harness intake #106 recorded this as a high-risk maintenance request.
- `npm run harness -- story verify TB-PRIVACY-RETENTION-JOB-001` passed; the configured command ran `npm run server:test && npm run server:build` with 15 server test files / 131 tests, 1 skipped file / 2 skipped tests, and 85-file syntax proof.

2026-07-07 review follow-up for retained tombstone contract:

- Added integration regression proof that completed account deletion writes the documented `+000` plus 16-hex SHA phone tombstone, per-row SHA-256 `user_sessions.refresh_token_hash` tombstones, and per-row SHA-256 `push_tokens.token_ciphertext` / `token_fingerprint` tombstones.
- Red/green proof: `npm run test:integration --prefix server -- tests/integration/accountDeletionProcessor.integration.test.js` first failed because `users.phone_number` still used the local UUID-derived `+84del...` value; after the processor fix, the same command passed with 5 integration files / 35 tests and 1 skipped file / 2 skipped tests.
- `npm run db:migrate` passed with 0 applied migrations.
- Harness intake #107 recorded this as a high-risk maintenance request.
- `npm run harness -- story verify TB-PRIVACY-RETENTION-JOB-001` passed; the configured command ran `npm run server:test && npm run server:build` with 15 server test files / 131 tests, 1 skipped file / 2 skipped tests, and 85-file syntax proof.

2026-07-07 review follow-up for active deletion auth guard before job claim:

- Added route-level regression proof that a user with an active `REQUESTED` deletion request cannot use the still-authenticated token/header path to mutate another protected API such as `POST /api/v1/restaurants`.
- Added route-level regression proof that once processing has set `users.status = DELETED`, `GET /api/v1/users/me/deletion-request` still returns the open `PROCESSING` request and `POST /api/v1/users/me/deletion-request/cancel` returns `DELETION_REQUEST_NOT_CANCELLABLE` instead of being blocked by the generic deleted-account status check.
- Changed the auth boundary so identity mapping can run without immediate local status enforcement for request-aware middleware, then `authMiddleware` rejects active deletion requests on non-deletion lifecycle routes with `DELETION_REQUEST_ACTIVE` while preserving suspended/deleted-account rejection for ordinary protected requests.
- Red/green proof: the targeted API regression first failed with `201 Created` for the restaurant mutation and `403 Forbidden` for the processing status read; after the fix, `npm run test:integration --prefix server -- tests/integration/userDeletionRequest.integration.test.js` passed with 5 integration files / 36 tests and 1 skipped file / 2 skipped tests.
- `npm run test:unit --prefix server -- tests/unit/auth/authService.test.js tests/unit/user/userService.test.js` passed with 10 unit files / 96 tests.
- `npm run test:integration --prefix server -- tests/integration/userProfile.integration.test.js tests/integration/adminUserSuspension.integration.test.js tests/integration/accountDeletionProcessor.integration.test.js` passed with 5 integration files / 36 tests and 1 skipped file / 2 skipped tests.
- `npm run server:test` passed with 15 server test files / 132 tests and 1 skipped file / 2 skipped tests.
- `npm run server:build` passed with 85-file syntax proof.
- `npm run db:migrate` passed with 0 applied migrations.

2026-07-07 review follow-up for processing-start audit evidence and lifecycle path normalization:

- Added integration regression proof that a due `REQUESTED` deletion request writes `ACCOUNT_DELETION_PROCESSING_STARTED` audit evidence with non-sensitive metadata when the processor claims it into `PROCESSING` and sets the local account fail-closed as `DELETED`; the proof uses a provider-cleanup failure path so the processing-start audit remains the durable explanation when completion does not happen.
- Changed `processDueAccountDeletions` claim handling to insert the processing-start audit record in the same transaction as the `REQUESTED -> PROCESSING` transition and fail-closed `users.status = DELETED` update. Retry of already-`PROCESSING` rows does not duplicate this processing-start evidence.
- Added route-level regression proof that trailing-slash lifecycle URLs keep the status/cancel contract under Express non-strict routing while active deletion requests are open.
- Red/green note: the first targeted integration attempt was blocked by Docker/PostgreSQL being down (`ECONNREFUSED` on `127.0.0.1` / `::1:15432`); after starting Docker Desktop, `npm run docker:up` and `npm run db:migrate`, the targeted integration command passed.
- Sequential proof passed: `npm run test:integration --prefix server -- tests/integration/userDeletionRequest.integration.test.js tests/integration/accountDeletionProcessor.integration.test.js` with 5 integration files / 36 tests and 1 skipped file / 2 skipped tests; `npm run test:unit --prefix server -- tests/unit/auth/authService.test.js tests/unit/privacy/deletionJobLogging.test.js` with 10 unit files / 96 tests; `npm run server:test` with 15 files / 132 tests and 1 skipped file / 2 skipped tests; `npm run server:build` with 85-file syntax proof; `npm run db:migrate` applied 0 migrations; `npm run harness -- story verify TB-PRIVACY-RETENTION-JOB-001` passed with 15 server test files / 132 tests and 85-file syntax proof.

2026-07-07 review follow-up for completion audit transition and aggregate eligibility:

- Added integration regression proof that `ACCOUNT_DELETION_COMPLETED` records the actual committed completion transition as `PROCESSING -> COMPLETED`, not the stale pre-claim `REQUESTED -> COMPLETED` status from the selected row.
- Added integration regression proof that restaurant aggregate recomputation excludes remaining reviews whose public eligibility is inconsistent with public review APIs, such as `status = 'HIDDEN'` with `public_visibility = 'PUBLIC'` and a non-`NONE` trust bucket.
- Red/green proof: `npm run test:integration --prefix server -- tests/integration/accountDeletionProcessor.integration.test.js` first failed with `audit_previous_status = REQUESTED` and aggregate `trust_score = 2.75`; after the processor fix, the same command passed with 5 integration files / 36 tests and 1 skipped file / 2 skipped tests.
- Final validation passed: `npm run server:test` with 15 server test files / 132 tests and 1 skipped file / 2 skipped tests; `npm run server:build` with 85-file syntax proof; `npm run db:migrate` applied 0 migrations; `npm run harness -- story verify TB-PRIVACY-RETENTION-JOB-001` passed with 15 server test files / 132 tests and 85-file syntax proof.

2026-07-07 review follow-up for zero-eligible aggregate score:

- Fixed the account deletion aggregate recompute so deleting the only eligible public trusted review sets `restaurants.trust_score = NULL` instead of resetting the restaurant to the maximum `5.00` score with `verified_review_count = 0`.
- Added integration regression proof for the zero-eligible case. Red/green proof: `npm run test:integration --prefix server -- tests/integration/accountDeletionProcessor.integration.test.js` first failed with `trust_score = 5.00`; after the processor fix, the same command passed with 5 integration files / 37 tests and 1 skipped file / 2 skipped tests.
- Final validation passed: `npm run server:test` with 16 server test files / 135 tests and 1 skipped file / 2 skipped tests; `npm run server:build` with 85-file syntax proof; `npm run db:migrate` applied 0 migrations; `npm run harness -- story verify TB-PRIVACY-RETENTION-JOB-001` passed with 16 server test files / 135 tests and 85-file syntax proof.
