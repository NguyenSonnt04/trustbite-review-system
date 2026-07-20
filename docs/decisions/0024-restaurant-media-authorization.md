# 0024 Restaurant Media Authorization

Date: 2026-07-14

## Status

Accepted

## Context

Restaurant images and ownership evidence are sensitive mutations. TrustBite must
allow platform administrators to manage any restaurant while limiting merchant
actions to restaurants they actively own or manage. Customer receipt evidence
must remain separate from merchant ownership evidence.

## Decision

- `ADMIN` and `SUPER_ADMIN` may list, upload, and delete images for any
  non-deleted restaurant.
- A TrustBite-local `MERCHANT` may manage images only when the merchant profile
  is `ACTIVE` and `restaurant_merchants` contains an `ACTIVE` `OWNER` or
  `MANAGER` assignment for that restaurant.
- `STAFF`, inactive assignments, suspended merchants, provider-only roles, and
  claims without an active assignment do not authorize image management.
- Merchant ownership evidence is stored privately under
  `receipts/merchant-claims/` and
  creates a `restaurant_claims` workflow. It never enters customer
  `receipt_verifications`.
- Image deletion is idempotent, removes the public database reference first,
  promotes the newest remaining restaurant-level image when needed, and
  retries private S3 cleanup from durable idempotency state.
- Every successful image upload, image deletion, and claim decision is audited.

## Consequences

- Authorization remains server-side and restaurant-scoped.
- Customer anti-fraud receipt semantics are not weakened by merchant uploads.
- Merchant and admin dashboards can use the same image management APIs.
- Claim approval must provision an active restaurant merchant assignment before
  the merchant can manage restaurant media.
