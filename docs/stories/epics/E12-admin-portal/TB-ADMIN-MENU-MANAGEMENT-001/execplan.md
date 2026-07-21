# Exec Plan

## Goal

Provide secure, audited electronic menu viewing and maintenance in the existing
admin restaurant workflow.

## Scope

In scope:

- Complete admin menu listing.
- Menu-item creation and editing.
- Archive and reactivate actions.
- Admin BFF, local-role checks, validation, transactions, and audit records.
- Responsive restaurant-modal UI.

Out of scope:

- Schema changes.
- Branch-level menu overrides.
- Dish media or permanent deletion.
- Merchant access.

## Risk Classification

Risk flags:

- Authorization.
- Audit/security.
- Public contracts.
- Existing behavior.
- Multi-domain.

Hard gates:

- Authorization.
- Audit/security.

Lane: high-risk.

## Work Phases

1. Audit current admin and menu boundaries.
2. Define route and validation contracts.
3. Add failing route and integration tests.
4. Implement server service, controller, and routes.
5. Implement BFF client methods and admin UI.
6. Run database, server, and client proof.
7. Update product, decision, Harness, and evidence.

## Stop Conditions

Pause for human confirmation if:

- Existing schema cannot represent a requested field.
- Merchant or non-admin access is required.
- Permanent deletion or branch-specific pricing becomes required.
- Validation or audit requirements must be weakened.
