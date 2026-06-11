# 0012 Admin Roles Source Of Truth

Date: 2026-06-12

## Status

Accepted

## Context

PR #20 review found that admin authorization combined local `user_roles` rows with roles from provider claims. That made actor and target role checks asymmetric: the actor could receive `ADMIN` or `SUPER_ADMIN` through Cognito groups while target-tier checks used only the TrustBite `user_roles` table.

TrustBite already treats PostgreSQL as the product-state store and Cognito as the identity/token issuer. Admin suspend/reactivate changes product state and writes audit logs, so role elevation must be controlled by TrustBite-local authorization data rather than by mutable provider group claims in access tokens.

## Decision

TrustBite-local `user_roles` is the source of truth for product roles that authorize business API actions, including `ADMIN` and `SUPER_ADMIN`.

- Cognito remains the auth/token source of truth.
- Cognito groups may be retained as provider diagnostics on normalized identity, but they do not grant TrustBite product roles by default.
- `req.user.roles` for business authorization is built from `user_roles` plus explicitly trusted non-production local smoke-test roles only when trusted headers are enabled outside production.
- Admin tier checks for actor and target users must compare normalized TrustBite-local role values.
- A future decision may map Cognito groups to TrustBite roles, but only with explicit provisioning/synchronization rules and negative-path proof.

## Alternatives Considered

1. Continue merging Cognito groups into `req.user.roles`. Rejected because actor authorization and target tier checks can diverge.
2. Check Cognito groups for both actor and target. Rejected because target users are not represented by the current request token and group lookups would add provider coupling to admin services.
3. Synchronize Cognito groups into `user_roles` in this PR. Rejected as larger provider behavior and data-ownership work that needs its own high-risk story.

## Consequences

Positive:

- Admin authorization uses one local product-role source for both actor and target checks.
- Cognito remains responsible for token validity without becoming the product RBAC store.
- Admin audit rows record roles derived from TrustBite-local authorization state.

Tradeoffs:

- Cognito group changes do not immediately grant admin product permissions unless a separate synchronization/provisioning story is implemented.
- Local smoke tests that need admin access must use seeded `user_roles` or explicitly enabled trusted local headers outside production.

## Follow-Up

- Add automated admin authorization tests that prove Cognito groups alone cannot grant admin actions.
- If Cognito group-to-role synchronization is needed, create a high-risk story and update this decision.
