# Exec Plan

## Goal

Expose the authenticated user's gamification summary (points, derived level +
progress, badges) through a backend-owned read API, with the EXP/rank rules as
reusable domain logic.

## Scope

In scope:

- `gamificationRules.js` (EXP values + rank ladder constants, §2/§3).
- Pure `resolveRank` (current level + next-level progress).
- `getUserGamification` read service + `GET /users/me/gamification` (auth).
- Unit proof (ladder boundaries + service read/validation).

Out of scope (follow-up):

- EXP awarding writes + `rank_code` persistence, wired into review/verification.
- Badge award triggers (badges are P1/future).
- Helpful-vote EXP (P1), leaderboards, EXP history endpoint.
- Schema migration, rank_definitions seeding, client/UI.

## Risk Classification

Risk flags: Public contract (new API route), Data model read (multi-table),
Multi-domain (users + reviews + badges). No auth change (reuses `authMiddleware`),
no migration.

Hard gate: public API shape → high-risk lane; kept read-only and additive.

## Work Phases

1. Discovery — Gamification_Design §2/§3, schema, user route/controller pattern.
2. Design — ladder rules, resolveRank, read DTO + route.
3. Validation planning — pure ladder cases + service cases.
4. Implementation — config, calculator, service, controller, route, tests.
5. Verification — `npm run test:unit`, `npm run server:build`.
6. Harness update — decision, story add/update, product/matrix docs.

## Stop Conditions

Paused/narrowed for:

- EXP awarding deferred to avoid wiring into tested review/verification paths in
  this slice; level is derived from persisted data so it is correct without a
  writer.
- Live DB proof deferred (no schema change; local Docker unavailable).
