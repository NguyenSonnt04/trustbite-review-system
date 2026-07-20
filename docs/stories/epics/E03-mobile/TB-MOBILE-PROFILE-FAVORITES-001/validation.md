# Validation

## Proof Strategy

Prove request parsing and repository mapping with focused tests, then run the
full server and Flutter suites plus syntax/analyze checks. Database proof must
show favorite insert/remove inside a rollback transaction with no residue.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Flutter API mapping, gamification parsing, avatar PUT sequence, report/block/deletion requests |
| Integration | Favorite ownership/idempotency/concurrent first save, rejected-write rollback with no residue, public review-author block and source-review unblock after visibility changes |
| E2E | Widget navigation, favorite empty/saved states, profile actions, deletion-load failure |
| Platform | Flutter analyze, full mobile tests, and Android debug APK |
| Performance | No dedicated benchmark; favorite mutations update loaded mobile state without refetching discovery |
| Logs/Audit | Confirm no signed URL, deletion reason, phone, or internal reviewer ID is emitted |

## Fixtures

- Two active users.
- One public and one private/non-public review.
- Active and deleted restaurants.
- Empty and populated private Favorites lists.

## Commands

```text
npm run server:test
npm run server:build
npm run db:migrate
npm run mobile:test
cd mobile; flutter analyze
```

## Acceptance Evidence

- `npm run db:migrate` passed against local PostgreSQL; all migrations were
  already applied.
- `npm run server:test` passed: 76 files passed, 2 provider files skipped;
  642 tests passed, 4 LocalStack provider tests skipped.
- Focused review-author block proof passed 17/17 unit and PostgreSQL integration
  tests, including unblock after the source review becomes private.
- `npm run server:build` passed syntax validation for 144 files.
- `npm run mobile:test` passed all 84 Flutter tests.
- `cd mobile; flutter analyze` passed with no issues.
- `cd mobile; flutter build apk --debug` produced
  `mobile/build/app/outputs/flutter-apk/app-debug.apk`.
- `git diff --check` passed.
- Automated STRIDE report generation was not run because this isolated
  worktree has no `.factory/threat-model.md` or security configuration.
