# Design

## Domain Model

- Avatar objects are TrustBite-owned S3 objects under `avatars/<userId>/<objectId>.<ext>`.
- Returned public `avatarUrl` values must be compatible with `S3ObjectStorage.deleteOwnedObject`: custom CDN and LocalStack/path-style hosts use `/<bucket>/avatars/...`; virtual-hosted S3 hosts use `/avatars/...`.
- Accepted content types are `image/jpeg`, `image/png`, and `image/webp`.
- `fileSizeBytes` is required, must be an integer in `1..5242880`, and is signed as the S3 `ContentLength` for the presigned PUT.
- Upload URLs expire after 900 seconds.

## Application Flow

1. Cognito/local auth middleware authenticates the request and enforces local account status.
2. Controller passes `req.user.id`, `contentType`, and required `fileSizeBytes` to the avatar storage service.
3. Service validates storage configuration, content type, and file size.
4. Service creates a random avatar object key and signs a S3 `PutObjectCommand`.
5. Response returns `uploadUrl`, allowlisted cleanup-compatible `avatarUrl`, and `expiresAt`.

## Interface Contract

`POST /api/v1/users/me/avatar-upload-url`

Request:

```json
{
  "contentType": "image/webp",
  "fileSizeBytes": 2048
}
```

Response:

```json
{
  "uploadUrl": "https://...",
  "avatarUrl": "https://cdn.example/trustbite-media/avatars/<userId>/<objectId>.webp",
  "expiresAt": "2026-07-08T10:15:00.000Z"
}
```

Errors:

- `401 AUTH_REQUIRED` for missing credentials.
- `403 ACCOUNT_SUSPENDED` / `ACCOUNT_DELETED` from auth middleware.
- `422 AVATAR_CONTENT_TYPE_UNSUPPORTED`.
- `422 AVATAR_FILE_SIZE_INVALID` when `fileSizeBytes` is missing or outside `1..5242880`.
- `503 PROVIDER_UNAVAILABLE` when storage bucket or avatar allowlist is not configured.

## Data Model

No schema change. `users.avatar_url` remains nullable and is updated only by `PATCH /users/me`.

## UI / Platform Impact

Backend-only. No client, mobile, or admin UI work.

## Observability

Do not log raw signed upload URLs or full object URLs in normal error responses.

## Alternatives Considered

1. Direct multipart upload through Express: rejected for this slice because the existing provider boundary supports S3 object storage and the contract asks for an upload URL.
2. Auto-update `users.avatar_url` when issuing the URL: rejected because upload completion is not proven at URL issuance time.
