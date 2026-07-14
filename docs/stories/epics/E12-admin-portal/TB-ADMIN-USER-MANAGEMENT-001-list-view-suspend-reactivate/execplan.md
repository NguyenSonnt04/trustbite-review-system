# Exec Plan

## Goal

Deliver secure administration of TrustBite users from the existing Next.js admin portal, including Cognito-backed creation, paginated list/detail reads, profile updates, audited suspension/reactivation, and role management.

## Scope

In scope:

- Server-side admin BFF proxy authenticated by the opaque admin session.
- Cognito-backed confirmed-user provisioning and transactional PostgreSQL mapping.
- User list, search, status/role filters, deterministic pagination, and masked contact data.
- User detail and profile editing for display name, date of birth, and phone number.
- Suspend/reactivate actions with required reason, confirmation, session invalidation, and audit evidence.
- Role assignment for `USER`, `ADMIN`, and `SUPER_ADMIN`, restricted by the accepted role matrix.
- Protection against self role changes, `ADMIN` targeting `SUPER_ADMIN`, and removal of the final active `SUPER_ADMIN`.
- Responsive loading, empty, error, retry, form validation, and success states.

Out of scope:

- Hard deletion or an admin delete button, as confirmed by the human.
- Changing the account-deletion processor or retention policy.
- Browser exposure of Cognito tokens, the BFF secret, or the opaque session marker.
- Email editing after Cognito provisioning.
- Admin dashboard, receipt queue, moderation queue, claim queue, or audit viewer.

## Risk Classification

Risk flags:

- Auth.
- Authorization.
- Data model and canonical role seed data.
- Audit/security.
- External Cognito provider behavior.
- Public/internal API contracts.
- Existing suspension behavior.
- Cross-boundary Next.js, Express, PostgreSQL, Redis, and Cognito flow.

Hard gates:

- Auth.
- Authorization.
- Audit/security.
- External provider behavior.

## Work Phases

1. Record the high-risk story and the server-side BFF proxy decision.
2. Add failing unit and integration contracts for session validation, list/detail, provider-backed create, profile update, role guards, and existing status actions.
3. Add canonical role seed migration and provider adapter operations with compensation on local persistence failure.
4. Implement internal Express admin-web routes and Next.js same-origin BFF routes.
5. Replace the locked user state with the responsive user-management UI.
6. Run migrations, unit/integration tests, server syntax, client lint/build, rollback proof, and browser verification.
7. Update product/API docs, Harness evidence, and trace.

## Stop Conditions

Pause for human confirmation if:

- Implementation would require hard deletion or bypass the privacy deletion workflow.
- Cognito cannot provide a stable `sub` for a created identity.
- Role changes would weaken the accepted local `user_roles` source of truth.
- Validation or audit requirements would need to be reduced.
