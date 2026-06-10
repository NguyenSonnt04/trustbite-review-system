# Design

## Domain Model

The baseline migration implements the tables documented in
`PostgreSQL_Database_Schema.md`.

## Application Flow

No application request flow changes.

## Interface Contract

No API contract changes.

## Data Model

The migration runner creates `schema_migrations` and applies SQL files from
`server/migrations` in filename order. Each unapplied migration runs inside a
transaction and records its version only after successful execution.

The first migration creates the baseline schema, PostGIS extension, timestamp
trigger, and documented indexes.

## UI / Platform Impact

Local PostgreSQL uses a PostGIS-capable image because the schema uses
`GEOGRAPHY(Point, 4326)`.

## Observability

The migration runner logs applied and skipped migration filenames.

## Alternatives Considered

1. Use an ORM migration tool immediately. Deferred because the current backend
   uses `pg` directly and no ORM has been selected.
2. Keep schema as docs-only. Rejected because local DB-backed work needs real
   tables.

