# 0027: Public Reviews Expose A Privacy-Safe Display Name

## Status

Accepted

## Decision

Public restaurant review responses expose `reviewerDisplayName`, sourced only
from the review author's trimmed `users.display_name`. The response continues
to omit the user ID, Cognito subject, email, phone number, receipt data, and all
other private profile fields.

When the author is deleted or the display name is blank, the backend returns
the fixed fallback `Người dùng TrustBite`. The deletion-status check happens in
the public review query so a stale display name cannot leak while account
deletion processing is still underway.

## Consequences

- A user's profile display name is public when their review is public.
- Mobile review cards render only the backend-issued display name and never
  invent identity data.
- A future avatar, alias, or privacy opt-out requires its own explicit contract.
- Account deletion keeps historical public review content non-identifying.
