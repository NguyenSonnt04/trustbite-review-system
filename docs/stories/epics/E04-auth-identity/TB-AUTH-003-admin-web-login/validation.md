# Validation

## Proof Strategy

Prove that only a Cognito-authenticated identity with a current active local administrator role can obtain and retain a browser session, that the browser never receives Cognito tokens, and that every malformed, expired, revoked, downgraded, or unavailable dependency path fails closed.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Cognito success, client-secret hash, generic invalid credentials, provider challenge, refresh-token revocation, malformed provider result. |
| Unit | Session creation/validation/revocation, malformed Redis state, expiry, TTL bounds, no token persistence, Redis failure. |
| Unit | Active admin/super-admin success; normal user, Cognito-group-only user, suspended/deleted/deletion-pending user, role removal, provider/database failure rejection. |
| Integration | Internal BFF credential required; body/header validation; no-store; login throttling; safe errors; session validation and idempotent logout. |
| E2E | Enabled form, wrong password message, successful login, direct `/admin` rejection without a valid session, verified profile display, logout, forged/expired cookie rejection. |
| Platform | Cognito app client has password auth, revocation, prevented user-existence errors, short access-token lifetime, and server-only secret configuration. |
| Logs/Audit | No password, Cognito token, app-client secret, BFF secret, raw email throttling key, or opaque session marker in logs/storage. |

## Fixtures

- Active local `ADMIN`.
- Active local `SUPER_ADMIN`.
- Active local non-admin user.
- Cognito-group-only administrator claim without local role.
- Suspended, deleted, and deletion-pending local users.
- Valid, malformed, expired, and revoked opaque sessions.
- Cognito invalid-password, unknown-user, challenge, unavailable, and successful responses.
- Redis/database unavailable responses.

## Commands

```text
npm run server:test:unit
npm run server:test:integration
npm run server:build
npm run lint --prefix client
npm run client:build
npm run harness -- story verify TB-AUTH-003-admin-web-login
```

## Acceptance Evidence

Recorded on 2026-07-14:

- `npm run server:build`: passed after merging current `main`, 124 server files parsed successfully.
- `npm run server:test:unit`: passed, 37 files and 368 tests.
- `npm run server:test:integration`: passed, 17 files and 131 tests; 4 provider-dependent tests remain intentionally skipped.
- `npm run lint --prefix client`: passed.
- `npm run client:build`: passed with the protected-route proxy registered as `Proxy (Middleware)`.
- Browser smoke proved anonymous and forged sessions redirect before admin rendering, a temporary database-backed administrator with a real Redis opaque marker reaches `/admin`, and logout revokes the marker and clears the cookie. Temporary smoke records were removed.
- BFF abuse smoke returned `403` for missing and foreign origins, `415` for unsupported content type, and `413` for an oversized chunked request.
- Repeated read-only security reviews found and verified fixes for confidential-client enforcement, refresh-token cleanup, streamed body limits, paginated app-client discovery, provisioning rollback, public error masking, client-address lockout behavior, and spoof-resistant email-wide throttling.
- The local AWS principal was denied `cognito-idp:ListUserPoolClients`, so real provider credential smoke remains blocked. Local dedicated-client values are intentionally empty and login fails closed until an authorized operator runs `CONFIRM_CREATE_ADMIN_COGNITO_CLIENT=true npm run cognito:configure-admin-web --prefix server`.
