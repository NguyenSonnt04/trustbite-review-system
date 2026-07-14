# Exec Plan

## Goal

Implement and prove the backend-only avatar upload URL endpoint without touching UI/client/mobile code.

## Scope

In scope:

- Protected Express route under `/api/v1/users/me/avatar-upload-url`.
- Avatar storage service behind `server/src/services/`.
- Unit and integration tests.
- Product/story/Harness proof updates.

Out of scope:

- UI, mobile, or admin UI changes.
- Database migrations.
- Live S3 upload through the returned URL.

## Risk Classification

Risk flags:

- Auth/security/provider.
- Public protected API.
- AWS S3 provider boundary.

Hard gates:

- TDD red proof before implementation.
- Targeted unit and integration proof.
- `server:build`.
- Harness story verify and matrix refresh.

## Work Phases

1. Read product/API/profile/provider docs.
2. Add red service and route tests.
3. Implement service/controller/route.
4. Add repeatable verify command.
5. Run validation and update Harness.

## Stop Conditions

Pause for human confirmation if:

- The endpoint requires live S3 upload proof.
- The API contract changes to auto-persist `users.avatar_url`.
- UI/client/mobile work becomes required.
