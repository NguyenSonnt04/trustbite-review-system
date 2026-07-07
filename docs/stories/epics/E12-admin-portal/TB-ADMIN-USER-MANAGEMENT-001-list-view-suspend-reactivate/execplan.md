# Exec Plan

## Goal

Complete the Phase 2 Web Admin user-management slice for listing/viewing users and suspending/reactivating accounts through existing audited backend APIs.

## Scope

In scope:

- Confirm admin web app boundary in this repo.
- Admin user list and user detail UI with masked data.
- Status/search/filter/pagination UI if backend supports it; otherwise define backend dependency before UI implementation.
- Suspend/reactivate actions with required reason, confirmation, side-effect preview, loading/error/success states.
- Auth/authorization error handling for admin actors.
- Client build/lint and route/component tests where practical.

Out of scope:

- Backend suspend/reactivate rule changes unless a blocker is found.
- New role/permission model.
- Admin dashboard, receipt queue, moderation queue, claim queue, or audit viewer beyond user status context.
- Account deletion processor or privacy support workflows.

## Risk Classification

Risk flags:

- Auth.
- Authorization.
- Audit/security.
- Public/admin UI behavior.
- Existing backend behavior.
- Weak proof if admin list/detail API is missing.

Hard gates:

- Auth.
- Authorization.
- Audit/security.
- Removing or weakening validation requirements.

## Work Phases

1. Confirm whether `client/` is the admin portal target or whether a separate admin Next.js app must be created first.
2. Discover existing admin user list/detail APIs. If absent, stop and create/link a backend API story for admin user listing/detail instead of mocking production UI.
3. Add tests for API client/admin action mapping and UI validation where practical.
4. Implement admin user list/detail screen(s), reason forms, error mapping, and action refresh.
5. Prove backend suspend/reactivate integration remains covered or rerun targeted backend tests if code touched shared contracts.
6. Run client build/lint and any added tests.
7. Update Harness matrix/story evidence and trace.

## Stop Conditions

Pause for human confirmation if:

- Admin portal app boundary is ambiguous.
- No backend user list/detail endpoint exists and implementing one would expand scope.
- UI needs to display sensitive identifiers not allowed by product/security docs.
- Authorization behavior differs from decisions `0009` or `0012`.
- Implementation would weaken reason/audit requirements.
