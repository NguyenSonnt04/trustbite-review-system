# 0016 Restaurant CRUD Mutation Boundary

Date: 2026-07-08

## Status

Accepted

## Context

`TB-REST-001` closes out the existing backend restaurant CRUD API for Phase 3
database proof. The current Express routes require authenticated TrustBite
identity for `POST`, `PATCH`, and `DELETE`, but they do not yet distinguish
between internal operators, admins, and approved restaurant owners.

The product contract intentionally excludes merchant portal ownership editing
and UI/mobile management screens from this backend closeout. Tightening these
routes to admin/owner-only would change the production authorization contract
and requires ownership-specific acceptance criteria that are not part of the
CRUD proof story.

## Decision

For `TB-REST-001`, keep restaurant mutations behind the existing authenticated
business API boundary and treat the routes as internal backend/admin integration
endpoints. Do not expose these mutations as production self-service restaurant
management until a separate high-risk authorization story defines and proves the
admin/owner policy.

TrustBite-local `user_roles` remains the product-role source of truth when that
future story adds role checks, consistent with decision 0012.

## Alternatives Considered

1. Require `ADMIN` or `SUPER_ADMIN` immediately for all restaurant mutations.
   Rejected for this story because it would change the API contract without an
   accepted owner/admin management story.
2. Add owner checks against `restaurant_merchants` now. Rejected because owner
   assignment, merchant portal workflows, and negative authorization cases need
   their own high-risk acceptance criteria.
3. Leave the authorization ambiguity undocumented. Rejected because `TB-REST-001`
   needs an explicit production-boundary decision before closeout.

## Consequences

Positive:

- Phase 3 CRUD persistence can be proven without inventing ownership policy.
- Production exposure remains blocked until role/owner authorization is
  specified and tested.

Tradeoffs:

- The backend route contract is still broader than the final production UI
  should be.
- Operators must not treat these endpoints as public restaurant-owner features
  until the follow-up authorization story lands.

## Follow-Up

- Create a high-risk story for admin/owner restaurant mutation authorization
  before enabling production UI or mobile access to these routes.
