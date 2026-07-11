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

2026-07-09 Cognito default-flow correction:

- Added an Amplify Cognito gateway configured from the existing mobile
  `TRUSTBITE_AWS_REGION`, `TRUSTBITE_COGNITO_USER_POOL_ID`, and
  `TRUSTBITE_COGNITO_CLIENT_ID` compile-time settings.
- Removed trusted-local signup as the default `LoginScreen` Cognito fallback.
  Identifier/password now go to Cognito and only the returned access token is
  handed to TrustBite Express.
- Widget proof asserts that the password reaches the Cognito boundary, the
  Cognito access token reaches `MobileAuthService`, and
  `completeLocalDevelopmentSignUp` is not called.
- Negative tests prove blank credentials are rejected before provider calls and
  missing Cognito configuration fails closed.
- `npm run mobile:run` now maps only the non-secret Cognito region, user-pool
  ID, and app-client ID from `server/.env` into Flutter `--dart-define`
  arguments; AWS credentials and other server-only values are excluded.
- `flutter analyze`, all 18 Flutter tests, and
  `flutter build apk --debug --no-pub` passed. Android build emitted only
  forward-looking Gradle, Android Gradle Plugin, and Kotlin compatibility
  warnings.

2026-07-09 Cognito session and challenge hardening:

- Amplify initializes before `runApp`; missing configuration still starts the
  app but authentication fails closed.
- Removed the duplicated Cognito access-token snapshot from
  `AuthSessionStore`. `TrustBiteApiClient` fetches the current Amplify access
  token for every request, allowing the SDK to retain refresh/session
  ownership.
- Kept trusted-local metadata separate and prevented it from being combined
  with Cognito bearer authentication.
- Added UI state for signup confirmation, SMS/TOTP/email MFA codes, and
  Cognito's required-new-password challenge. Provider errors are mapped to
  stable user-safe messages.
- Added contract proof for per-request token reads, backend `401` Cognito
  sign-out, transient backend errors preserving provider sessions, SMS MFA,
  and signup confirmation.
- `flutter analyze`, all 21 Flutter tests, and
  `flutter build apk --debug --no-pub` passed. The APK build retained the
  existing forward-looking Gradle, Android Gradle Plugin, and Kotlin warnings.

2026-07-09 Amplify Cognito config schema correction:

- Mobile now passes Amplify's Cognito plugin schema at
  `auth.plugins.awsCognitoAuthPlugin.CognitoUserPool.Default` with
  `PoolId`, `AppClientId`, and `Region`, rather than the flat
  `auth.aws_region/user_pool_id/user_pool_client_id` shape.
- Added unit proof for the generated configuration JSON.
- Validation passed: targeted Cognito gateway test, `flutter analyze`, full
  mobile test suite, and `flutter build apk --debug --no-pub`. The APK build
  retained the existing forward-looking Gradle, Android Gradle Plugin, and
  Kotlin warnings.

2026-07-10 logout and local signup reuse semantics:

- Wired the signed-in profile "Đăng xuất" action through `HomeScreen` to
  `MobileAuthService.signOut()`, clearing TrustBite local session state,
  signing out of Cognito through the configured session provider, and returning
  the mobile UI to the guest profile state.
- Added widget proof that a signed-in mobile user can open the profile tab,
  tap "Đăng xuất", trigger the auth service sign-out once, and see the guest
  login prompt again.
- Corrected `POST /api/v1/auth/dev/local-signup` so a new local development
  user returns `201 Created`, while reusing an existing `phoneNumber` through
  the upsert conflict branch returns `200 OK`.
- Updated integration proof for the local development signup reuse path,
  including blank `displayName` reuse preserving the existing display name.
- Validation passed: `flutter analyze`; `npm run mobile:test` with 27 tests;
  `npm run server:build`; `npm run test:integration --prefix server` with 13
  files passed, 1 skipped, 102 tests passed, and 2 skipped; Harness story
  verification passed for `TB-AUTH-CLIENT-001`.

2026-07-11 email-first Cognito onboarding correction:

- Mobile now creates a Cognito user for a new email before showing Cognito's
  signup confirmation step, and calls `confirmSignUp` instead of incorrectly
  submitting a signup code as a custom sign-in answer.
- Existing confirmed users continue through Cognito custom auth. Expired codes
  and missing active challenge sessions reset the mobile UI to email entry.
  Existing but unconfirmed users receive a fresh signup confirmation code
  instead of being sent into an invalid custom-auth session.
- Added migration
  `003_make_users_phone_optional_for_cognito_email_signup.sql`. Express now
  provisions a local active `users` row transactionally from a verified Cognito
  `sub`, so the first authenticated `/users/me` request succeeds without a
  phone number.
- Local proof passed: `npm run db:migrate`; `flutter analyze`; `npm run
  mobile:test`; `npm run server:build`; `npm run test:unit --prefix server --
  authService.test.js`; and `npm run test:integration --prefix server --
  userProfile.integration.test.js`. Final proof included 29 Flutter tests, 211
  server unit tests, transactional rollback coverage, and Harness story
  verification.
- Real AWS manual smoke passed in `ap-southeast-1`: the user replaced the
  forced-answer diagnostic with a cryptographically random six-digit custom
  challenge, verified the SES sender identity, granted the Lambda execution
  role scoped `ses:SendEmail`, received the code, and completed login. SES is
  still sandboxed, so non-verified recipients require production access. The
  console-managed Lambda source still needs repository/IaC ownership later.

2026-07-11 backend connection recovery:

- Confirmed the reported post-confirmation failure was a refused connection to
  `10.0.2.2:5000`, after Cognito had already completed authentication.
- Mobile now maps socket/HTTP transport failures to a user-safe `503` message
  instead of allowing an unhandled exception to escape.
- The login screen preserves the completed Cognito session and exposes a
  backend-only retry action, so retrying does not submit the confirmation code
  or invoke Cognito again.
- Added transport and widget regression tests. Local Express `/health` returned
  `{"status":"ok"}` on port `5000` after the server was started.

2026-07-11 auth restore review fixes:

- Home session restore now logs only the exception type and shows a user-safe
  `SnackBar` when the profile backend cannot be reached, instead of silently
  returning an authenticated user to the guest UI.
- Cognito challenge reset now uses Amplify's public `AuthValidationException`
  category scoped to `confirmOtp`, rather than matching SDK message wording.
- `flutter analyze` passed and the targeted auth/widget suite passed 21 tests,
  including provider-wording independence and the restore-failure message.
