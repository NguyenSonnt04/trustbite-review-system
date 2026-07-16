# TB-REVIEW-REACTION-001: React to Public Reviews

## Lane

High-risk. This changes authenticated authorization, database schema, public
API output, privacy cleanup, and mobile behavior.

## Acceptance Criteria

- Authenticated users can select only `LOVE`, `HAHA`, or `ANGRY`.
- One `(review_id,user_id)` row exists regardless of retries or replacement.
- The backend ignores any client-provided user identity and uses `req.user.id`.
- Only public verified/reference reviews at active restaurants are reactable.
- Public responses contain aggregate counts and no reacting-user identities.
- Removing a reaction is idempotent.
- Account deletion removes owned reaction data.
- Mobile login-gates mutations, suppresses duplicate requests, updates
  optimistically, and rolls back on failure.

## Decision

`docs/decisions/0029-review-reaction-ownership-and-api.md`

## Validation

- Unit contracts for controller validation, ownership parameters, transaction
  upsert/delete, invalid reaction values, and public aggregates.
- Integration contracts for auth, spoof prevention, replacement, removal,
  private-review denial, and anonymous aggregate output.
- Migration apply plus transaction rollback proof.
- Full server tests/build and Flutter tests/analyze.
