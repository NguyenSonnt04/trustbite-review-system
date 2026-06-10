# Exec Plan

## Goal

Add an executable baseline database migration for the documented PostgreSQL
schema.

## Scope

In scope:

- Add SQL migration files under `server/migrations`.
- Add a Node migration runner using `pg`.
- Add npm scripts for running migrations.
- Ensure local Docker PostgreSQL supports PostGIS.
- Validate syntax and run the migration when local infrastructure is available.

Out of scope:

- Seed fixtures.
- Data backfill.
- Production deployment automation.
- ORM adoption.

## Risk Classification

Risk flags:

- Data model.
- Weak proof.

Hard gates:

- Data model.

## Work Phases

1. Discovery.
2. Migration runner.
3. Baseline SQL.
4. Local validation.
5. Documentation update.

## Stop Conditions

Pause for human confirmation if:

- The accepted schema must change.
- Existing local data would need destructive reset.
- Migration proof requires weakening validation.

