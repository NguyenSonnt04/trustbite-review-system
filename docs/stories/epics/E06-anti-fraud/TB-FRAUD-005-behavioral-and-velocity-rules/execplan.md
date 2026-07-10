# Exec Plan

## Goal

Make the receipt verification decision engine derive and score the behavioral,
velocity, and device anti-fraud signals from persisted data, closing the gap
where the orchestrator passed `newAccountFirstReview`, `manyRejectedReceipts`,
and `multiAccountSameDevice` as hardcoded `false`.

## Scope

In scope (this slice):

- Behavioral signal derivation inside `verifyReceipt` (Anti-Fraud §4.1):
  - account created < 24h ago AND first review → `+15`,
  - `>= 3` REJECTED receipts in the trailing 7 days → `+40`,
  - another account uploading from the same request IP for the same restaurant
    within 24h → `+50` (MVP IP-based device signal, spec §9).
- New `request_ip INET` column on `receipt_verifications` (migration `007`) plus a
  supporting partial index, captured at upload from `req.ip`.
- Behavioral thresholds/windows added to `fraudRules.js` (Decision 0014 pattern).
- Unit proof (positive + negative paths) for each signal.

Out of scope (tracked as follow-up, see overview Deferred):

- Daily hard rate limits at review creation (10/day) and receipt upload (20/day,
  5/day with open fraud flag) — BR-RATE-003/004. Separable slice; the velocity
  *signal* (`manyRejectedReceipts`) ships here, the hard caps do not.
- Full client/mobile device fingerprint SDK or persisted fingerprint table.
- EXIF/AI edited-metadata detection.
- Admin moderation UI and new public API endpoints.
- Redis-backed rate limiting.

## Risk Classification

Risk flags: Data model (new column + index), Audit/security (fraud signals +
PII IP), Existing behavior (verification decision), Multi-domain (receipt + user
+ review). Anti-fraud rule change.

Hard gates: Data model change; audit/security. → High-risk lane.

## Work Phases

1. Discovery — read Anti-Fraud spec §4.1/§7/§9, Business_Rules §5/§9, schema,
   existing scoring + orchestrator + tests.
2. Design — signal derivation queries, IP column, thresholds.
3. Validation planning — unit cases per signal (positive + negative).
4. Implementation — config, migration, model, orchestrator, IP capture, tests.
5. Verification — `npm run test:unit`, `npm run server:build`.
6. Harness update — decision record, story add/update, product doc.

## Stop Conditions

Paused/narrowed for:

- Device fingerprint: schema has no fingerprint/IP column and spec §9 defers a
  full fingerprint SDK to V1.1. Implemented the MVP IP-signal only (single
  nullable `request_ip` column, no fingerprint table).
- Live DB proof: local Docker/PostgreSQL was unavailable during implementation,
  so migration `007` has no live apply/rollback proof yet (documented blocker in
  validation.md). Logic is proven via mocked-pool unit tests.
