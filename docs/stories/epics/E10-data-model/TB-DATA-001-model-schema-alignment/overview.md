# Overview

## Current Behavior

`server/src/models` contains JavaScript data-shape classes, but the set of
classes and several field mappings drift from
`trustbite-docs/06_Database_Design/PostgreSQL_Database_Schema.md`.

## Target Behavior

Server model classes should mirror the accepted PostgreSQL schema table shapes
closely enough to support future persistence work without silently dropping
valid values such as `0` or `false`.

## Affected Users

- Backend engineers implementing persistence and service logic.
- QA engineers comparing runtime data to database documentation.

## Affected Product Docs

- `trustbite-docs/06_Database_Design/PostgreSQL_Database_Schema.md`
- `trustbite-docs/02_Business_Analysis/Status_Mapping.md`
- `docs/ARCHITECTURE.md`

## Non-Goals

- No SQL migration is created.
- No API route, controller, or service behavior is changed.
- No database ownership, retention, uniqueness, or deletion rule is changed.

