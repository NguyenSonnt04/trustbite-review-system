# Design

## Authorization

The service accepts platform roles `ADMIN` and `SUPER_ADMIN`. Merchant access
requires local role `MERCHANT`, an active merchant profile, and an active
`restaurant_merchants` assignment with permission `OWNER` or `MANAGER`.

## Image APIs

- `GET /api/v1/restaurants/:restaurantId/images`
- `POST /api/v1/restaurants/:restaurantId/images`
- `DELETE /api/v1/restaurants/:restaurantId/images/:imageId`

The list returns restaurant-level image IDs and fresh signed URLs. Deletion uses
`Idempotency-Key`, promotes the deterministic newest remaining image when the
primary image is removed, and stores the S3 cleanup plan in idempotency state.

## Claim Evidence

- `POST /api/v1/merchant/claims`
- `GET /api/v1/merchant/claims`
- `GET /api/v1/admin/restaurant-claims`
- `POST /api/v1/admin/restaurant-claims/:claimId/decision`

Evidence is uploaded privately under `receipts/merchant-claims/`. Approval activates the
merchant profile, grants local `MERCHANT`, and upserts the requested
`OWNER`/`MANAGER` assignment in one transaction.

## Security

- No public S3 ACLs or bucket policy.
- Receipt evidence and merchant claim evidence use different object prefixes and
  business entities.
- Negative authorization paths return `403`; cross-restaurant image lookups use
  `404` to avoid enumeration.
- Signed URLs, object keys, credentials, and evidence references are not logged.
