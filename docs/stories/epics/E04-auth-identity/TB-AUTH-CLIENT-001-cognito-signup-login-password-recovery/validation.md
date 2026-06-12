# Validation

## Proof Strategy

Prove clients use Cognito-owned auth flows, Express receives Cognito access tokens only at the business API boundary, and no backend-issued production OTP/JWT/refresh/password-reset path is introduced.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Client/mobile auth service error mapping; token handoff helpers; no raw token/password/OTP logging. |
| Integration | Express accepts valid Cognito access token; rejects missing/invalid/expired/wrong issuer/wrong client id/wrong token use/unmapped/suspended/deleted users. |
| E2E | Signup, login, forgot-password, and protected `/users/me` smoke through Cognito or accepted Cognito-compatible environment. |
| Platform | LocalStack Cognito where available; otherwise AWS sandbox or explicit Cognito-compatible test double with documented limits. |
| Performance | Not required for MVP auth flow beyond avoiding blocking UI states. |
| Logs/Audit | No raw OTP/password/token values in client, server, or provider-boundary logs. |

## Fixtures

- New Cognito user signup.
- Existing Cognito user login.
- Forgot-password request with expired/invalid code.
- Valid Cognito access token for mapped local user.
- Valid Cognito access token for suspended/deleted local user.
- Invalid token variants for issuer, client id, token use, expiry, and signature.

## Commands

```text
npm run client:build
npm run mobile:test
npm run server:build
# Cognito provider/test-double smoke command to be selected during implementation
```

## Acceptance Evidence

TBD after implementation.
