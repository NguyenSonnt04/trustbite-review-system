# Overview

## Current Behavior

`GET /api/v1/users/me` and `PATCH /api/v1/users/me` exist for schema-backed profile fields. `PATCH /users/me` accepts only allowlisted avatar URLs. The avatar upload URL flow is documented in the OpenAPI contract but has no backend endpoint.

## Target Behavior

Authenticated active users can call `POST /api/v1/users/me/avatar-upload-url` with an allowed image content type and required file size. The backend binds that exact content length into the short-lived signed S3 PUT URL, then returns the upload URL plus an allowlisted TrustBite-owned `avatarUrl`. The endpoint does not mutate `users.avatar_url`; clients persist the returned URL through the existing `PATCH /users/me` endpoint after upload.

## Affected Users

- Authenticated users updating their profile avatar.
- Suspended/deleted users, who must remain blocked by the protected route boundary.

## Affected Product Docs

- `docs/product/authentication.md`
- `docs/product/provider-integrations.md`
- `trustbite-docs/04_Software_Engineering/openapi.yaml`
- `trustbite-docs/04_Software_Engineering/API_Specification.md`

## Non-Goals

- No UI/client/mobile work.
- No DB schema change.
- No live S3 PUT E2E claim.
- No automatic profile mutation before the client calls `PATCH /users/me`.
