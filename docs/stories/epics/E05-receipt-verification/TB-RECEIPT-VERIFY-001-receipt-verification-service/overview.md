# Overview

Story: TB-RECEIPT-VERIFY-001
Lane: high-risk
Epic: E05 Receipt Verification

## Problem

TrustBite restores trust in food reviews by verifying receipts. After a receipt
is uploaded, hashed, and OCR'd (earlier tasks), the system must turn raw signals
(merchant-name match, receipt timestamp, GPS proximity, duplicate transaction
hash) into a single fraud risk score and a verification decision, then move the
review through its trust lifecycle. Today no backend rule does this; the client
only simulates it. Per ARCHITECTURE.md the final trust outcome must come from
backend rules, not client state.

## User / System Story

As the verification system, when a user's receipt finishes OCR, I score the
fraud signals and decide VERIFIED / PENDING_ADMIN_REVIEW / REFERENCE_ONLY /
REJECTED, so that only trustworthy reviews become public with HIGH trust weight
and fraudulent or duplicate submissions are rejected and flagged.

## Acceptance Criteria

1. Pure scoring functions implement Anti-Fraud spec §4.1 exactly, are DB-free,
   and are unit-tested per table row and bucket boundary.
2. `decideFromScore` maps 0–30→VERIFIED, 31–60→PENDING_ADMIN_REVIEW,
   61–99→REFERENCE_ONLY, ≥100→REJECTED.
3. Composite `transaction_unique_hash` collision against a prior VERIFIED receipt
   is a hard reject: receipt→REJECTED, review→REJECTED/DUPLICATE_REJECTED/PRIVATE,
   and a `fraud_flags` row with code `DUPLICATE_TRANSACTION_HASH` linked through
   `fraud_flag_entities`.
4. Each non-duplicate outcome updates `receipt_verifications` (status, decision,
   fraud_risk_score, gps_distance_meters, decision_reason) and `reviews`
   (status, verification_status, trust_label, public_visibility,
   trust_weight_bucket) to the exact Status_Mapping §3 row.
5. GPS 1-hour window is measured from `receipt_verifications.created_at`
   (server-side), and client `capturedAt` skew >5 min downgrades GPS to
   "not trustworthy".
6. The automated decision writes an `audit_logs` row (spec §11).
7. All writes happen in one transaction and roll back cleanly on error.
8. Only columns present in `001_init_schema.sql` are written.

## Out of Scope

S3/Textract pipeline, HTTP wiring, admin review actions, DB-tunable thresholds.

## Dependencies

- `001_init_schema.sql` tables: receipt_verifications, reviews, fraud_flags,
  fraud_flag_entities, restaurants, restaurant_branches, audit_logs.
- OCR fields already populated on the receipt row by an earlier task.