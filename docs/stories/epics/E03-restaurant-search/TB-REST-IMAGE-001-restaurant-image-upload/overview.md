# TB-REST-IMAGE-001: Restaurant Image Upload

## Status

in_progress

## Lane

high-risk

## Current Behavior

Public restaurant responses can expose a persisted `primaryImageUrl`, and the
mobile app can render it, but TrustBite has no authorized upload API for
restaurant images. The existing S3 integration stores private receipt evidence
and must not be reused as public restaurant media without an explicit boundary.

## Target Behavior

`ADMIN` and `SUPER_ADMIN` users can upload one JPEG, PNG, or WebP restaurant
image through the Express API. The backend stores the private S3 object in a
dedicated restaurant-image bucket, persists an owned `s3://` reference in
`restaurant_images`, returns short-lived presigned HTTPS URLs, and atomically
replaces the restaurant-level primary image when requested.

## Affected Users

- Administrators who manage restaurant profiles.
- Public and mobile users who view restaurant images.

## Affected Product Docs

- `docs/product/restaurant-discovery.md`
- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/04_Software_Engineering/openapi.yaml`

## Non-Goals

- Merchant owner or manager uploads.
- Branch images, image galleries, deletion UI, moderation, or transformations.
- Public S3 ACLs or exposing private receipt evidence through restaurant media
  delivery.
