# Exec Plan

## Goal

Track high-risk implementation work for the canonical review translation contract in `trustbite-docs/04_Software_Engineering/Review_Translation_Feature.md`.

## Scope

In scope:

- Backend API `POST /api/v1/reviews/{reviewId}/translation`.
- Google Cloud Translation service wrapper behind `server/src/services/`.
- Translation cache keyed by `reviewId + targetLocale + sourceTextHash`.
- Client `Dịch` / `Xem bản gốc` UI behavior.
- Privacy/store disclosure and validation evidence.

Out of scope:

- Full app localization.
- Batch translation.
- Translation for OCR, receipt images, GPS, admin notes, or private/deleted content.

## Risk Classification

Risk flags:

- External systems.
- Public contracts.
- Data model.
- Audit/security/privacy.
- Weak proof.

Hard gates:

- External provider behavior.
- Public API shape.
- Data retention/privacy disclosure.

Lane: high-risk.

## Work Phases

1. Confirm Google Cloud project/credential strategy.
2. Add DB migration and cache model.
3. Add backend provider service and route validation.
4. Add client UI controls.
5. Add tests and manual smoke evidence.
6. Update Harness records when CLI is available.

## Stop Conditions

Pause for human confirmation if:

- Credentials or provider terms are unavailable.
- Product wants automatic translation without user action.
- Product wants translated text to affect trust, fraud, or moderation decisions.
- Auth, visibility, privacy, or rate-limit requirements need to be weakened.
