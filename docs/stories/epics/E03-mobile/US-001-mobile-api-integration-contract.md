# US-001 Mobile API Integration Contract

## Status

planned

## Lane

normal

## Product Contract

The Flutter mobile app must integrate with the Express backend through documented, mobile-safe API contracts before implementing real receipt OCR, GPS verification, trust scores, or restaurant discovery. Final verification and trust-score decisions remain backend-owned.

## Relevant Product Docs

- `docs/product/README.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_MATRIX.md`

## Acceptance Criteria

- Mobile runtime configuration defines a backend base URL per environment without hardcoding secrets.
- Authenticated mobile requests send a Cognito access token as a backend-accepted bearer token.
- Receipt OCR, GPS verification, restaurant discovery, review creation, and trust-score reads have documented endpoint contracts before implementation.
- Mobile UI may show placeholders, but final trust and verification outcomes must come from backend responses.

## Design Notes

- Commands:
  - `npm run mobile:pubget`
  - `npm run mobile:run`
  - `npm run mobile:test`
- Queries:
  - Restaurant discovery should pass latitude, longitude, radius, filters, and pagination through query parameters.
- API:
  - Cognito signup/login/password recovery is owned by the configured Cognito client flow, not TrustBite Express.
  - `GET /api/v1/users/me`
    - Request: `Authorization: Bearer <Cognito access token>`.
    - Response: current TrustBite user profile from the backend local account mapping.
    - Auth: required; backend rejects missing, invalid, unmapped, suspended, or deleted identities.
  - `GET /api/v1/restaurants/nearby`
    - Query: `northEastLat`, `northEastLng`, `southWestLat`, `southWestLng`, and optional `pageSize` for the visible map viewport.
    - Response: the accepted public restaurant page envelope with coordinate-bearing restaurant summaries.
    - Auth: optional until personalized ranking is introduced.
  - `GET /api/v1/location/search`, `/reverse-geocode`, and `/route`
    - Request: validated search text/coordinate query parameters from `TB-LOCATION-001`.
    - Response: backend-normalized place and route DTOs; mobile does not parse provider-specific payloads.
    - Auth: public read-only.
  - `POST /api/reviews`
    - Request: restaurant ID, rating/content, receipt evidence reference, GPS coordinates, and client timestamp.
    - Response: review state plus backend verification status.
    - Auth: required.
  - `POST /api/aws/upload-url`
    - Request: upload intent and content metadata.
    - Response: presigned S3 upload URL and receipt evidence ID.
    - Auth: required.
  - `POST /api/aws/scan-invoice`
    - Request: receipt evidence ID, restaurant ID, and optional client-side metadata.
    - Response: OCR text summary, merchant/timestamp match status, duplicate status, and verification state.
    - Auth: required.
- Tables:
  - No schema changes in this story.
- Domain rules:
  - OCR merchant threshold, receipt age limit, duplicate hash policy, GPS threshold, and trust-score mutation must be explicit in backend tests before being treated as implemented.
- UI surfaces:
  - Home placeholders may reference OCR/GPS/trust score features only as planned or simulated behavior until backend contracts and validation exist.

## Validation

When updating durable proof status, use numeric booleans:
`npm run harness -- story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

| Layer | Expected proof |
| --- | --- |
| Unit | Mobile API client config parsing once implemented. |
| Integration | Express route contract tests for each mobile endpoint before real UI integration. |
| E2E | Mobile/web smoke flow for login, nearby restaurants, receipt upload, and review creation once implemented. |
| Platform | Flutter runner generation and mobile app launch on at least one target platform. |
| Release | README setup plus environment variable documentation. |

## Harness Delta

Harness CLI is not installed in `scripts/bin/` in this workspace, so no durable story row was added locally.

## Evidence

- Story created to document planned mobile/backend API contract before implementation.
- 2026-07-07 review follow-up added `MobileRuntimeConfig` with API v1 URI normalization, null-query filtering, and Cognito config readiness checks to satisfy the existing Flutter contract test. Local validation remains blocked because `flutter` is not on PATH, so `npm run mobile:test` cannot run on this machine.
- 2026-07-07 review follow-up tightened `MobileRuntimeConfig.hasCognitoConfig` so mobile auth is only enabled when `awsRegion`, `cognitoUserPoolId`, and `cognitoClientId` are all non-empty. Added a Flutter contract test for the missing-region case. Local validation remains blocked because neither `flutter` nor `dart` is on PATH.
- 2026-07-08 added a Flutter backend API client and mobile auth handoff service. `MobileAuthService.completeCognitoSignIn` stores a Cognito access token, calls `GET /api/v1/users/me`, sends `Authorization: Bearer <token>`, clears the session on backend `401`, and avoids backend-issued login/OTP/token flows. `npm run mobile:test` passed locally with 10 tests.
- 2026-07-08 added local mobile signup smoke support for development only. Android emulator defaults to `http://10.0.2.2:5000`; `POST /api/v1/auth/dev/local-signup` creates or reuses a local user only when the backend has `TRUSTBITE_TRUSTED_AUTH_HEADERS=true` outside production, then mobile calls protected APIs with trusted-local headers. Production auth remains Cognito-owned.
