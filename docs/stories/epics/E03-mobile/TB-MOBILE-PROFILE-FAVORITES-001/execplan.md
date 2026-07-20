# Exec Plan

## Goal

Replace placeholder mobile favorites/profile behavior with authenticated,
backend-owned workflows.

## Scope

In scope:

- Default private Favorites list API and Flutter integration.
- Profile field and avatar update UI.
- Gamification summary UI.
- Contextual review/restaurant report UI.
- Review-author block/unblock without exposing user IDs.
- Account deletion request/status/cancel UI.

Out of scope:

- New database columns or migrations.
- Public or multiple saved-list management.
- Blocked-user directory.

## Risk Classification

Risk flags:

- Auth and authorization.
- Data model usage and deletion workflow.
- Audit/security and public API contracts.
- Existing cross-platform behavior.
- Multi-domain change.

Hard gates:

- Authorization, privacy, and account deletion.

## Work Phases

1. Confirm existing backend and schema contracts.
2. Add failing service/widget/integration tests.
3. Implement scoped APIs and Flutter repositories.
4. Wire Favorites, Profile, and contextual safety UI.
5. Run server, database, and Flutter validators.
6. Update Harness evidence and trace.

## Stop Conditions

Pause if a migration becomes necessary, reviewer identity must be exposed, or
deletion retention rules need to change.
