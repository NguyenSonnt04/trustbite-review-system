# Overview

## Current Behavior

No backend user registration/profile API exists beyond model classes and schema.

## Target Behavior

OTP verification creates a user with phone number if needed. Authenticated users can read profile and update display name/avatar URL using only schema-backed fields. Suspended/deleted users cannot update profile.

## Affected Users

- Authenticated users.
- Suspended users.
- Mobile/API clients consuming `/users/me`.

## Affected Product Docs

- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/04_Software_Engineering/openapi.yaml`
- `trustbite-docs/06_Database_Design/PostgreSQL_Database_Schema.md`
- `trustbite-docs/06_Database_Design/Backend_Model_Guide.md`

## Non-Goals

- No UI work.
- No avatar upload URL implementation in this story.
- No new fields beyond `users` schema.
