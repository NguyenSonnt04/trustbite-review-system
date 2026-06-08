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
- Authenticated mobile requests send a backend-accepted bearer token once Cognito/JWT auth is implemented.
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
  - `POST /api/auth/login`
    - Request: phone/password or future Cognito token exchange.
    - Response: access token plus user profile.
    - Auth: public.
  - `GET /api/restaurants/nearby`
    - Query: `lat`, `lng`, optional `radiusMeters`, filters, and pagination.
    - Response: restaurant summaries with trust score, menu verification status, and price-deviation flags.
    - Auth: optional until personalized ranking is introduced.
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
`scripts/bin/harness-cli story update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0`.

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
