# 0015 Account Deletion Retention Scope

## Status

Accepted

## Context

`TB-PRIVACY-RETENTION-JOB-001` deletes or anonymizes account-owned data using the migrated PostgreSQL schema as the implementation source of truth. The current schema has request-level cleanup state and retained-data reason fields, but it does not store per-provider cleanup status, per-object cleanup status, provider username/handle fields beyond `users.cognito_sub`, per-category retention expiry, or ownership markers for restaurant images and broader restaurant/menu/branch business content.

The deletion processor also performs non-transactional Cognito and S3 cleanup. LocalStack community 4.4.0 supports the S3 proof used by this story, but it does not expose Cognito IdP admin APIs in the local environment.

## Decision

For this story, completion is scoped to the migrated schema fields that can be proven account-owned or account-referenced without guessing ownership:

- Request-level cleanup state on `account_deletion_requests` is sufficient for the current job proof. Per-provider and per-object cleanup work items are deferred until operations need finer-grained retry or observability.
- `users.cognito_sub` is the Cognito admin cleanup identifier for the current Cognito-first boundary and is retained on the deleted local tombstone row as a security deny mapping.
- Cognito provider cleanup completion may be proven with a Cognito-compatible admin client test double when local provider emulation is unavailable, provided the test double exercises global sign-out, admin delete, and `UserNotFoundException` idempotency through the real provider boundary.
- TrustBite-owned S3 object cleanup remains in scope for profile avatar, receipt raw/redacted files, review media, and merchant claim evidence because those fields are reachable from the deleting user in the migrated schema.
- `restaurant_images.image_url` / `restaurant_images.caption` and broader restaurant, menu, branch, operating-hours, category, amenity, and payment-method content are not account-owned data for this story because the migrated schema lacks a user or merchant ownership column for those rows. They must not be deleted or rewritten by account deletion guesswork.
- Fraud and audit references tied to the deleted user, review, or receipt are retained as fraud/audit minimum records under the deletion request retained-data reason. Per-category expiry is a future retention-policy story.

## Consequences

- `TB-PRIVACY-RETENTION-JOB-001` can be completed without adding provider cleanup status tables, object cleanup status tables, restaurant-image ownership migrations, or per-category expiry fields.
- Future operations, legal, or product requirements for per-object/provider tracking, merchant-owned restaurant media cleanup, or category-specific expiry require a separate high-risk story and migration/decision.
- Provider/storage cleanup failures still block an individual deletion request from `COMPLETED`; this decision only defines which local proof mechanisms and data categories are in scope.
