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
npm run server:build # syntax check only; does not prove backend auth behavior
npm run test:integration --prefix server
# Cognito provider/test-double smoke command to be selected during implementation for signup/login/forgot-password behavior
```

## Acceptance Evidence

2026-07-08 mobile slice:

- Added `MobileAuthService.completeCognitoSignIn` for the Cognito-token handoff to TrustBite Express.
- Added `TrustBiteApiClient` tests proving `Authorization: Bearer <Cognito access token>` on `GET /api/v1/users/me`, backend `401` session clearing, and token-safe error strings.
- Updated the Flutter login entry screen copy away from backend OTP issuance and toward Cognito-owned login/signup.
- `npm run mobile:test` passed locally with 10 tests. The command updated local Flutter transitive lock entries during dependency resolution; those environment-only lock/generated-file changes were not kept in the patch.

2026-07-08 local mobile signup smoke:

- Added a dev-only `POST /api/v1/auth/dev/local-signup` endpoint guarded by non-production `TRUSTBITE_TRUSTED_AUTH_HEADERS=true`.
- Mobile now falls back to that local trusted-auth path when no Cognito client callback is wired, stores trusted-local metadata, and calls `GET /api/v1/users/me` with `x-trustbite-*` headers.
- Android emulator defaults to `http://10.0.2.2:5000` when `TRUSTBITE_API_BASE_URL` is not passed, so local mobile can reach the host Express server.
- Validation passed: `flutter test --no-pub` with 15 tests, server syntax build, server integration suite including `localDevelopmentSignup.integration.test.js`, and `flutter build apk --debug --no-pub`.
