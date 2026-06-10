# Overview

## Current Behavior

Docs mention admin account lock/unlock and user state `SUSPENDED`, but backend has no admin account suspension API or session-revocation behavior.

## Target Behavior

Admins can suspend a user account with reason. Suspension sets `users.status = SUSPENDED`, revokes sessions, records an audit log, and prevents login/refresh/profile mutation/protected mutations. Admins can reactivate a suspended user to `ACTIVE`; old sessions remain revoked.

## Affected Users

- Admin and super admin users.
- Suspended users.
- Backend services enforcing protected actions.

## Affected Product Docs

- `trustbite-docs/02_Business_Analysis/Business_Rules.md`
- `trustbite-docs/02_Business_Analysis/State_Machines.md`
- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/04_Software_Engineering/openapi.yaml`
- `docs/decisions/0009-user-account-suspension-contract.md`

## Non-Goals

- No account deletion/data deletion implementation.
- No user-to-user block implementation.
- No UI/admin web work.
