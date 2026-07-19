# Design

## Domain Model

- Each user receives one private default list named `Yêu thích`.
- A favorite is the existing `user_saved_list_restaurants` relationship.
- Gamification and account deletion remain backend-owned.
- Review-author blocking resolves the author from a public review server-side.

## Application Flow

Favorites loads the authenticated user's saved restaurants and API-backed
discovery suggestions. Save/remove operations are idempotent.

Profile actions open dedicated screens for editing profile/avatar,
gamification, safety guidance, and account deletion. Restaurant and review
menus submit contextual reports; review menus block or unblock the author.

## Interface Contract

- `GET /api/v1/users/me/favorites`
- `PUT /api/v1/users/me/favorites/{restaurantId}`
- `DELETE /api/v1/users/me/favorites/{restaurantId}`
- `POST /api/v1/reviews/{reviewId}/block-author`
- `DELETE /api/v1/reviews/{reviewId}/block-author`

Block creation resolves only a currently public review. Unblock targets the
active block's `source_review_id`, allowing reversal after later visibility or
restaurant-status changes without disclosing the author ID.

Existing contracts remain:

- `PATCH /api/v1/users/me`
- `POST /api/v1/users/me/avatar-upload-url`
- `GET /api/v1/users/me/gamification`
- `POST /api/v1/moderation/reports`
- account deletion request/status/cancel routes.

## Data Model

No migration. The implementation uses `user_saved_lists`,
`user_saved_list_restaurants`, `restaurants`, `reviews`, and `user_blocks` as
already migrated. The default list is private and selected by owner and exact
name.

## UI / Platform Impact

Flutter gains loading, error, empty, authenticated, destructive-confirmation,
and API-success states. Avatar uploads use a signed absolute PUT before the
returned allowlisted URL is persisted through `PATCH /users/me`.

## Observability

Do not log avatar signed URLs, deletion reasons, phone numbers, or internal
reviewer user IDs. Existing report, block, profile, and deletion service audit
boundaries remain authoritative.

## Alternatives Considered

1. Expose reviewer user IDs to Flutter. Rejected for privacy.
2. Keep Favorites device-local. Rejected because the migrated schema and
   authenticated product behavior require account sync.
3. Add multiple collection management now. Rejected as unnecessary scope.
