# Validation

## Proof Strategy

Prove JWT issuance, refresh rotation, logout revocation, suspended/deleted user rejection, and DB rollback behavior.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | JWT sign/verify config, token hash verify, cookie option generation. |
| Integration | OTP verify creates session; refresh rotates token; replay old refresh fails; logout revokes session; suspended/deleted users cannot refresh. |
| E2E | Authenticated request with access JWT passes; missing/expired token fails. |
| Platform | Local env can run without hardcoded secrets. |
| Performance | Not required for first slice. |
| Logs/Audit | No access token, refresh token, or session token in logs. |

## Fixtures

- Active user.
- Suspended user.
- Deleted user.
- Revoked and expired sessions.

## Commands

```text
npm run db:migrate
# DB insert/rollback SQL proof for users and user_sessions
# API smoke commands to be added during implementation
```

## Acceptance Evidence

TBD after implementation.
