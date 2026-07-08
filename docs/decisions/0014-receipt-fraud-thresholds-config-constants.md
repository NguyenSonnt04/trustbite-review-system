# 0014 Receipt fraud thresholds in config constants, DB-backed later

Date: 2026-06-12

## Status

Accepted

## Context

Task 4.4 (receipt verification service) needs numeric thresholds for the
Anti-Fraud scoring engine: GPS near-radius (200m), GPS accuracy max (100m), the
1-hour near window, the 5-minute `capturedAt` skew tolerance, merchant-match
bands (80% / 60%), receipt-age bands (48h / 168h), and the decision buckets
(0–30 / 31–60 / 61–99 / ≥100). The schema already contains a `fraud_rule_configs`
table intended for DB-tunable rules. The question is whether thresholds should be
seeded into that table now (DB source of truth, tunable without redeploy) or
shipped as code constants.

## Decision

Ship thresholds as frozen constants in `server/src/config/fraudRules.js`, exposed
through a single accessor `getFraudRules()`. Domain scoring functions receive the
rules object as a parameter and never read env or the DB directly. A future
story may replace the accessor's body with a `fraud_rule_configs`-backed loader
without changing any call site.

## Alternatives Considered

1. Seed `fraud_rule_configs` now: rejected for this slice. It adds a migration +
   rollback proof, a DB read on every verification, and a larger high-risk
   surface, for tuning flexibility not needed before beta (Anti-Fraud §2.5 says
   V1 scoring should be simple and tuned after beta).
2. Read thresholds from `process.env`: rejected. Violates the rule that
   domain/rule functions receive values as parameters, and scatters anti-fraud
   policy across deployment config.

## Consequences

Positive:

- Thresholds are versioned with code, reviewable in diffs, and testable as pure
  inputs.
- The accessor seam makes the later DB-backed swap non-breaking.

Tradeoffs:

- Changing a threshold before the DB-backed source exists requires a redeploy.

## Follow-Up

- Future story: back `getFraudRules()` with `fraud_rule_configs` (migration +
  seed + rollback proof) when post-beta tuning is needed.