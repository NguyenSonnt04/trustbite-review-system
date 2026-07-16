# Exec Plan

## Goal

Replace the mock-only mobile notification flow with an authenticated in-app API
fed by completed review verification and badge-award rules.

## Scope

In scope:

- Review-verified EXP, rank, badge, and in-app notification side effects.
- Authenticated list and mark-read APIs.
- Flutter loading, empty, error, retry, refresh, unread, and accessibility
  behavior for notifications.
- Schema-safe seeds/indexes, tests, migration proof, and Harness records.

Out of scope:

- FCM/APNs delivery and native notification permission prompts.
- Notification types beyond review verification and badge awards.

## Risk Classification

Risk flags:

- Auth and authorization.
- Data model and transactional persistence.
- External-provider-adjacent mobile notification behavior.
- Public API contract.
- Cross-platform mobile UI.
- Existing anti-fraud and gamification behavior.
- Weak proof around the former mock flow.
- Multi-domain.

Hard gates:

- Authorization and public API behavior.

Lane: `high-risk`.

## Work Phases

1. Add contract-first unit, integration, and Flutter tests.
2. Add schema-safe badge seeds and idempotency indexes.
3. Implement notification and gamification services.
4. Wire receipt verification and authenticated API routes.
5. Replace Flutter mock data with API state.
6. Run database, server, Flutter, and Harness validation.

## Stop Conditions

Pause for human confirmation if:

- A badge rule needs data outside the accepted schema.
- OS push delivery or permission behavior becomes required in this slice.
- Validation requires weakening owner scoping, transactionality, or privacy.
