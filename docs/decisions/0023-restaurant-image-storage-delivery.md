# 0023 Restaurant Image Storage And Delivery

Date: 2026-07-14

## Status

Accepted

## Context

TrustBite already stores private receipt evidence in S3 and publicly renders
restaurant image URLs persisted in `restaurant_images`. A new upload flow must
not expose receipt objects, grant broad upload access, or make the S3 bucket
public.

## Decision

- Only TrustBite-local `ADMIN` and `SUPER_ADMIN` roles may upload restaurant
  images in this story.
- Restaurant media uses a dedicated S3 bucket configuration and
  `restaurant-images/` object prefix.
- Objects are uploaded without public ACLs. The database stores a stable,
  bucket-scoped `s3://` reference and public APIs convert owned references into
  short-lived HTTPS presigned GET URLs.
- Signed URLs expire after 15 minutes by default, configurable from 60 to 3600
  seconds. Clients refetch restaurant data after expiration.
- Upload requests require idempotency keys and strict file validation.
- Receipt evidence storage and restaurant media storage remain separate.

## Alternatives Considered

1. Allow restaurant owners now. Rejected until merchant authorization has its
   own accepted contract and negative-path proof.
2. Use public S3 URLs or ACLs. Rejected because the image bucket must remain
   private.
3. Deliver through CloudFront OAC. Preferred for production-scale caching, but
   deferred because the current AWS account cannot create CloudFront resources.

## Consequences

Positive:

- Least-privilege upload authorization and private object storage.
- Public/mobile responses receive temporary HTTPS URLs without exposing the
  bucket publicly.
- Receipt privacy remains isolated.

Tradeoffs:

- Signed S3 delivery does not provide CloudFront edge caching and requires
  `s3:GetObject` permission for the backend runtime.
- Merchant self-service and image deletion require follow-up stories.

## Follow-Up

- Add merchant owner/manager authorization before exposing upload controls in a
  merchant UI.
- Add image deletion, moderation, transformations, and orphan cleanup.
