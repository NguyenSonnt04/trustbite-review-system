# Overview

## Story

As an active restaurant owner or manager, I can upload and remove images for my
assigned restaurant and submit private ownership evidence. As an administrator,
I can manage images for any restaurant and decide merchant claims through the
operations dashboard.

## Scope

- Restaurant-scoped authorization for `OWNER` and `MANAGER`.
- Admin and super-admin override for image management.
- Protected image listing, upload, and idempotent deletion.
- Private merchant claim evidence upload and claim decisions.
- Separate merchant and admin dashboard surfaces.

## Out of Scope

- Customer receipt uploads by merchants.
- `STAFF` media management.
- Branch-specific galleries, image transformations, and CloudFront delivery.
