# Validation

## Status

Superseded by decision `0010-cognito-first-auth-boundary`.

## Proof Strategy

No implementation proof should be recorded against the old backend-issued JWT/refresh-session design. Future auth proof must target Cognito JWT verification and local account-state rejection instead.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Future Cognito claim validation and local account-state rules. |
| Integration | Future protected-route auth middleware with Cognito JWTs. |
| E2E | Future client/mobile authenticated requests with Cognito tokens. |
| Platform | Future Cognito-compatible local config. |
| Performance | Not defined here. |
| Logs/Audit | No raw token logging. |

## Commands

```text
TBD by the Cognito-first auth story.
```
