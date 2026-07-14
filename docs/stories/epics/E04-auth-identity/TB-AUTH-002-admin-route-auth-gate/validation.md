# Admin Route Auth Gate Validation

## Proof Strategy

Build the Next.js client after adding route middleware and client guards, then run the server syntax check after controller-boundary validation changes. Manual review confirms unsupported operations remain locked, the client does not write bearer-token cookies, and the home page no longer offers a public admin preview bypass.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Not added in this slice; client has no unit test runner configured. |
| Integration | Future browser test should assert `/admin` and `/admin/preview` redirect without cookie and render only with an authenticated admin session. |
| E2E | Future Cognito web login should prove admin token/session creation and non-admin rejection. |
| Platform | `npm run client:build` covers Next.js route compilation and middleware syntax. |
| Performance | Not applicable. |
| Logs/Audit | Not applicable; no new backend admin action is performed. |

## Fixtures

- Anonymous browser request with no `trustbite_admin_session` cookie.
- Future authenticated admin fixture with Cognito token and `ADMIN` or `SUPER_ADMIN` role.
- Admin action request bodies with missing, non-string, over-500-character, and valid `reason` values.

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
- Follow-up security fix: `git diff --check`, `npm run client:build`, and `npm run server:build` passed after removing client-written bearer cookies, protecting nested admin paths, and validating admin action reasons at the controller boundary.
