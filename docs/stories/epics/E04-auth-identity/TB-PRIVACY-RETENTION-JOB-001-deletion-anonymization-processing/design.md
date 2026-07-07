# Design

## Domain Model

- Deletion request: `account_deletion_requests` row with `REQUESTED`, `PROCESSING`, `COMPLETED`, or `CANCELLED` status.
- Due request: a `REQUESTED` request whose `scheduled_deletion_at` is null or less than or equal to `now()`. Null currently means no configured grace-period delay.
- Processing claim: the mechanism that prevents duplicate workers from completing the same request. The processor claims due `REQUESTED` rows into `PROCESSING`, commits a local fail-closed guard, keeps cleanup handles durable until completion, retries incomplete `PROCESSING` rows on later runs, and protects each attempt with a session-level PostgreSQL advisory lock on the same checked-out client while non-transactional provider/object cleanup runs. Migration `004_add_account_deletion_cleanup_state.sql` adds durable cleanup state, retry attempts, last error code/time, lease token/expiry, and legal-hold markers without adding new deletion-request statuses. Decision `0015-account-deletion-retention-scope` accepts request-level cleanup state as sufficient for this story; provider/object work-item tables are deferred until operations need finer-grained status. Provider and object-storage cleanup are non-transactional side effects; do not hold a long DB transaction around remote calls unless the calls are bounded, idempotent, retry-safe, and covered by explicit proof.
- Processing deletion guard: `users.status = DELETED` may be committed before final anonymization/completion only to fail closed for auth while `account_deletion_requests.status = PROCESSING`; during this state, `users.deleted_at` remains null and cleanup handles remain durable.
- Completed deleted user: `users.status = DELETED`, `users.deleted_at IS NOT NULL`, and personal/profile/identity fields anonymized, cleared, retained as a deleted-account deny mapping, or unmapped according to the retention map.
- Provider-deleted identity: the mapped Cognito account for `users.cognito_sub` has been deleted, disabled, or globally signed out according to the selected provider cleanup rule and provider identifier requirements; if this cannot be proven, account deletion completion is blocked unless a legal/fraud/audit retention decision explicitly requires retaining that provider identity. Do not assume the Cognito `sub` is accepted as the Cognito administrative username without provider proof.
- Retained minimum record: audit/fraud/legal records kept only as allowed by `Data_Retention_Policy.md`, with `retained_data_reason` on the deletion request when applicable. Because the current schema has one `retained_data_reason` text field, use a controlled, non-PII reason-code format such as `AUDIT_MINIMUM;FRAUD_DUPLICATE_HASH;LEGAL_HOLD_CASE:<opaque-case-id>`. If per-table, per-object, expiry-specific, or richly structured retention reasons are required, stop for a schema story rather than overloading free text. A retained Cognito subject mapped to a `DELETED` user row is permitted only as security/audit-minimum identity denial data; do not expose it in APIs/logs or treat it as active provider PII.

Business rules:

- `BR-PRIV-004`: retention follows the Data Retention Policy.
- `BR-PRIV-007`: accepted account deletion must revoke sessions, delete or anonymize PII, and retain audit/fraud/legal minimum data only with reason.
- Account deletion is not account suspension and cannot be reversed through admin reactivation.
- `COMPLETED` deletion must imply revoked local `user_sessions`, deleted or schema-valid-tombstoned local session/device secrets, inactive plus deleted or schema-valid-tombstoned `push_tokens`, local account status `DELETED`, rejected Cognito identity through a retained deleted-user mapping or safe unmapped path, and either completed provider/object cleanup or an explicit legal/fraud/audit retained-data reason. Provider/object cleanup failures and missing provider/storage boundaries are blockers, not successful completion, unless policy explicitly requires retaining that data; a blocker note by itself is not a retained-data reason and cannot justify marking the request or story complete.
- `REQUESTED` and `PROCESSING` are both active deletion request states for the existing `GET /users/me/deletion-request`/duplicate-request contract; processor implementation must preserve that behavior unless the API story is explicitly changed.
- Open deletion requests must fail closed before the processor finishes. Because request creation currently leaves `users.status = ACTIVE` and Cognito access tokens can remain valid until expiry, the implementation must add or depend on an auth/API guard that blocks protected mutations for users with an open `REQUESTED` or `PROCESSING` deletion request, except explicitly documented deletion status/cancel operations. Do not rely on scheduler latency or “immediate” due processing as the only protection.
- Cancellation direction for this story is `REQUESTED`-only cancellation before processor claim. Once a request is claimed into `PROCESSING`, cancellation is non-cancellable through the user endpoint because provider/object cleanup and the local fail-closed guard may already be underway. This is aligned with `State_Machines.md` and `Status_Mapping.md`; if a future operator-abort path is needed, it requires schema-backed proof that no non-rollbackable cleanup has started.
- Cognito owns authentication/token/session lifecycle. The processor may clean up Cognito identity/session state through a provider service, but must not revive backend-issued refresh-token/session ownership. Where `API_Specification.md` still contains legacy backend refresh/session wording, the accepted Cognito-first decisions are the source of truth for this story.
- Provider cleanup semantics must distinguish provider PII deletion from token invalidation. Cognito global sign-out may be required to invalidate provider refresh/access-token sessions, but global sign-out alone does not delete provider profile PII; disabling rather than deleting a Cognito user also leaves provider PII and therefore requires an explicit retention/legal decision before it can count as completed deletion.
- Non-rollbackable cleanup must fail closed. Before deleting/disabling the provider identity or deleting storage objects that cannot roll back with PostgreSQL, the implementation must commit a local guard that rejects otherwise-valid Cognito-compatible tokens and blocks protected mutations for the account. With the current schema, the preferred guard is `account_deletion_requests.status = 'PROCESSING'` plus `users.status = 'DELETED'` while retaining `users.cognito_sub`, the original phone, and owned-object URLs until provider/storage cleanup succeeds or a durable cleanup-work schema exists. Do not set `account_deletion_requests.completed_at`, clear cleanup handles, or claim `users.deleted_at` completion until final anonymization/cleanup is durable. This resolves the grace-period deletion-pending intent without inventing a user status value absent from the current migration. If the current schema cannot represent a recoverable in-progress guard plus retry state, including durable access to the provider username/object keys needed for retries after local PII is tombstoned, stop for a migration/decision instead of performing provider cleanup while the local user can roll back to `ACTIVE` or while cleanup identifiers would be lost after a crash.

## Application Flow

Processor flow for each batch:

1. Open a short transaction and select due `REQUESTED` rows with row-level locking, preferably `FOR UPDATE SKIP LOCKED`, ordered by `requested_at` and bounded by a batch size. If due-request volume matters, add a schema story for an index on `(status, scheduled_deletion_at, requested_at)` instead of accepting unbounded scans.
2. For each selected row, lock the corresponding `users` row, verify no cancellation already occurred, and claim the request by setting `account_deletion_requests.status = 'PROCESSING'` plus a fail-closed local guard (`users.status = 'DELETED'`) in the same committed transaction. Keep `completed_at`, `users.deleted_at`, `users.cognito_sub`, original `users.phone_number`, and owned object URL columns intact at this claim stage so retries still have cleanup handles. Insert only non-sensitive audit evidence for processing start. Commit the claim before any provider/storage call.
3. Process claimed `PROCESSING` rows idempotently. Every run must find `PROCESSING` rows that are not `COMPLETED`, attempt a session-level advisory lock before provider/storage cleanup, persist `cleanup_state = CLEANUP_IN_PROGRESS`, increment `cleanup_attempts`, and write `cleanup_lease_token` plus `cleanup_lease_expires_at` before external cleanup begins. Reserve one dedicated PostgreSQL client for the full locked attempt, acquire the lock on that client, keep that same client checked out while provider/storage cleanup runs, unlock on that same client in `finally`, and then call `client.release()`. Do not acquire or release this session-level lock through `pool.query()`, because `pool.query()` can return the session to the pool between lock and unlock. Call `pg_try_advisory_lock` for the row; if it returns `false`, skip that row, increment `skipped`, release the client, and continue the batch instead of blocking the worker. Only after the try-lock returns `true` should the worker perform provider/storage cleanup for that request, and it must release the lock in a `finally` path. Do not use blocking `pg_advisory_lock` for processor retries unless a later decision documents the wall-clock timeout and fairness tradeoff. Do not use transaction-scoped advisory locks for provider/storage calls, because they either require a long transaction around remote calls or release before the duplicate-work window is protected. If the hash-collision risk, starvation/backoff, per-provider status, per-object status, or retry limits are unacceptable, stop for a migration/decision that adds a cleanup-work schema.
4. Preserve the original `users.cognito_sub`, `users.phone_number`, and owned object URLs/keys in the database until cleanup and DB changes are retry-safe without another lookup. If a later implementation wants to clear/tombstone those values before provider/storage cleanup completes, it needs a schema-backed, access-controlled cleanup work item or another durable way to retry without exposing raw PII broadly; do not rely on in-memory values across commits, process crashes, or later retries, and do not store or log those raw values in audit metadata.
5. Revoke remaining local `user_sessions` by setting `revoked_at = COALESCE(revoked_at, now())`. Treat these rows as local product/device state, not Cognito refresh-token ownership. Because request-time code may already have revoked every active row, processing must prove idempotent no-op behavior for already-revoked sessions. Because `refresh_token_hash` is `NOT NULL`, prefer deleting session rows where retention allows; any retained session row must overwrite `refresh_token_hash` with a per-row non-sensitive tombstone using `deleted-session-token-hash:` plus the lowercase hex `sha256('trustbite-deleted-session-token-hash:' || user_session_id::text)`, and `device_label` should be cleared/minimized. Because Cognito-issued access tokens can remain valid until expiry, completion proof must show auth rejects the user via local `DELETED` state or unmapped identity even when the token verifies.
6. Deactivate remaining `push_tokens` by moving active tokens to `INACTIVE`; do not log `token_ciphertext` or full fingerprints. Status-only deactivation is not enough for deletion completion because `token_ciphertext` and `token_fingerprint` remain sensitive and `NOT NULL`. Prefer deleting `push_tokens` where retention allows so `notification_delivery_logs` cascade through the existing FK. If a token row must be retained, overwrite `token_ciphertext` and `token_fingerprint` with per-row schema-valid tombstones that preserve the `(user_id, token_fingerprint)` uniqueness constraint: use `deleted-push-token-ciphertext:` plus the lowercase hex `sha256('trustbite-deleted-push-token-ciphertext:' || push_token_id::text)` for `token_ciphertext`, and `deleted-push-token-fingerprint:` plus the lowercase hex `sha256('trustbite-deleted-push-token-fingerprint:' || push_token_id::text)` for `token_fingerprint`. These values are deterministic, non-provider-token values, and unique per retained token row because `push_tokens.id` is unique. Prove this is idempotent when request-time revocation already moved all active tokens to `INACTIVE`.
7. Call provider cleanup through a service boundary for the mapped Cognito identity, such as delete user plus global sign-out, or disable only when an accepted retention/legal rule permits provider PII to remain, only after a fail-closed local mutation guard is visible outside the processor transaction or after an equivalent proof shows no old token can mutate the account if cleanup succeeds and later DB work fails. The current Cognito provider verifies access tokens only, so this story must add a provider-admin cleanup boundary or document a provider blocker that keeps completion blocked. Provider cleanup must verify the identifier needed by the Cognito API; if the current schema only has `users.cognito_sub` and that is insufficient, stop for a schema/provider decision rather than guessing. Provider cleanup must be idempotent for already-missing provider users.
8. Clean up TrustBite-owned profile/avatar, receipt/review media, and merchant claim evidence objects through a storage service boundary when `users.avatar_url`, `receipt_verifications.file_url`, `receipt_verifications.redacted_file_url`, `review_media.url`, or merchant claim evidence URLs point to owned/private objects for the deleting user. Because the schema stores URLs rather than object keys, implement an ownership parser/allowlist for TrustBite bucket host, configured bucket name, and allowed object prefixes before deleting anything; never delete arbitrary external URLs just because they are stored on a user-linked row. `users.avatar_url` is nullable and should be cleared only after the owned object is deleted, proven external/unowned, or explicitly retained; current URL columns such as `receipt_verifications.file_url`, `review_media.url`, and `restaurant_claims.evidence_url` are `NOT NULL`, so use row deletion/cascade, inactive status plus non-sensitive tombstone URLs, or retained-with-reason handling rather than `NULL`. If object deletion is deferred or legally retained, write the retained-data reason and do not leave public/active URLs exposed.
9. Anonymize or clear profile/identity PII on `users`:
   - clear `display_name`,
   - clear `avatar_url` only after classifying the URL as external/unowned, deleting the TrustBite-owned object, or recording an explicit retained-object reason; do not orphan an owned avatar object by clearing the database pointer before cleanup/retry handles are durable,
   - before any `users.phone_number` update, capture `original_phone` from the locked `users` row and, in the same transaction, anonymize or delete `otp_verifications.phone_number` and `otp_verifications.otp_hash` rows keyed by `original_phone` according to the 30-day OTP retention rule; do not commit between OTP cleanup and the phone tombstone,
   - after provider cleanup and the same-transaction phone-keyed OTP cleanup no longer need the original value, replace `phone_number` with a deterministic non-contactable tombstone value that preserves uniqueness and satisfies `VARCHAR(20) UNIQUE NOT NULL`: use `+000` plus the rightmost 16 lowercase hex characters of `sha256('trustbite-deleted-phone:' || user_id::text)`; this produces exactly 20 characters, is deterministic per user, is not a dialable/contactable phone number in TrustBite-supported numbering rules, and must be collision-checked/retried only by changing the documented algorithm through a decision if a theoretical hash suffix collision occurs,
   - after provider cleanup succeeds or an accepted provider-retention reason is recorded, either keep `cognito_sub` mapped to the `DELETED` tombstone row so existing Cognito tokens are rejected by local status, or clear/replace it only if another deny-list or provider cleanup proof prevents the same subject/verified phone from being mapped to a new or active local user; never clear `cognito_sub` in a way that converts an otherwise-valid old token into `UNMAPPED_IDENTITY` while the verified-phone fallback can create or reattach an active account,
   - reset local profile/gamification surfaces stored on the user row, such as `exp_points = 0`, `rank_code = 'NEWBIE'` after verifying the `rank_definitions` seed from `server/migrations/001_init_schema.sql` exists, and `review_restricted_until = NULL` unless a fraud/legal retention rule explicitly requires keeping the restriction timestamp; because `users.rank_code` is a `NOT NULL` FK with default `NEWBIE`, a missing seed is migration drift and must block for seed repair instead of writing `NULL` or retaining a profile rank,
   - set `status = DELETED`,
   - set `deleted_at = now()`,
   - keep `deletion_requested_at` only as a minimal lifecycle timestamp unless the retention policy says to clear it,
   - keep `id` for foreign-key integrity.
10. Apply the schema-backed retention map for related records. Do not invent columns outside migrations:
    - Reviews by the deleted user: set `reviews.status = 'DELETED'`, `public_visibility = 'PRIVATE'`, `trust_label = 'DELETED'`, `trust_weight_bucket = 'NONE'`, and clear/replace `comment` with a non-PII deletion tombstone because `comment` is `NOT NULL`. Clear/minimize `visited_at` and `hidden_reason` unless retained with reason. `food_rating`, `price_rating`, `service_rating`, and `ambience_rating` are `NOT NULL` and drive generated `average_rating`; if the review row is retained, those ratings must be private, excluded from trust-score/public aggregates, and retained only with an explicit audit/fraud/legal reason, otherwise delete the review row where policy/schema allow. Set `verification_status = 'DELETED'` only if the accepted status mapping for privacy deletion selects it. Delete or retain `review_tags`, `review_votes`, and `review_replies` attached to deleted/tombstoned reviews according to whether the review row is retained; retained replies must be hidden or tombstoned so a deleted user's review thread is not still public. Make sure deleted reviews are excluded from trust-score inputs.
    - Restaurant review aggregates and summaries: update, invalidate, or queue recomputation for `restaurants.trust_score`, `verified_review_count`, `reference_review_count`, `review_summaries.summary_text`, `review_summaries.model_version`, `review_summaries.review_count`, and `review_summaries.avg_rating` that could include deleted-user review content. The migrated `review_summaries` table has no status/invalidation column and is keyed at restaurant level, so deleting an affected row can temporarily remove AI summary coverage for reviews written by users who are not being deleted. If updating counters or ratings without regenerating `summary_text`, preserve the existing `review_summaries.model_version`; if regenerating `summary_text`, write only the accepted summarization model version from the recomputation path. Do not set `model_version` to `NULL`, a placeholder, or an arbitrary value just to satisfy the `NOT NULL` constraint. If no recomputation worker/queue exists by implementation time, do not silently delete affected `review_summaries` rows; either get explicit product sign-off for the temporary restaurant-level summary loss, or stop for a recomputation/invalidation story rather than inventing an invalidation field or leaving stale generated text. Set aggregate counters from the retained non-deleted review set inside the same proof path; when there are zero retained eligible reviews, set `verified_review_count = 0`, `reference_review_count = 0`, and `restaurants.trust_score = NULL` to represent no eligible trust-score basis. `restaurants.trust_score` must otherwise be recomputed with the accepted backend trust-score rule or, if that rule/calculator still does not exist, the implementation must stop for the trust-score dependency instead of leaving a stale score that still reflects deleted reviews. Do not leave summaries, aggregate counters, or trust scores treating `DELETED` reviews as public/trustable.
    - Review translation caches: current migrated schema does not include `review_translations`, even though the product schema/API references translation caches. Do not write SQL against `review_translations` unless a migration exists by implementation time; if it is migrated before this story is implemented, delete or invalidate `translated_text`/`original_text_hash` rows for deleted or tombstoned reviews so translated review content is not retained/displayed after source deletion.
    - Receipt verifications by the deleted user: clear or tombstone raw PII fields such as `ocr_text`, `ocr_restaurant_name`, `ocr_invoice_no`, `ocr_receipt_time`, `ocr_total_amount`, `decision_reason`, GPS latitude/longitude/accuracy/distance, and raw object URLs unless retained with reason; keep `file_hash_sha256`, `transaction_unique_hash`, `ocr_similarity`, `fraud_risk_score`, `decision`, and fraud/risk fields only if allowed for fraud/audit minimum retention. Because `file_url` and `file_hash_sha256` are `NOT NULL`, use deletion, retained-with-reason, or per-row non-sensitive tombstones that preserve duplicate/fraud constraints and partial unique indexes.
    - Receipt line items and menu maps: delete line items when allowed so `receipt_line_item_menu_maps` cascades, or anonymize purchase details through schema-valid operations. If line-item rows are retained with tombstones, delete `receipt_line_item_menu_maps` first so menu-item joins do not reveal the deleted user's purchases. `raw_item_name`, `quantity`, `unit_price`, and `total_price` can expose receipt contents; because `raw_item_name`, `quantity`, `unit_price`, and `total_price` are `NOT NULL`, use deletion, retained-with-reason, or non-PII/non-sensitive per-row tombstones if retained.
    - Review media: delete rows where allowed, or mark media `INACTIVE` and replace owned object URLs with non-sensitive tombstones; do not leave public media active for deleted-user reviews.
    - Review votes and other user interactions: `review_votes` is relationship-like data with no PII field to minimize; delete votes cast by the deleted user and votes attached to the user's deleted/tombstoned reviews unless fraud/audit retention requires keeping them, and document the retained reason when kept.
    - Notifications and push delivery: prefer deleting `notifications` for the deleted recipient so `notification_delivery_logs` cascade when retention policy allows. If notifications must be retained, tombstone/minimize notification `title`, `body`, and `payload`; then either delete delivery logs or tombstone `notification_delivery_logs.error_message` and retain/tombstone the referenced `push_tokens` rows because `notification_delivery_logs.push_token_id` is `NOT NULL` and cascades if the push token row is deleted. Keep delivery logs only if they no longer expose token/user PII or have a retained reason.
    - Phone-keyed auth evidence: handled before the `users.phone_number` tombstone in step 9 using the captured `original_phone`; keep this in the related-record retention checklist to prove `otp_verifications.phone_number` and `otp_verifications.otp_hash` are deleted or anonymized according to the 30-day OTP retention rule, with only abuse-investigation fields retained when policy allows. Do not recreate backend-owned OTP behavior.
    - User-owned social/gamification/local state: relationship-only tables have no fields to minimize, so choose delete or retain-with-reason explicitly. Delete `user_follows`, `user_roles`, `user_badges`, `review_votes` cast by the deleted user, and `user_saved_list_restaurants` when allowed; retain only if a fraud/audit/legal reason is documented. For `user_blocks` in both directions, delete where allowed or retain inbound safety records only with a retained reason and keep them out of advertising/profiling. For `user_saved_lists`, delete lists when allowed so `user_saved_list_restaurants` cascades; if lists are retained, `name` is `NOT NULL` and must use a non-PII tombstone. For `exp_transactions`, delete or retain aggregate/audit records with reason and no profile surface. For idempotency rows, prefer deletion after expiry/retention when allowed; if retained, tombstone with schema-valid values that preserve `idempotency_key UUID NOT NULL`, `endpoint VARCHAR(120) NOT NULL`, `request_hash CHAR(64) NOT NULL`, and `UNIQUE(user_id, endpoint, idempotency_key)`: set `idempotency_key` to a deterministic UUID formed from the first 32 lowercase hex characters of `sha256('trustbite-deleted-idempotency-key:' || idempotency_keys.id::text)`, formatted as UUID with version/variant bits set to `xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx`; set `endpoint` to `/deleted/idempotency/` plus the lowercase hex `sha256('trustbite-deleted-idempotency-endpoint:' || idempotency_keys.id::text)`; set `request_hash` to the lowercase hex `sha256('trustbite-deleted-idempotency-request-hash:' || idempotency_keys.id::text)`. These values are deterministic per row, fit the migrated column types, and preserve uniqueness because `idempotency_keys.id` is unique. Treat `response_body`, `resource_type`, and `resource_id` as potential payload echoes/correlators too.
    - Merchant/admin/moderation/audit rows: retain only minimum records needed for legal, fraud, or audit obligations. Cover merchant-owner records (`merchants`, `restaurant_merchants`, `restaurant_claims`, `review_replies`) when the deleted user is also a merchant/admin actor. A deleted local user must not leave active merchant authority behind: choose schema-valid deactivation such as `merchants.status = 'SUSPENDED'` where appropriate, `restaurant_merchants.status = 'INACTIVE'`, and `review_replies.status = 'HIDDEN'` plus a non-PII reply tombstone when replies are retained. Minimize sensitive text/URLs such as `merchants.business_name` when personal, claim evidence, admin notes, reply messages, moderation report descriptions, moderation action reasons, audit reasons, and audit metadata where policy allows, and set `retained_data_reason` when any such data remains. Cover actor/reference columns such as `restaurant_claims.decided_by`, `receipt_verifications.decided_by`, `moderation_reports.reporter_id`, `moderation_actions.admin_id`, and `audit_logs.actor_id` as retained audit references or minimized where schema/policy allows. Also cover target/entity references such as `moderation_reports.entity_type`/`entity_id`, `moderation_actions.entity_type`/`entity_id`, and `audit_logs.entity_type`/`entity_id` when the deleted user, the user's reviews, or the user's receipt verifications are the subject of the record; retain those target references only as minimum audit/fraud/legal evidence and keep them out of public/profile surfaces.
    - Fraud rows: cover `fraud_flags` and `fraud_flag_entities` linked to the deleted user directly (`entity_type = 'USER'`) or through that user's reviews/receipt verifications. Retain fraud-minimum `flag_code`, `risk_score`, `status`, and entity references only when the retention policy allows abuse/fraud evidence; otherwise detach/delete through schema-valid operations. Do not drop fraud evidence needed for duplicate-receipt or abuse investigations without a policy decision, and do not expose retained fraud entity references to public/profile surfaces.
    - Admin queues and assignments: a deleted local user must not remain an active admin assignee. Resolve/delete `admin_queue_assignments` for `admin_user_id = deleted user` using schema-valid operations such as setting `resolved_at` or deleting the assignment where policy allows; because assignment rows have only FK/timestamp fields, there is no partial minimization option. Update/reopen/escalate the related `admin_queues.status` only through the accepted queue workflow. For generic `admin_queues.entity_id`, act only through accepted `queue_type`-specific ownership semantics; if a row's target cannot be proven to be the deleted user, the user's reviews, or the user's receipt verifications, stop for a queue ownership decision instead of guessing.
    - Restaurant image/object ownership gap: `restaurant_images.image_url` and `restaurant_images.caption` can contain media/text, but the migrated schema has no user or merchant owner column. Do not delete or retain these as deleted-user data by guesswork. If product policy requires merchant-uploaded restaurant image cleanup during account deletion, stop for an ownership/schema story or a documented non-user-owned restaurant-content decision.
    - Account deletion request rows: minimize or retain `account_deletion_requests.reason` only according to the deletion-request audit retention rule; do not put raw deletion reasons into logs or broad audit metadata.
    - Price and derived review data: retain `price_history` and receipt-derived price observations only if they no longer expose user/receipt PII or are required for fraud/audit; otherwise delete, detach by setting nullable `price_history.review_id = NULL`, or record a retained reason using existing schema-valid fields.
    - Merchant/business content ownership gap: aside from the merchant authority tables explicitly listed above, the migrated restaurant/menu/branch/operating-hours/category/payment/amenity tables do not record the creating user or merchant. Do not delete or rewrite restaurant profile, menu, branch, operating-hours, category, amenity, or payment-method data as deleted-user data by guesswork. If product policy requires merchant-contributed business content cleanup during account deletion, stop for an ownership/schema decision.
11. Insert audit/privacy lifecycle evidence without raw tokens, full phone numbers, Cognito subjects, S3 keys, OCR text, GPS values, deletion reasons, moderation descriptions, notification payloads, or other sensitive free text.
12. Mark the deletion request `COMPLETED`, set `completed_at`, set `processed_by` only to a real TrustBite user id when a human/system actor exists in `users`, and otherwise leave it `NULL` because the migrated column is nullable. Set `retained_data_reason` if minimum audit/fraud/legal data remains. Do not use `retained_data_reason` to hide ordinary provider/object cleanup failure; those failures block completion unless a legal/fraud/audit retention rule explicitly requires keeping the data. Document the accepted user-cancellation shape before implementation: user cancellation is `REQUESTED`-only, while `PROCESSING` requests return the agreed non-cancellable state-conflict error unless a later schema-safe operator-abort story supersedes this rule.
13. Commit. On failure, rollback the current transaction and report failure counts without leaking PII. If the initial claim transaction fails, the request remains `REQUESTED`, the user remains active, and no provider/storage cleanup is attempted. If any non-transactional provider/object cleanup succeeded before a later DB failure, rollback the failed finalization transaction, mark the request `PROCESSING`/`RETRYABLE` with a redacted error code, keep cleanup handles durable for the next run, and keep the local account fail-closed. The next run must be safe to repeat provider/object cleanup, must not recreate deleted provider/object data, and must not leave the local account authenticate-able or mutation-capable during the retry window.

## Interface Contract

The implementation should expose a non-public execution surface, for example:

- service function: `processDueAccountDeletionRequests({ batchSize, now, processedBy })`,
- CLI/script command: a local one-shot job command for smoke proof,
- optional scheduled runtime hook only if deployment scheduling is in scope.

Expected result shape for the service/job:

```json
{
  "claimed": 0,
  "completed": 0,
  "failed": 0,
  "skipped": 0,
  "providerCleanupBlocked": 0,
  "objectCleanupBlocked": 0
}
```

No new public API route is required for this story.

## Data Model

Implementation schema source of truth:

- `server/migrations/001_init_schema.sql`
- `server/migrations/002_add_users_cognito_sub.sql`

Migration `004_add_account_deletion_cleanup_state.sql` adds durable processor state on `account_deletion_requests`:

- `cleanup_state` with `PENDING`, `CLEANUP_IN_PROGRESS`, `RETRYABLE`, `COMPLETED`, and `LEGAL_HOLD`.
- `cleanup_attempts`.
- `cleanup_last_error_code` and `cleanup_last_error_at`.
- `cleanup_lease_token` and `cleanup_lease_expires_at`.
- `legal_hold` and `legal_hold_reason`.
- `idx_account_deletion_cleanup_due` for due active cleanup scans.

The migrated schema still lacks provider username/handle storage, per-provider cleanup status, per-object cleanup status, per-category retention expiry, and a separate cleanup-work table. This story therefore uses the retryable `PROCESSING` + local `DELETED` guard described above with durable cleanup handles kept in existing rows; if operations need those finer-grained fields, pause for another high-risk migration/decision before claiming that broader observability complete.

Product schema reference:

- `trustbite-docs/06_Database_Design/PostgreSQL_Database_Schema.md`

If the product schema reference names tables or columns that are not in the migrations, do not write SQL against them in this story; stop for the appropriate schema story/migration first.

Tables/columns expected in scope:

- `account_deletion_requests.id`
- `account_deletion_requests.user_id`
- `account_deletion_requests.status` (`REQUESTED`, `PROCESSING`, `COMPLETED`, `CANCELLED` only)
- `account_deletion_requests.reason`
- `account_deletion_requests.requested_at`
- `account_deletion_requests.scheduled_deletion_at`
- `account_deletion_requests.completed_at`
- `account_deletion_requests.retained_data_reason`
- `account_deletion_requests.processed_by` (nullable in `server/migrations/001_init_schema.sql`; automated runs may leave it `NULL` unless a real human/system actor exists in `users`)
- `users.phone_number`
- `users.display_name`
- `users.avatar_url` (nullable, but object cleanup/retention must be resolved before clearing an owned URL)
- `users.cognito_sub`
- `users.status` (`ACTIVE`, `SUSPENDED`, `DELETED` only)
- `users.deletion_requested_at`
- `users.deleted_at`
- `otp_verifications.phone_number`
- `otp_verifications.otp_hash`
- `user_sessions.revoked_at`
- `user_sessions.refresh_token_hash`
- `user_sessions.device_label`
- `push_tokens.status` (`ACTIVE`, `INACTIVE` only)
- `push_tokens.token_ciphertext`
- `push_tokens.token_fingerprint`
- `reviews.comment`
- `reviews.status`
- `reviews.verification_status`
- `reviews.trust_label`
- `reviews.public_visibility`
- `reviews.trust_weight_bucket`
- `restaurants.trust_score`
- `restaurants.verified_review_count`
- `restaurants.reference_review_count`
- `restaurant_claims.status`
- `restaurant_claims.evidence_url`
- `restaurant_claims.admin_note`
- `restaurant_claims.decided_by`
- `merchants.business_name`
- `merchants.status`
- `restaurant_merchants.status`
- `review_replies.review_id`
- `review_replies.merchant_id`
- `review_replies.message`
- `review_replies.status`
- `receipt_verifications.file_url`
- `receipt_verifications.file_hash_sha256`
- `receipt_verifications.status`
- `receipt_verifications.ocr_text`
- `receipt_verifications.ocr_restaurant_name`
- `receipt_verifications.ocr_invoice_no`
- `receipt_verifications.ocr_receipt_time`
- `receipt_verifications.ocr_total_amount`
- `receipt_verifications.ocr_similarity`
- `receipt_verifications.decision_reason`
- `receipt_verifications.decided_by`
- `receipt_verifications.gps_latitude`
- `receipt_verifications.gps_longitude`
- `receipt_verifications.gps_accuracy_meters`
- `receipt_verifications.gps_distance_meters`
- `receipt_verifications.redacted_file_url`
- `receipt_line_items.raw_item_name`
- `review_media.url`
- `review_media.status`
- `notifications.recipient_user_id`
- `notifications.title`
- `notifications.body`
- `notifications.payload`
- `notification_delivery_logs.notification_id`
- `notification_delivery_logs.push_token_id`
- `notification_delivery_logs.error_message`
- `idempotency_keys.user_id`
- `idempotency_keys.idempotency_key`
- `idempotency_keys.endpoint`
- `idempotency_keys.request_hash`
- `idempotency_keys.response_body`
- `idempotency_keys.resource_type`
- `idempotency_keys.resource_id`
- `audit_logs.actor_id`
- `audit_logs.entity_type`
- `audit_logs.entity_id`
- `audit_logs.reason`
- `audit_logs.metadata`
- `audit_logs` for lifecycle evidence
- `moderation_reports.reporter_id`
- `moderation_reports.entity_type`
- `moderation_reports.entity_id`
- `moderation_reports.description`
- `moderation_actions.admin_id`
- `moderation_actions.entity_type`
- `moderation_actions.entity_id`
- `moderation_actions.reason`
- `fraud_flags.flag_code`
- `fraud_flags.risk_score`
- `fraud_flags.status`
- `fraud_flag_entities.entity_type`
- `fraud_flag_entities.entity_id`
- `user_saved_lists.name`
- `user_saved_lists.description`
- `review_summaries.summary_text`
- `review_summaries.model_version`
- `review_summaries.review_count`
- `review_summaries.avg_rating`
- `price_history.review_id`
- `price_history.source`
- `price_history.observed_price`
- `price_history.observed_at`

Also in scope for this story, even when the action is retain/minimize only: `users.exp_points`, `users.rank_code`, `users.review_restricted_until`, `account_deletion_requests.cancelled_at`, `reviews.food_rating`, `reviews.price_rating`, `reviews.service_rating`, `reviews.ambience_rating`, `reviews.visited_at`, `reviews.hidden_reason`, `receipt_verifications.transaction_unique_hash`, `receipt_verifications.fraud_risk_score`, `receipt_verifications.decision`, `user_roles.role_id`, `user_follows`, `user_blocks`, `review_tags`, `review_votes`, `receipt_line_items`, `receipt_line_item_menu_maps`, `user_badges`, `exp_transactions`, `fraud_flags`, `fraud_flag_entities`, `admin_queues`, `admin_queue_assignments`, and `restaurant_images.image_url` / `restaurant_images.caption` (ownership unresolved; only clean if a separate decision proves they are merchant-owned and in scope).

Sensitive `NOT NULL` columns cannot be cleared to `NULL`. The retention map must choose deletion/cascade, retained-with-reason, or a schema-valid non-sensitive tombstone for fields such as `users.phone_number`, `user_sessions.refresh_token_hash`, `push_tokens.token_ciphertext`, `push_tokens.token_fingerprint`, `reviews.comment`, `receipt_verifications.file_url`, `receipt_verifications.file_hash_sha256`, `receipt_line_items.raw_item_name`, `receipt_line_items.quantity`, `receipt_line_items.unit_price`, `receipt_line_items.total_price`, `review_media.url`, `notifications.title`, `restaurant_claims.evidence_url`, `merchants.business_name`, `review_replies.message`, `moderation_actions.reason`, `idempotency_keys.idempotency_key`, `idempotency_keys.endpoint`, `idempotency_keys.request_hash`, `review_summaries.summary_text`, `review_summaries.model_version`, and `user_saved_lists.name`. Nullable object URL fields such as `users.avatar_url` may be set to `NULL`, but only after owned-object cleanup, ownership refusal, or explicit retained-object handling is durable.

No further fields should be added unless discovery proves the accepted schema cannot satisfy the retention/audit/provider-cleanup contract. Likely examples that would require another migration/decision are provider username/handle storage, per-provider cleanup status, per-object cleanup status, per-category retained-data reasons or expiry, or a separate cleanup-work table.

## UI / Platform Impact

- No direct client/mobile UI change in this story.
- Deleted users should no longer be able to use protected backend mutations because auth middleware/services reject `users.status = DELETED` through a retained deleted-user mapping, or because provider cleanup/another explicit deny-list makes otherwise-valid Cognito tokens unusable. Do not rely on merely clearing `users.cognito_sub` while verified-phone fallback can map the same provider identity to an active row.
- The plan must explicitly preserve or change request-time behavior for users in `REQUESTED` state. Current request-time code revokes local sessions/push tokens but does not set `users.status = DELETED` until processing, and Cognito access tokens can still pass auth while the local user remains `ACTIVE`; implementation must not silently assume a new `DELETION_REQUESTED` status because the current schema only allows `ACTIVE`, `SUSPENDED`, and `DELETED`. If a grace period is introduced, protected mutations need an explicit deletion-request guard with documented exceptions for deletion status/cancel operations.
- Store-readiness evidence depends on this job plus separate mobile/web deletion entry points.

## Observability

- Operational job logs should contain aggregate counts and a non-sensitive job run id only: claimed, completed, failed, skipped, provider cleanup blocked, object cleanup blocked. Per-user/request identifiers belong in access-controlled audit records, not ordinary operational logs.
- Do not log raw phone numbers, Cognito subjects, tokens, session hashes, token fingerprints, push token ciphertext, S3 object keys/URLs, receipt OCR text, receipt totals/timestamps, GPS values, account deletion reasons, moderation descriptions, notification payloads, or other free-form sensitive reasons.
- Audit/privacy records must use the existing `audit_logs` schema only: `action`, `entity_type`, `entity_id`, `previous_status`, `new_status`, `actor_id`, `actor_role`, `reason`, and `metadata`. Store the deletion request id as `entity_id` when `entity_type = 'ACCOUNT_DELETION_REQUEST'` or in `metadata.deletionRequestId` when the entity is the user; store the affected user id in `entity_id` only when `entity_type = 'USER'` or in minimal metadata. Do not invent `request_id` or `user_id` columns.
- Provider/storage cleanup failures must be categorized without leaking provider payloads.

## Alternatives Considered

1. Complete deletion synchronously inside `POST /users/me/deletion-request`: rejected because controlled processing, rollback proof, monitoring, provider/object cleanup, and retention exceptions need a dedicated job.
2. Hard-delete the `users` row: rejected because foreign keys, audit/fraud/legal retention, and account status enforcement require a tombstone row.
3. Only set `users.status = DELETED` without anonymizing PII: rejected because `BR-PRIV-007` requires deletion or anonymization of PII.
4. Defer all Cognito and S3/media cleanup to later stories while marking this story complete: rejected because Cognito/provider identity and TrustBite-owned profile avatar, receipt/media, or claim-evidence objects can contain account PII; this story must either clean them or explicitly remain blocked/partial.
