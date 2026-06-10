# Exec Plan

## Goal

Align `server/src/models` data-shape classes with the accepted database schema
and status documentation.

## Scope

In scope:

- Add missing model classes for tables present in the schema.
- Update existing model constructors to preserve explicit `0` and `false`
  values.
- Update stale enum comments for review and receipt state fields.
- Validate that all model files import under native ES modules.

Out of scope:

- Creating PostgreSQL tables or migrations.
- Implementing persistence, validation, routes, or services.
- Resolving older `Data_Dictionary.md` / `ERD.md` wording that conflicts with
  the newer schema version.

## Risk Classification

Risk flags:

- Data model.
- Weak proof.
- Multi-domain.

Hard gates:

- Data model.

## Work Phases

1. Discovery.
2. Design.
3. Validation planning.
4. Implementation.
5. Verification.
6. Harness update.

## Stop Conditions

Pause for human confirmation if:

- The implementation requires SQL migration work.
- The accepted schema needs to change instead of the model classes.
- Validation requirements need to be weakened.
- Auth, authorization, retention, or deletion semantics change.

