# Overview

## Current Behavior

TrustBite has PostgreSQL schema documentation and JavaScript model classes, but
no executable migration path that creates the application tables in the local
PostgreSQL database.

## Target Behavior

Developers can run a migration command to create the baseline TrustBite
database schema from versioned SQL migration files.

## Affected Users

- Backend developers needing a real local database.
- QA engineers validating database-backed stories.
- Future AI agents implementing persistence.

## Affected Product Docs

- `trustbite-docs/06_Database_Design/PostgreSQL_Database_Schema.md`
- `trustbite-docs/06_Database_Design/Migration_and_Seed_Plan.md`
- `docs/ARCHITECTURE.md`

## Non-Goals

- No seed data.
- No rollback/down migration.
- No repository/service CRUD implementation.
- No API behavior changes.

