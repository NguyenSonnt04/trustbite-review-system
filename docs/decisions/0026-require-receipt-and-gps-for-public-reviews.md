# 0026 Require receipt and GPS for public reviews

Date: 2026-07-15

## Status

Accepted

## Context

The existing review backend accepts optional GPS evidence and can publish
`REFERENCE_ONLY` reviews. The mobile review flow must prevent unrestricted
public reviews: a signed-in user must provide both a receipt image and current
GPS evidence, and failed verification must never become public.

## Decision

- Receipt upload requires latitude, longitude, and positive GPS accuracy.
- Only backend-verified reviews may be public or affect restaurant ratings.
- Failed, reference-only, and pending outcomes remain private with no trust
  weight.
- Mobile clients collect receipt and GPS evidence but never decide whether a
  review is trusted or public.

## Consequences

Users who deny location access, cannot obtain a GPS fix, or cannot provide a
receipt cannot submit verification evidence. Existing reference-only reviews
are excluded from public listing and rating aggregation.
