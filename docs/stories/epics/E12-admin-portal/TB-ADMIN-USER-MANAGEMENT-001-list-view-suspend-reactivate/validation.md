# Validation

## Proof Strategy

Prove the admin session boundary, provider/local consistency, authorization tiers, audit evidence, deterministic reads, responsive UI states, and absence of a delete action.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Query/body validation, contact masking, provider create/error mapping, session validation, role-tier rules, self-role guard, final-super-admin guard, provider compensation. |
| Integration | List/detail pagination and filters, Cognito-backed create with local mapping, duplicate phone rollback, profile update, role audit, suspend/reactivate regression, transaction rollback/no residue. |
| E2E | Admin login, user list/search/filter, create, edit, role visibility by actor, suspend/reactivate confirmation, no delete action. |
| Platform | Desktop and narrow responsive admin layout. |
| Performance | Bounded page size and indexed/deterministic query shape; no provider call per list row. |
| Logs/Audit | `USER_CREATE`, `USER_PROFILE_UPDATE`, `USER_ROLES_UPDATE`, `USER_SUSPEND`, and `USER_REACTIVATE` evidence without raw email/token/session data. |

## Fixtures

- Active ordinary user.
- Suspended ordinary user.
- `ADMIN` actor.
- `SUPER_ADMIN` actor.
- `SUPER_ADMIN` target.
- Last active `SUPER_ADMIN`.
- Cognito create success, duplicate identity, unavailable provider, and compensation responses.

## Commands

```text
npm run db:migrate
npm run server:test:unit
npm run server:test:integration
npm run server:build
npm run lint --prefix client
npm run client:build
git diff --check
```

## Acceptance Evidence

- `npm run db:migrate` passed and applied `009_seed_canonical_user_roles.sql`.
- `npm run harness -- story verify TB-ADMIN-USER-MANAGEMENT-001` passed on 2026-07-15:
  - 379 unit tests passed.
  - 136 integration tests passed; 4 opt-in LocalStack provider tests were skipped.
  - Server syntax passed for 127 files.
  - Client ESLint passed.
  - Next.js production build passed, including `/admin` and `/api/admin/users/[[...segments]]`.
- Focused admin-user tests passed for BFF session enforcement, Cognito confirmed-user provisioning, database connection/rollback compensation, masked-phone search, empty-page totals, role authorization, audit writes, and rollback residue.
- Browser smoke passed against a local mock API for the list, filters, masked contacts, create dialog, detail/edit dialog, no-delete behavior, and the 390x844 responsive layout with no observed browser errors.
