# Exec Plan

## Goal

Deliver the backend block/unblock user vertical slice (task 6.2, PHASE 6 —
Moderation & Compliance) satisfying SAFETY-001 / BR-SAFE-003 without changing
the account-suspension model.

## Scope

In scope:

- `userBlockService` with `blockUser` and `unblockUser`.
- Controller handlers and routes for `POST`/`DELETE /users/{userId}/block`.
- Boundary validation and negative/abuse-path unit tests.

Out of scope:

- Report/moderation queue (task 6.1).
- Feed/read-path filtering of blocked users' content.
- Mobile/admin UI.
- Any schema change.

## Risk Classification

Risk flags:

- Authorization (user-to-user relationship, actor state).
- Public contracts (two new API endpoints).
- Persistence (writes to `user_blocks`).

Hard gates:

- Authorization → high-risk.
- Public contract → at least normal; combined with authorization → high-risk.

Data model is NOT a gate here: table/columns/constraints already exist; no
migration is introduced.

## Work Phases

1. Discovery — read README, intake, architecture, context rules, API spec,
   business rules, schema, model, and existing user slice. (done)
2. Design — document flow, contract, and reactivation rule. (done)
3. Validation planning — unit tests for happy path, self-block, invalid UUID,
   not-found, already-blocked, reactivation, unblock, unblock-not-found,
   and DB-error mapping.
4. Implementation — service, controller, route.
5. Verification — `server:test:unit`, `server:build`; live DB proof if Docker up.
6. Harness update — story record + matrix.

## Stop Conditions

Pause for human confirmation if:

- A schema/column beyond `user_blocks` is needed.
- Feed filtering or content hiding is requested (changes read contracts).
- Block is asked to modify account status (would collide with BR-ADM-006).
