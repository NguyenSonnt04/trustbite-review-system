# Exec Plan

## Goal

Define and implement production-ready on-demand review translation using Google Cloud Translation while preserving TrustBite review integrity, provider boundaries, privacy disclosure, and cost controls.

## Scope

In scope:

- Backend route `POST /api/v1/reviews/{reviewId}/translation`.
- Backend service wrapper for Google Cloud Translation.
- Translation cache keyed by `reviewId + targetLocale + sourceTextHash`.
- Client UI state for `Translate`, loading, translated text, `View original`, and provider failure.
- Authorization checks matching review visibility rules.
- Rate limits and provider timeout handling.
- Product, API, OpenAPI, privacy/vendor, and validation documentation.

Out of scope:

- Full app localization/i18n framework.
- Batch translation for all comments in a feed.
- Admin moderation based on translated text.
- Translation for receipts, OCR text, GPS metadata, private notes, or admin-only content.
- Custom glossary or adaptive translation in MVP.

## Risk Classification

Risk flags:

- External systems: Google Cloud Translation provider.
- Public contracts: new API path and response/error schema.
- Audit/security: provider credentials, provider error handling, and UGC exposure.
- Data model: translation cache table and retention behavior.
- Weak proof: no current backend test harness covers provider integrations.

Hard gates:

- External provider behavior.
- Public API shape.
- Data retention/privacy disclosure.

Lane: high-risk.

## Work Phases

1. Discovery: confirm review visibility rules, current route structure, DB migration pattern, env/config pattern, and available test command gaps.
2. Product/API design: update product contract, `API_Specification.md`, `openapi.yaml`, and privacy/vendor docs.
3. Data design: add migration/model for `review_translations` cache.
4. Provider integration: add Google config and service wrapper under `server/src/services/`.
5. Backend route: add controller/route validation, auth/visibility checks, cache lookup, provider call, and stable errors.
6. Client UI: add translate/view-original controls where review comments are rendered.
7. Validation: unit-test service/cache behavior where possible; integration-test route with mocked provider; manually smoke UI failure/cache states.
8. Harness update: record story status and proof when Harness CLI is available.

## Stop Conditions

Pause for human confirmation if:

- Google credentials or project setup are unavailable.
- Product wants translation without user action.
- Product wants translated text to affect moderation, trust, or fraud decisions.
- Privacy/vendor disclosure cannot be updated.
- The implementation would require weakening auth, visibility, rate limit, or provider error handling.
