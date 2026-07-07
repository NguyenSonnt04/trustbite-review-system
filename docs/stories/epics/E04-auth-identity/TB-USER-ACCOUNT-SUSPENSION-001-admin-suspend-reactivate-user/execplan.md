# Exec Plan

## Goal

Complete the backend proof for the external Phase 2 sheet task `2.4 API: Trạng thái tài khoản — khóa/mở khóa và yêu cầu xóa tài khoản` while preserving the product distinction between:

1. **User self account deletion request**: the authenticated user requests account/data deletion through the privacy workflow.
2. **Admin account suspension/reactivation**: an `ADMIN` or `SUPER_ADMIN` locks/unlocks another user account for safety/moderation reasons.

The implementation goal for this story is the second branch: admin suspension/reactivation. The first branch is already covered by `TB-PRIVACY-DELETION-001-account-lock-deletion` and must remain a separate privacy/data-retention workflow.

## External Sheet Task Mapping

The Google Sheet row `2.4 API: Khóa tài khoản` is treated as an umbrella task in Harness:

| Sheet scope | Harness story | Current implementation scope |
| --- | --- | --- |
| User self deletion request | `TB-PRIVACY-DELETION-001-account-lock-deletion` | Already implemented as authenticated backend deletion-request lifecycle. Re-check only if validation evidence must be refreshed. |
| Admin/Super Admin suspend/reactivate | `TB-USER-ACCOUNT-SUSPENSION-001-admin-suspend-reactivate-user` | This story. Code exists; missing completion proof is the current work. |
| Mobile in-app deletion entrypoint | `TB-MOBILE-ACCOUNT-DELETION-001` / sheet `2.6` | Out of scope for this backend API story. |
| Retention/anonymization processing job | `TB-PRIVACY-RETENTION-JOB-001` / sheet `6.5` | Out of scope for this admin suspension story. |
| Public account deletion URL/form | `TB-PRIVACY-WEB-DELETION-001` / sheet `8.4` | Out of scope for this admin suspension story. |

## Scope

In scope for `TB-USER-ACCOUNT-SUSPENSION-001`:

- `POST /api/v1/admin/users/{userId}/suspend`.
- `POST /api/v1/admin/users/{userId}/reactivate`.
- `users.status` transitions between `ACTIVE` and `SUSPENDED`.
- Admin authorization using TrustBite-local `user_roles` as product-role source of truth.
- `ADMIN` vs `SUPER_ADMIN` tier checks.
- Rejection of non-admin actors and Cognito-group-only role escalation.
- Reason validation for admin state changes.
- Audit log entries with actor, actor role, target user, previous status, new status, and reason.
- Local product session revocation and push-token inactivation when suspending a user.
- Auth middleware/service behavior that rejects suspended users from protected mutations even when the Cognito-compatible token/identity is otherwise valid.
- Automated unit/integration proof sufficient to move the Harness row from `in_progress` to implemented if all validation passes.

Out of scope for this story:

- User self account deletion request implementation; already covered by `TB-PRIVACY-DELETION-001`.
- Deletion/anonymization processor, provider cleanup, object storage cleanup, or final `users.status = DELETED` completion; covered by `TB-PRIVACY-RETENTION-JOB-001`.
- Public web deletion form/API; covered by `TB-PRIVACY-WEB-DELETION-001`.
- Mobile account-settings Delete Account UI; covered by `TB-MOBILE-ACCOUNT-DELETION-001` / sheet `2.6`.
- User-to-user block/unblock; covered by UGC safety work and `user_blocks`.
- Review-only restriction behavior beyond preserving `users.review_restricted_until` semantics.
- New user status values such as `DELETION_REQUESTED`; the accepted schema allows only `ACTIVE`, `SUSPENDED`, and `DELETED` for `users.status`.
- Backend-issued auth/token/session ownership; Cognito remains the auth/token source of truth.
- Admin web UI/user-management screen; sheet `2.7`.
- Schema migration, unless validation discovers the current schema cannot represent the accepted behavior.

## Risk Classification

Lane: **high-risk**.

Risk flags:

- Auth: suspended/deleted users must be rejected after Cognito JWT verification.
- Authorization: only TrustBite-local `ADMIN`/`SUPER_ADMIN` roles can suspend/reactivate.
- Data model: writes `users.status`, `audit_logs`, `user_sessions`, and `push_tokens`.
- Audit/security: admin decisions require durable audit evidence and must not leak token/session values.
- Public contracts: admin APIs are externally callable backend contracts.
- Existing behavior: `/users/me` profile mutation and deletion-request guards must keep working.
- Weak proof: Harness row is still `in_progress`; completion depends on automated proof.

Hard gates:

- Auth.
- Authorization.
- Audit/security.
- Data-affecting writes.

## Source Of Truth

Read and preserve these contracts before implementation claims:

- `docs/decisions/0009-user-account-suspension-contract.md`
- `docs/decisions/0010-cognito-first-auth-boundary.md`
- `docs/decisions/0011-auth-provider-adapter-boundary.md`
- `docs/decisions/0012-admin-roles-source-of-truth.md`
- `docs/product/authentication.md`
- `docs/product/provider-integrations.md`
- `trustbite-docs/02_Business_Analysis/Business_Rules.md`
- `trustbite-docs/02_Business_Analysis/Role_Permission_Matrix.md`
- `trustbite-docs/02_Business_Analysis/State_Machines.md`
- `trustbite-docs/02_Business_Analysis/Status_Mapping.md`
- `docs/stories/epics/E04-auth-identity/TB-PRIVACY-DELETION-001-account-lock-deletion/`
- `docs/stories/epics/E04-auth-identity/TB-USER-ACCOUNT-SUSPENSION-001-admin-suspend-reactivate-user/`
- `server/migrations/` as schema source of truth for table/column names and constraints.

## Current Code Surface To Inspect

Primary files:

- `server/src/routes/admin.js`
- `server/src/controllers/adminUser.js`
- `server/src/services/userService.js`
- `server/src/middlewares/auth.js`
- `server/src/services/auth.js`
- `server/src/services/identityProviders/cognitoProvider.js`

Adjacent proof/test files:

- `server/tests/helpers/**`
- `server/tests/unit/user/userService.test.js`
- `server/tests/unit/auth/authService.test.js`
- `server/tests/integration/userProfile.integration.test.js`
- `server/tests/integration/userDeletionRequest.integration.test.js`

Expected new or updated test file:

- `server/tests/integration/adminUserSuspension.integration.test.js`

## Accepted Behavior

### Suspend success

Given:

- Actor is authenticated.
- Actor has TrustBite-local `ADMIN` or `SUPER_ADMIN` role from `user_roles`.
- Target exists and has `users.status = ACTIVE`.
- Actor is allowed to target the account by role tier.
- Reason is a string with at least 10 trimmed characters.

When:

- Actor calls `POST /api/v1/admin/users/{userId}/suspend`.

Then:

- Response succeeds.
- Target `users.status` becomes `SUSPENDED`.
- Active local `user_sessions.revoked_at` is set.
- Active `push_tokens.status` becomes `INACTIVE` where applicable.
- `audit_logs` contains a `USER_SUSPEND` row with actor, actor role, target user id, previous status, new status, and reason.
- Response returns target user id, status, revoked local session count, and audit log id.
- A later protected mutation by the suspended user fails with `ACCOUNT_SUSPENDED` even if the request identity/token is otherwise accepted.

### Reactivate success

Given:

- Actor is authenticated.
- Actor has TrustBite-local `ADMIN` or `SUPER_ADMIN` role from `user_roles`.
- Target exists and has `users.status = SUSPENDED`.
- Actor is allowed to target the account by role tier.
- Reason is a string with at least 10 trimmed characters.

When:

- Actor calls `POST /api/v1/admin/users/{userId}/reactivate`.

Then:

- Response succeeds.
- Target `users.status` becomes `ACTIVE`.
- `audit_logs` contains a `USER_REACTIVATE` row with actor, actor role, target user id, previous status, new status, and reason.
- Previously revoked local sessions are not restored.
- Deleted users are never reactivated by this flow.

### Authorization rules

- Non-admin users cannot suspend/reactivate.
- Cognito groups alone do not grant product admin permissions.
- TrustBite-local `user_roles` is the source of truth for `ADMIN` and `SUPER_ADMIN`.
- `SUPER_ADMIN` can target ordinary users and admins unless a stricter future decision changes the hierarchy.
- `ADMIN` cannot target `SUPER_ADMIN`; return `403 INSUFFICIENT_ADMIN_TIER`.
- Admin tier check must run before target status-specific errors where required to avoid leaking protected target account state.

### Business rejection rules

Suspend rejects:

- Missing/invalid `userId` path parameter with validation error.
- Missing/non-admin actor with `FORBIDDEN`.
- `ADMIN` targeting `SUPER_ADMIN` with `INSUFFICIENT_ADMIN_TIER`.
- `DELETED` target with `CANNOT_SUSPEND_DELETED_USER` for actors allowed to see target status.
- Actor suspending own account with `CANNOT_SUSPEND_SELF`.
- Already `SUSPENDED` target with `USER_ALREADY_SUSPENDED`.
- Missing/short reason with `ADMIN_REASON_REQUIRED` after account-context checks for authorized actors.

Reactivate rejects:

- Missing/invalid `userId` path parameter with validation error.
- Missing/non-admin actor with `FORBIDDEN`.
- `ADMIN` targeting `SUPER_ADMIN` with `INSUFFICIENT_ADMIN_TIER`.
- `DELETED` target with `CANNOT_REACTIVATE_DELETED_USER` for actors allowed to see target status.
- Actor reactivating own account with `CANNOT_REACTIVATE_SELF`.
- Target not `SUSPENDED` with `USER_NOT_SUSPENDED`.
- Missing/short reason with `ADMIN_REASON_REQUIRED` after account-context checks for authorized actors.

## Work Phases

### Phase 1 — Reconfirm scope and schema

1. Confirm Harness matrix row state for `TB-USER-ACCOUNT-SUSPENSION-001` and `TB-PRIVACY-DELETION-001`.
2. Confirm current migrations contain the required columns/tables:
   - `users.id`, `users.status`, `users.cognito_sub`, `users.deletion_requested_at`, `users.deleted_at`.
   - `roles`, `user_roles`.
   - `audit_logs.actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `previous_status`, `new_status`, `reason`, `metadata`.
   - `user_sessions.revoked_at`.
   - `push_tokens.status`.
3. Do not add new columns or enum values unless a blocker proves current schema cannot satisfy the accepted contract.

### Phase 2 — Write failing proof first where practical

1. Add route-level integration tests for admin suspend/reactivate.
2. Prefer deterministic DB fixtures inside tests with cleanup/rollback patterns already used by existing integration tests.
3. Cover the positive and negative cases from this exec plan and `validation.md`.
4. Reuse existing trusted local auth test helper only as an explicit non-production test path; do not make it production behavior.
5. Include a specific test proving Cognito/provider groups alone do not authorize admin actions when `user_roles` lacks `ADMIN`/`SUPER_ADMIN`.

### Phase 3 — Make the smallest code changes if tests expose gaps

1. Keep route/controller logic thin.
2. Keep state transitions and DB writes inside `UserService` transactions.
3. Preserve the validation order documented in `design.md` and this exec plan.
4. Preserve Cognito-first auth boundary and `user_roles` source of truth.
5. Do not broaden self-deletion behavior, deletion processing, or mobile/web UI in this story.

### Phase 4 — Verify DB side effects

1. Confirm suspend updates only the intended target row.
2. Confirm session revocation and push-token inactivation are idempotent enough for repeated/partial local state.
3. Confirm audit rows contain required status/reason fields and do not contain token/session secrets.
4. Confirm reactivate does not clear audit history and does not restore revoked sessions.
5. Confirm all test-created rows are cleaned up or wrapped so local database residue is not left behind.

### Phase 5 — Validation commands

Run the smallest relevant commands first, then the broader server proof:

```text
npm run test:unit --prefix server -- tests/unit/user/userService.test.js
npm run test:integration --prefix server -- tests/integration/adminUserSuspension.integration.test.js
npm run test --prefix server
npm run server:build
npm run db:migrate
git diff --check
npm run harness -- query matrix
```

If local PostgreSQL or another dependency is unavailable, document the blocker in `validation.md` and do not claim integration or DB proof.

### Phase 6 — Update story and Harness records

If validation passes:

1. Update `validation.md` with exact commands, dates, and pass/fail evidence.
2. Update the Harness durable row for `TB-USER-ACCOUNT-SUSPENSION-001`:

```text
npm run harness -- story update --id TB-USER-ACCOUNT-SUSPENSION-001 --status implemented --unit 1 --integration 1 --e2e 0 --platform 0
```

3. Keep `e2e` as `0` unless a real API smoke through an accepted Cognito-compatible environment is run.
4. Record a Harness trace with changed files, validation commands, outcome, decisions, and any friction.
5. Leave `TB-PRIVACY-DELETION-001` evidence unchanged unless revalidated during this task.

## Test Plan Detail

### Unit tests

Target: `server/tests/unit/user/userService.test.js`.

Cases:

- `suspendUser` validates actor has admin role.
- `reactivateUser` validates actor has admin role.
- `ADMIN` cannot target `SUPER_ADMIN`.
- `SUPER_ADMIN` can target lower-tier users.
- Suspend rejects deleted target before self/already-suspended/reason for authorized actors.
- Suspend rejects self before already-suspended/reason for authorized actors.
- Suspend rejects already suspended target before reason for authorized actors.
- Reactivate rejects deleted target before self/not-suspended/reason for authorized actors.
- Reactivate rejects self before not-suspended/reason for authorized actors.
- Reactivate rejects non-suspended target before reason for authorized actors.
- Reason shorter than 10 trimmed characters returns `ADMIN_REASON_REQUIRED` only after account-context checks.

### Integration tests

Target: `server/tests/integration/adminUserSuspension.integration.test.js`.

Cases:

1. `ADMIN` from local `user_roles` suspends active user:
   - response success;
   - user status becomes `SUSPENDED`;
   - active local session row gets `revoked_at`;
   - active push token becomes `INACTIVE`;
   - audit row exists with `USER_SUSPEND`, previous/new status, actor role, reason.

2. Suspended user cannot mutate profile:
   - call `PATCH /api/v1/users/me` as suspended target;
   - expect `ACCOUNT_SUSPENDED`.

3. `ADMIN` reactivates suspended user:
   - response success;
   - user status becomes `ACTIVE`;
   - audit row exists with `USER_REACTIVATE`;
   - previously revoked session remains revoked.

4. Non-admin user cannot suspend/reactivate:
   - expect `403 FORBIDDEN`.

5. Cognito/provider group claim alone cannot authorize admin action:
   - request identity contains provider groups/admin-like diagnostics but no TrustBite-local `user_roles` admin row;
   - expect `403 FORBIDDEN`.

6. `ADMIN` cannot suspend/reactivate `SUPER_ADMIN` target:
   - expect `403 INSUFFICIENT_ADMIN_TIER`.

7. Deleted target cannot be suspended/reactivated by authorized actor:
   - expect `CANNOT_SUSPEND_DELETED_USER` / `CANNOT_REACTIVATE_DELETED_USER`.

8. Self-targeting is rejected:
   - expect `CANNOT_SUSPEND_SELF` / `CANNOT_REACTIVATE_SELF`.

9. Invalid/missing reason is rejected for otherwise valid actor/target context:
   - expect `ADMIN_REASON_REQUIRED`.

## Data And Cleanup Strategy

- Use UUID test fixtures and unique phone numbers to avoid collisions.
- Insert roles needed by tests only if not already present, respecting current schema constraints.
- Delete test-created rows in reverse dependency order or wrap each scenario in cleanup helpers.
- Do not use production secrets or real Cognito credentials in tests.
- Do not log tokens, raw session hashes, push token ciphertext, or full sensitive identity values.

## Completion Criteria

This story can be marked implemented only when:

- Admin suspend/reactivate APIs have automated unit and integration proof.
- TrustBite-local `user_roles` is proven as the product-role source of truth.
- Cognito groups alone are proven insufficient for admin authorization.
- Suspend writes audit evidence and invalidates local session/push-token state.
- Suspended users are rejected from protected profile mutation with otherwise accepted auth identity.
- Reactivation restores only `users.status = ACTIVE` and does not restore revoked sessions.
- `npm run test --prefix server`, `npm run server:build`, and `npm run db:migrate` pass or blockers are documented.
- `validation.md`, Harness story row, and trace evidence are updated.

## Stop Conditions

Pause for human confirmation if:

- The team wants user self-deletion to set `users.status = SUSPENDED` or to be handled through admin suspension.
- The team wants a new user status such as `DELETION_REQUESTED`.
- Admin role hierarchy beyond `ADMIN` and `SUPER_ADMIN` is required.
- Deleted user reactivation is requested.
- Cognito group-to-TrustBite-role synchronization is requested.
- A schema migration is needed for role hierarchy, audit evidence, session invalidation, or provider cleanup.
- Validation requirements must be weakened due to missing test runner, missing DB, or unavailable Cognito-compatible proof.
- Any implementation would mix account deletion/data retention with reversible suspension/reactivation.
