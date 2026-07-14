# Admin Route Auth Gate Validation

## Proof Strategy

Build the Next.js client after adding route middleware and client guards. Manual review confirms unsupported operations remain locked and the login form no longer offers a read-only admin bypass.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Not added in this slice; client has no unit test runner configured. |
| Integration | Future browser test should assert `/admin` redirects without cookie and renders only with an authenticated admin session. |
| E2E | Future Cognito web login should prove admin token/session creation and non-admin rejection. |
| Platform | `npm run client:build` covers Next.js route compilation and middleware syntax. |
| Performance | Not applicable. |
| Logs/Audit | Not applicable; no new backend admin action is performed. |

## Fixtures

- Anonymous browser request with no `trustbite_admin_session` cookie.
- Future authenticated admin fixture with Cognito token and `ADMIN` or `SUPER_ADMIN` role.

## Commands

```text
npm run harness -- query matrix
npm run client:build
```

## Acceptance Evidence

- `npm run harness -- query matrix` failed because the local Harness CLI binary is missing.
- `npm install --prefix client` restored missing local client dependencies without committing package changes.
- `npm run client:build` passed after dependencies were present.
- `npm run server:build` passed after adding the protected admin session endpoint.
