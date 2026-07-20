# 0030 Mobile Favorites and Review-Author Block Boundary

## Status

Accepted

## Context

The schema already supports saved lists, but mobile Favorites is mock-only and
no API contract exists. Public review DTOs intentionally omit reviewer user IDs,
so Flutter cannot safely call the existing user-ID block route.

## Decision

- Mobile MVP uses one private default saved list named `Yêu thích`.
- Authenticated favorite list/save/remove APIs operate only on that default
  list and return restaurant card fields needed by Flutter.
- Save/remove are idempotent and user-scoped.
- Blocking from a review uses review-ID routes. Express resolves the author
  from a public review and applies existing block rules without returning or
  exposing the author's internal user ID.
- Multiple collections, public lists, and blocked-user listing remain separate
  stories.

## Consequences

Favorites becomes account-synchronized without a migration. Reviewer privacy is
preserved, while mobile can still provide contextual block/unblock controls.
Future named collections or blocked-user management require explicit API and
authorization design.
