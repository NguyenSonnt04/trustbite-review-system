# Design

## Security Boundary

The browser uses same-origin Next.js BFF routes. Express requires the server-only BFF credential, validates the opaque admin session on every request, and revalidates the local active `ADMIN` or `SUPER_ADMIN` role before restaurant services run.

## Restaurant Detail

Admin reads include non-public statuses but exclude soft-deleted restaurants. Updates use the existing restaurant schema and keep `geo` synchronized with latitude and longitude. Category IDs are validated against canonical categories. Every material change writes an audit record.

## Image Lifecycle

Images are stored privately in the configured S3 bucket under `restaurant-images/<restaurantId>/`. PostgreSQL stores stable `s3://` references; responses contain short-lived signed URLs. Uploads accept one JPEG, PNG, or WebP file up to 5 MB and validate declared MIME type plus file signature.

Mutations lock the restaurant before changing primary-image state. Upload and replacement delete the newly uploaded object if persistence fails. Removal deletes the database row first, promotes the newest remaining image when required, then deletes only an allowlisted TrustBite-owned object. External legacy URLs are never deleted as owned storage.

## UI

The restaurant list opens a large modal. The modal contains profile fields, status, category IDs, and an image gallery. Image actions include preview, upload, replace, set primary, and remove with confirmation. Server truth is reloaded after every successful mutation.
