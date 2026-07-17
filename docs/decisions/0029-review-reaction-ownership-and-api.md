# 0029: Review Reactions Are Authenticated and User-Scoped

## Status

Accepted

## Decision

Review reactions use a dedicated `review_reactions` table keyed by
`(review_id,user_id)` and allow only `LOVE`, `HAHA`, or `ANGRY`. Mutation APIs
derive `user_id` exclusively from authenticated TrustBite context and run
public-review validation plus upsert/delete inside a transaction.

Public review APIs expose anonymous aggregate counts only. They never expose
reacting-user IDs or another user's reaction. Account deletion removes reaction
rows created by the deleted user and rows attached to that user's reviews.

## Consequences

- Concurrent requests cannot create duplicate reactions for one user/review.
- Selecting another reaction replaces the existing row deterministically.
- Private, hidden, deleted, or restaurant-inactive reviews are not reactable.
- Mobile may update optimistically but must roll back when the backend rejects
  the mutation.
