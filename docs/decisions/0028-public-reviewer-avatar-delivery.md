# 0028: Public Reviews Use Privacy-Safe Avatar Delivery

## Status

Accepted

## Decision

Public restaurant review responses may expose nullable `reviewerAvatarUrl`.
The backend derives it only from the review author's TrustBite-owned
`users.avatar_url` reference and returns a short-lived signed read URL. It
never returns the stored avatar reference, user ID, Cognito subject, email,
phone number, or receipt data.

When the author is deleted, has no avatar, has an invalid reference, or avatar
delivery is temporarily unavailable, the API returns `reviewerAvatarUrl=null`.
Mobile renders a neutral default-person silhouette for every null or failed
avatar instead of deriving initials or using an external identity service.

## Consequences

- A configured profile avatar is public alongside the user's public review.
- Account deletion suppresses the avatar in the public query before later
  provider cleanup completes.
- Avatar delivery failure does not fail the public review list.
- Replacing avatars and cleaning orphaned historical objects remain separate
  lifecycle work.
