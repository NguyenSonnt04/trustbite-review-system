# Execution Plan

1. Tighten receipt upload validation so GPS evidence is mandatory.
2. Make every non-verified outcome private and exclude it from public review
   APIs and restaurant rating aggregation.
3. Add mobile multipart transport, restaurant loading, review submission,
   receipt selection, GPS capture, and verification polling.
4. Add backend unit/integration proof and Flutter API/widget proof.
5. Run server, mobile, migration, syntax, analyze, and APK validators.

## Rollback

Revert the API validation and publication policy changes together with the
mobile review entry points. No schema migration is required.
