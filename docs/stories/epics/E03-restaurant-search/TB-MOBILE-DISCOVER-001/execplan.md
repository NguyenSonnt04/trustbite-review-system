# Exec Plan

## Goal

Replace the mobile nearby-card mock list with backend restaurant summaries and
backend-delivered primary image URLs.

## Scope

In scope:

- Public primary-image projection and URL resolution.
- Mobile response parsing and card state handling.
- Focused server integration and Flutter tests.
- Android internet permission.

Out of scope:

- Device location acquisition.
- Other mock-backed home sections.
- New database columns or image upload behavior.

## Risk Classification

Risk flags:

- Public contracts.
- Cross-platform.
- Existing behavior.
- External systems.
- Weak proof across the prior mobile/backend boundary.

Hard gates:

- AWS-backed image delivery behavior.

Lane: high-risk.

## Work Phases

1. Add failing public-image and mobile parsing/rendering contracts.
2. Extend the existing public query without changing schema.
3. Add the mobile repository and inject it into Discover.
4. Add loading, empty, failure, retry, and image fallback states.
5. Run server, mobile, migration, analysis, and platform validators.
6. Refresh Harness evidence.

## Stop Conditions

Pause if implementation requires a schema change, exposing stable S3
references, weakening image validation, or hardcoding a device location.
