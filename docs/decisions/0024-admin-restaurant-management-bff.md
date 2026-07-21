# 0024: Admin Restaurant Management Uses The Opaque-Session BFF

## Status

Accepted

## Decision

Admin restaurant list, detail, profile, status, electronic menu, and media
mutations use the existing opaque admin-web session boundary. Browser requests
go through allowlisted same-origin Next.js routes; Express requires the
server-only BFF credential and revalidates the local active admin role.

Both `ADMIN` and `SUPER_ADMIN` may manage restaurant profiles, electronic menu
items, and images. Menu updates use the existing `menu_items` fields, require
an administrative reason, preserve records through `ARCHIVED` status instead
of hard deletion, and write transactional audit records. Public restaurant
routes remain read-only discovery surfaces and are not used for admin
mutations.

## Consequences

- Cognito tokens and BFF secrets remain unavailable to browser JavaScript.
- Non-public restaurant statuses are visible only through admin-web routes.
- Existing generic authenticated restaurant mutation routes are not expanded for this UI.
- Every mutation must be audited against the current local admin actor.
- Public menu reads remain active-only while admin reads include archived
  items and non-public restaurants.
