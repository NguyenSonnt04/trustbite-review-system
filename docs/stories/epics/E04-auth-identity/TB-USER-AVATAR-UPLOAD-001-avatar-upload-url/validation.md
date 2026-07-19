# Validation

## Proof Strategy

Use TDD at the service and route boundary. Prove signed URL creation through a deterministic signer test double, input validation fail-closed behavior, protected route behavior, no automatic profile mutation, and syntax/build proof.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Service builds `avatars/<userId>/...` S3 `PutObjectCommand` with signed `ContentLength`; default presigner includes `content-length` in `X-Amz-SignedHeaders`; returns allowlisted cleanup-compatible `avatarUrl`; rejects unsupported content type, missing/invalid size, and missing config before signing. |
| Integration | `POST /api/v1/users/me/avatar-upload-url` returns upload data for an active user with the requested file size bound to `ContentLength`; returned path-style/custom-host `avatarUrl` can be persisted through `PATCH /api/v1/users/me` with the bucket path retained for deletion cleanup; invalid content type or missing size returns `422` and does not sign; profile row remains unchanged until PATCH. |
| E2E | Not required for backend closeout. |
| Platform | S3 signing uses deterministic test double; live S3 PUT is not claimed. |
| Performance | Not required. |
| Logs/Audit | Error responses do not expose raw signed URL secrets. |

## Fixtures

- Active local user via trusted test auth headers.
- Deterministic signer returning a known signed URL.

## Commands

```text
npm run verify:tb-user-avatar-upload
```

## Acceptance Evidence

2026-07-08:

- Red proof: targeted unit and integration tests first failed because `avatarStorageService.js` and `/api/v1/users/me/avatar-upload-url` did not exist.
- Green proof: `npm run test:unit --prefix server -- tests/unit/storage/avatarStorageService.test.js` passed with the broader unit harness reporting 21 files / 218 tests.
- Green proof: `npm run test:integration --prefix server -- tests/integration/userProfile.integration.test.js` passed with 12 files passed / 2 skipped and 101 tests passed / 4 skipped.
- `npm run verify:tb-user-avatar-upload` passed: `db:migrate` applied 0, targeted unit proof passed 21 files / 218 tests, targeted integration proof passed 12 files / 2 skipped and 101 tests / 4 skipped, and `server:build` passed for 104 files.
- `npm run harness -- story verify TB-USER-AVATAR-UPLOAD-001` passed through the same verify command.

2026-07-09 signed content-length review fix:

- Red proof: `npm run test:unit --prefix server -- tests/unit/storage/avatarStorageService.test.js` failed because `PutObjectCommand.input.ContentLength` was absent and missing `fileSizeBytes` still produced an upload URL.
- Red proof: `npm run test:integration --prefix server -- tests/integration/userProfile.integration.test.js` failed because the route did not bind `ContentLength` and accepted requests without `fileSizeBytes`.
- Green proof: avatar upload requests now require `fileSizeBytes`, pass it as S3 `ContentLength`, and the default AWS presigner proof includes `content-length` in `X-Amz-SignedHeaders`.
- Green proof: targeted unit proof passed with 21 files / 221 tests and targeted profile integration proof passed with 12 files / 2 skipped and 103 tests / 4 skipped.

2026-07-09 review fix:

- Red proof: `npm run test:integration --prefix server -- tests/integration/userProfile.integration.test.js` failed because the avatar upload endpoint returned `https://localhost:4566/...` for a ported allowlisted host, then `PATCH /api/v1/users/me` rejected that same URL with `422`.
- Green proof: profile avatar validation now compares the parsed URL host, including a non-default port, against `TRUSTBITE_AVATAR_ALLOWED_HOSTS`.
- `npm run verify:tb-user-avatar-upload` passed: `db:migrate` applied 0, targeted unit proof passed 21 files / 218 tests, targeted integration proof passed 12 files / 2 skipped and 102 tests / 4 skipped, and `server:build` passed for 104 files.

2026-07-09 cleanup-compatible URL review fix:

- Red proof: `npm run test:unit --prefix server -- tests/unit/storage/avatarStorageService.test.js` failed because a path-style avatar host returned `https://localhost:4566/avatars/...` instead of `https://localhost:4566/<bucket>/avatars/...`, so `parseOwnedObjectUrl` would not classify the persisted URL as TrustBite-owned.
- Green proof: avatar upload URLs now include the bucket path for custom CDN and LocalStack/path-style hosts while keeping the object key under `avatars/<userId>/...`; unit proof passed with 21 files / 219 tests and integration profile proof passed with 12 files / 2 skipped and 102 tests / 4 skipped.
- `npm run verify:tb-user-avatar-upload` passed: `db:migrate` applied 0, targeted unit proof passed 21 files / 219 tests, targeted integration proof passed 12 files / 2 skipped and 102 tests / 4 skipped, and `server:build` passed for 104 files.
- `npm run harness -- story verify TB-USER-AVATAR-UPLOAD-001` passed through the same verify command.

2026-07-09 cleanup allowlist review fix:

- Red proof: `npm run test:unit --prefix server -- tests/unit/storage/avatarStorageService.test.js` failed because a custom CDN in `TRUSTBITE_AVATAR_ALLOWED_HOSTS` could still receive an avatar URL when the same host was not accepted by the S3 cleanup allowlist.
- Green proof: avatar upload URL creation now parses the candidate public URL through the same owned-object cleanup parser before signing, failing closed with `PROVIDER_UNAVAILABLE` if the URL would be `unapproved_host` or otherwise unowned for account-deletion cleanup. Targeted unit proof passed with 21 files / 222 tests and targeted profile integration proof passed with 12 files / 2 skipped and 103 tests / 4 skipped.
- `npm run verify:tb-user-avatar-upload` passed: `db:migrate` applied 0, targeted unit proof passed 21 files / 222 tests, targeted integration proof passed 12 files / 2 skipped and 103 tests / 4 skipped, and `server:build` passed for 104 files.
- `npm run harness -- story verify TB-USER-AVATAR-UPLOAD-001` passed through the same verify command.

2026-07-16 public-read degradation fix:

- `resolveReadUrl` now treats malformed or non-owned persisted avatar references
  as unavailable media and returns `null`, so a bad historical URL cannot fail an
  otherwise valid public review response.
- `avatarStorageService.test.js` covers malformed URL parsing in addition to
  untrusted and allowlisted-host behavior; the full server unit suite passed
  45 files / 424 tests.

2026-07-20 avatar ownership fix:

- `PATCH /api/v1/users/me` now accepts only cleanup-compatible avatar
  references under `avatars/<currentUserId>/...`; an allowlisted URL owned by a
  different user returns `422 AVATAR_REFERENCE_NOT_OWNED`.
- Account deletion independently skips an avatar cleanup target whose object
  path does not match the deleted user, preventing cross-user object deletion
  even if a historical invalid reference exists.
- Focused ownership proof passed 3 files / 52 tests. The full server suite
  passed 76 files / 649 tests with 4 provider tests skipped, `server:build`
  passed for 144 files, and `verify:tb-user-avatar-upload` passed.
