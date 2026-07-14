# Design

## Domain Model

- Restaurant images remain rows in `restaurant_images`.
- This story creates only restaurant-level rows with `branch_id = NULL`.
- `isPrimary` defaults to `true`. When true, existing restaurant-level primary
  rows are cleared in the same transaction before the new row is inserted.

## Application Flow

1. Authenticate the request and require a TrustBite-local `ADMIN` or
   `SUPER_ADMIN` role.
2. Parse a single `restaurantImage` multipart file with a 5 MB limit.
3. Validate restaurant UUID, idempotency key, caption, primary flag, MIME type,
   filename extension, and magic bytes before provider access.
4. Lock and validate the non-deleted restaurant.
5. Upload the object privately to the restaurant-image S3 bucket.
6. Persist the owned `s3://` reference and audit record in one PostgreSQL
   transaction.
7. Delete the uploaded object on persistence failure.
8. Resolve owned references to short-lived presigned GET URLs at response time.

## Interface Contract

`POST /api/v1/restaurants/:restaurantId/images`

Headers:

- `Authorization: Bearer <Cognito access token>`
- `Idempotency-Key: <UUID v4>`

Multipart fields:

- `restaurantImage`: required JPEG, PNG, or WebP, maximum 5 MB.
- `caption`: optional, trimmed, maximum 255 characters.
- `isPrimary`: optional strict `true` or `false`, default `true`.

Success returns `201` with the persisted restaurant image DTO. A completed
idempotent replay returns the same response with `Idempotency-Replayed: true`.

## Data Model

No migration is required. The existing `restaurant_images`, `idempotency_keys`,
and `audit_logs` tables are used. The service locks the restaurant row to
serialize primary-image replacement.

## UI / Platform Impact

The existing public `primaryImageUrl` contract and Flutter card/detail image
rendering consume the signed HTTPS URL without mobile changes.

## Observability

Successful uploads write `RESTAURANT_IMAGE_UPLOADED` to `audit_logs` with the
actor, image ID, restaurant ID, and primary flag. Logs and errors must never
contain credentials or raw file bytes.

## Alternatives Considered

1. Public S3 object URLs. Rejected because the bucket must remain private.
2. CloudFront OAC delivery. Deferred until the AWS account can create CloudFront
   resources; presigned S3 delivery keeps the current development flow private.
3. Allow all authenticated users. Rejected because restaurant ownership
   authorization is not implemented.
3. Reuse receipt storage. Rejected because receipt evidence is private and has
   different retention and access rules.
