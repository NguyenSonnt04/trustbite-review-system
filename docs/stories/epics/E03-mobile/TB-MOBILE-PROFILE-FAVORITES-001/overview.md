# Mobile Favorites and Profile Management

## Current Behavior

Favorites renders mock restaurants and cannot persist saves. Profile action
tiles have empty handlers. Mobile has no edit-profile/avatar, gamification,
report/block, or account-deletion workflow despite existing backend contracts
for most of those capabilities.

## Target Behavior

Authenticated users can persist a private default Favorites list, edit profile
fields and avatar, view backend-owned gamification progress, report restaurants
or reviews, block a review author without receiving that author's internal user
ID, and request or cancel account deletion. Guest entry points require login.

## Affected Users

- Mobile reviewers and restaurant discovery users.
- TrustBite moderation and privacy operators receiving user requests.

## Affected Product Docs

- `docs/product/user-profiles.md`
- `docs/product/gamification.md`
- `docs/product/restaurant-discovery.md`
- `docs/product/reviews.md`

## Non-Goals

- Named/public saved-list collections.
- A leaderboard or client-computed EXP.
- Exposing reviewer user IDs.
- Listing blocked users before a dedicated privacy-reviewed read API exists.
- Changing deletion retention or processing rules.
