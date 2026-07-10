# Validation

## Proof Strategy

TDD-style unit proof with a mocked `pool` (matching the other service tests). The
pure `resolveRank` is proven against the Gamification_Design §3 ladder including
the dual EXP+verified-review conditions; the read service is proven for the DTO
shape and the not-found/suspended/deleted paths.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit — calculator | `resolveRank`: new user (0/0) → NEWBIE, next APPRENTICE (100/2); below EXP threshold stays NEWBIE; EXP+verified both met → APPRENTICE; EXP met but verified unmet → stays NEWBIE (verifiedReviewsToNext shown); higher EXP but insufficient verified caps at APPRENTICE (expToNext 0, verifiedReviewsToNext 7); TRUSTED_FOODIE → next null; very high values stay top; non-finite inputs → 0. |
| Unit — service | Points/level/next-level/badges DTO for an APPRENTICE user; brand-new user → NEWBIE, empty badges; `404 USER_NOT_FOUND`; `403 ACCOUNT_SUSPENDED`; `403 ACCOUNT_DELETED`; badge row → camelCase mapping. |
| Integration | Deferred: no schema change; live route+DB proof needs local PostgreSQL. |
| E2E / Platform | Not applicable — no UI/provider surface. |
| Logs/Audit | None (read-only). |

## Commands

```text
npx vitest run tests/unit/gamification/
npm run test:unit --prefix server
npm run server:build
```

## Acceptance Evidence

Validated 2026-07-10:

- `npx vitest run tests/unit/gamification/` — 2 files / 13 tests passed.
- `npm run test:unit` — 25 files / 264 tests passed (was 251; +13).
- `npm run server:build` — syntax check passed for 110 files.

## DB Proof (blocker)

No migration is introduced (all columns exist). Live route + DB proof
(auth-mapped user, seeded reviews/badges, `GET /users/me/gamification` asserting
the computed level/progress/badges) was not run because local Docker/PostgreSQL
was unavailable. Logic is proven via mocked-pool unit tests; live/integration
proof remains outstanding.
