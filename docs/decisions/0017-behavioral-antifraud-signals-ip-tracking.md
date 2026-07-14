# 0017 Behavioral anti-fraud signals derived server-side; MVP IP tracking, no fingerprint SDK

Date: 2026-07-10

## Status

Accepted

## Context

The receipt verification scoring engine (`receiptVerificationScoring.js`, Decision
0014) already defines point values for three behavioral/velocity/device signals
(new-account first review `+15`, `>=3` rejected receipts in 7 days `+40`,
multi-account same-device/IP `+50`), but the `verifyReceipt` orchestrator passed
all three as hardcoded `false`. Story TB-FRAUD-005 needs them derived from
persisted data.

Two of the three signals are computable from the existing schema
(`users.created_at`, `reviews`, `receipt_verifications.status/created_at`). The
multi-account signal needs a per-upload device/IP identifier, which no table
carries. Anti-Fraud Specification §9 places full device fingerprinting in V1.1
(pending legal basis, explicit consent, and short retention) while listing basic
IP/User-Agent tracking as acceptable for MVP.

## Decision

- Derive `newAccountFirstReview` and `manyRejectedReceipts` inside `verifyReceipt`
  from persisted data, with the windows/thresholds added as frozen constants in
  `fraudRules.js` (24h new-account window; 7-day / 3-count rejected window).
- Implement the multi-account signal as an **IP-based MVP signal**: capture the
  caller IP (`req.ip`) at receipt upload into a new nullable
  `receipt_verifications.request_ip` (`INET`) column, and flag when another
  account uploaded from the same IP for the same restaurant within 24h.
- Do **not** add a device-fingerprint table or client fingerprint SDK. Treat
  `request_ip` as PII: nullable, excluded from API responses (`toJSON`).

## Alternatives Considered

1. Full device fingerprint SDK + fingerprint table now — rejected: spec §9
   defers it to V1.1 pending legal/consent/retention approval.
2. Leave `multiAccountSameDevice` as `false` and ship only the two schema-safe
   signals — rejected: the MVP IP signal is explicitly in scope for TB-FRAUD-005
   and is cheaply supported by one nullable column.
3. Compute "first review" as `COUNT(*) = 1` — rejected in favor of an
   earlier-review existence check on `created_at` (correct when a user created
   multiple reviews before uploading a receipt).

## Consequences

Positive:

- Behavioral/velocity/device rules now affect the automated decision and audit
  trail, not just the (previously dormant) scoring table.
- The IP signal adds one nullable column and a partial index, keeping the
  data-model and privacy surface minimal.

Tradeoffs:

- IP is a coarse device proxy (shared NAT/CGNAT can co-locate distinct users);
  it is a `+50` risk contribution, not a hard reject, which limits false-positive
  blast radius.
- Introduces a new PII field (`request_ip`) subject to the data-retention policy.

## Follow-Up

- Run live `npm run db:migrate` + transaction/rollback proof for migration `007`
  when local PostgreSQL is available (blocked at authoring time: Docker down).
- Separate slice: enforce daily hard rate limits (BR-RATE-003 10 reviews/day,
  BR-RATE-004 20 receipts/day, 5/day with an open fraud flag).
- Revisit full device fingerprinting only after a legal-basis/consent/retention
  decision (spec §9, V1.1).
