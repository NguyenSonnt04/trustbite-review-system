# Validation

## Proof Strategy

Prove the admin route boundary, strict request validation, local-role
authorization, transactional persistence and auditing, BFF allowlisting, and
responsive client compilation.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Admin route forwarding, invalid UUID rejection, BFF/session denial |
| Integration | Admin and super-admin success, user denial, active/archived listing, create/update validation, cross-restaurant rejection, audit records, rollback |
| E2E | Admin restaurant modal lists, creates, edits, archives, and reactivates items |
| Platform | Desktop and narrow browser layouts |
| Performance | Bounded menu query ordered by status, name, and ID |
| Logs/Audit | One transactional audit row per successful mutation |

## Fixtures

- Active local `ADMIN`, `SUPER_ADMIN`, and `USER` records.
- Non-deleted draft restaurant.
- Active and archived menu items.

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

- `npm run db:migrate`: passed with 0 pending migrations; the existing
  `menu_items` and `audit_logs` schema was used without alteration.
- Focused admin menu route tests: 7 passed.
- Focused admin restaurant integration tests: 14 passed, including admin and
  super-admin menu operations, user denial, validation, cross-restaurant
  rejection, persistence, transactional audits, and cleanup without residue.
- `npm run server:test:unit`: 56 files and 519 tests passed.
- `npm run server:test:integration`: 29 files and 203 tests passed; 4 opt-in
  provider tests skipped.
- `npm run server:build`: syntax check passed for 154 files.
- `npm run lint --prefix client`: passed.
- `npm run client:build`: passed, including the dynamic admin restaurant BFF
  route and responsive menu workspace.
- Harness story verification passed with the full unit, integration, syntax,
  lint, and client build command.
- Browser E2E and screenshot proof were not run in this session.
