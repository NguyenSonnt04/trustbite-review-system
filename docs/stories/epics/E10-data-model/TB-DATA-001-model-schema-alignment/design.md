# Design

## Domain Model

The model layer remains a set of simple JavaScript classes that represent
database row shapes. These classes do not enforce business rules and are not an
ORM.

## Application Flow

No request flow changes. Future services can instantiate these classes from
database rows or validated DTOs.

## Interface Contract

No public API contract changes.

## Data Model

The source of truth for field names is
`trustbite-docs/06_Database_Design/PostgreSQL_Database_Schema.md` v2.7.0.

No SQL schema, indexes, migrations, retention rules, or rollback behavior are
changed in this story.

## UI / Platform Impact

No client, mobile, or platform-shell impact.

## Observability

No runtime logs or audit records are changed.

## Alternatives Considered

1. Generate model classes from SQL docs automatically. Rejected for this slice
   because the repository currently uses hand-written JavaScript model classes
   and has no generator convention.
2. Add real migrations now. Rejected because the user asked to fix model design,
   and migrations require separate proof against PostgreSQL.

