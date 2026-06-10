# Validation

## Proof Strategy

Prove registration creates correct user records, profile APIs map fields correctly, invalid input is rejected, and suspended/deleted users cannot mutate profile.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Body validation, field mapping, avatar allowlist validation. |
| Integration | OTP verify creates user; GET me returns profile; PATCH updates display/avatar; SUSPENDED/DELETED update rejected. |
| E2E | Authenticated profile smoke through bearer token. |
| Platform | None beyond backend local env. |
| Performance | Not required. |
| Logs/Audit | No full phone/token logging. |

## Fixtures

- New phone number with no user.
- Active user.
- Suspended user.
- Deleted user.

## Commands

```text
npm run db:migrate
# DB insert/rollback SQL proof for users
# API smoke commands to be added during implementation
```

## Acceptance Evidence

TBD after implementation.
