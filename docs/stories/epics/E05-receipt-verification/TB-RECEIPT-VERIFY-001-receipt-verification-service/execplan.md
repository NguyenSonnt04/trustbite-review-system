# Exec Plan

Story: TB-RECEIPT-VERIFY-001 — Receipt verification service (Task 4.4)

## Goal

Implement the backend receipt verification decision engine: given an uploaded
receipt that has already been OCR'd, compute the fraud risk score from the
documented signals, decide the verification bucket, and atomically update both
`receipt_verifications` and the parent `reviews` row to the exact states defined
in `Status_Mapping.md` §3. Duplicate transaction hashes are a hard reject with a
fraud flag.

## Scope

In scope:

- Pure, DB-free functions: `haversineMeters`, `normalizeMerchantName`,
  `levenshteinSimilarity`, `computeTransactionHash`, `scoreReceipt`,
  `decideFromScore`.
- `verifyReceipt(receiptVerificationId)` orchestrator in one transaction:
  load receipt + review + restaurant, composite duplicate-hash hard reject,
  signal computation, scoring, decision, and synchronized status writes to
  `receipt_verifications` and `reviews`.
- Fraud flags + fraud_flag_entities on duplicate transaction hash and on
  rejection with serious signals.
- Audit log row for the automated decision (Anti-Fraud spec §11).
- Threshold constants in a single config accessor (`fraudRules`).
- Unit tests covering every scoring-table row (§4.1), every bucket boundary
  (§4.2), and every P0 status-mapping row (§3), including abuse/negative paths.

Out of scope:

- File upload, S3 storage, SHA-256 file hashing pipeline, and the Textract OCR
  call itself (earlier Task 4.x). This story consumes OCR fields already
  persisted on the receipt row.
- HTTP route/controller wiring (`POST /receipts`, `GET /receipts/{id}`).
- Admin manual review actions (separate story).
- DB-tunable thresholds via `fraud_rule_configs` (deferred — see decision 0014).
- Account-behavior signals that need cross-row lookups not available in this
  slice (new-account <24h, >=3 rejected receipts /7d, multi-account same
  device/IP). Documented as not-yet-wired; scoring supports them when signals
  are supplied.

## Risk Classification

Risk flags: Authorization-adjacent (trust outcomes), Data model (writes to
reviews + receipt_verifications + fraud_flags), Audit/security, Anti-fraud
rules, Existing behavior (reviews lifecycle), Multi-domain.

Hard gates: Audit/security; anti-fraud rule definition. → high-risk.

## Work Phases

1. Discovery — read schema, spec §4–§7/§11, Status_Mapping §3–§4, service/test patterns. (done)
2. Design — decision engine, status-mapping table, threshold source. (this packet)
3. Validation planning — see validation.md.
4. Implementation — TDD: tests first, then config + pure module + orchestrator.
5. Verification — `npm run test:unit`, `npm run server:build`; DB proof or blocker.
6. Harness update — intake + story + decision records.

## Stop Conditions

Pause for human confirmation if:

- Status-mapping requires a status value outside Status_Mapping §4 enums.
- A scoring signal needs a column not present in `001_init_schema.sql`.
- Threshold source-of-truth ambiguity (resolved: constants now, DB later).