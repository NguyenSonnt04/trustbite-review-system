# 0025: Restaurant Images Use Private S3 References And Signed Delivery

## Status

Accepted

## Decision

Restaurant images are uploaded to the configured private S3 bucket under `restaurant-images/<restaurantId>/`. PostgreSQL stores stable `s3://` references, while API responses expose short-lived signed GET URLs.

Uploads accept JPEG, PNG, and WebP files up to 5 MB after MIME and file-signature validation. Image mutations serialize primary-image changes. Replacement uploads the new object before the database swap and compensates on persistence failure. Removal deletes only allowlisted TrustBite-owned objects and never treats external URLs as owned storage.

## Consequences

- Production requires private-bucket IAM permissions and runtime S3 configuration.
- Signed URLs are refreshed whenever restaurant detail is reloaded.
- Provider and persistence failures require compensation and retry-safe tests.
- Public restaurant responses may expose the current signed primary image URL without exposing stable bucket references.
