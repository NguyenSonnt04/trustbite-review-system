# Validation

## Proof Strategy

Prove Cognito identity mapping finds or safely binds the correct local user, profile APIs map fields correctly, invalid input is rejected, and suspended/deleted/active-deletion users cannot mutate profile.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Body validation, field mapping, avatar allowlist validation, active deletion-request mutation guard. |
| Integration | Cognito-sub user mapping; verified-phone transition fallback; unmapped identity rejection; GET me returns profile; PATCH updates display/avatar; SUSPENDED/DELETED update rejected. |
| E2E | Authenticated profile smoke through Cognito bearer token or accepted Cognito-compatible test double. |
| Platform | LocalStack Cognito where available, otherwise explicit Cognito-compatible test double preserving claim semantics. |
| Performance | Not required. |
| Logs/Audit | No full phone/token logging. |

## Fixtures

- Cognito subject with mapped local user.
- Verified-phone transition user with no `cognito_sub`.
- Unmapped Cognito subject.
- Active user.
- Suspended user.
- Deleted user.
- User with active account deletion request.

## Commands

```text
npm run db:migrate
# DB insert/rollback SQL proof for users
# API smoke commands to be added during implementation
```

## Acceptance Evidence

TBD after implementation.
