# Admin Restaurant Details And Images

## Goal

Allow `ADMIN` and `SUPER_ADMIN` users to open a large restaurant detail modal, edit the complete restaurant profile and status, and manage its image gallery.

## Scope

- List all non-deleted restaurants for administration.
- Read and update name, description, address, phone number, coordinates, categories, and status.
- View image thumbnails and full-size signed images.
- Upload, replace, mark primary, and remove JPEG, PNG, or WebP images up to 5 MB.
- Audit profile, status, upload, replace, primary, and removal actions.

## Non-goals

- Hard-delete restaurants.
- Public or merchant image mutation.
- Image moderation, cropping, or transformation.
- Treat external image URLs as TrustBite-owned objects.
