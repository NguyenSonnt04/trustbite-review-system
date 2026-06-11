# Overview

## Current Behavior

TrustBite does not currently have an implementation story for on-demand review translation. The canonical product/API contract is in `trustbite-docs/04_Software_Engineering/Review_Translation_Feature.md`.

## Target Behavior

Implement the canonical TrustBite review translation contract: users can request a Google Cloud Translation-backed translation for visible review comments, view the translated text, and switch back to the original comment without another provider call.

## Affected Users

- Users reading reviews in a different language.
- Mobile/web clients rendering review comments.
- Backend developers integrating Google Cloud Translation.
- QA validating API, provider fallback, privacy, and cache behavior.

## Affected Product Docs

- `trustbite-docs/04_Software_Engineering/Review_Translation_Feature.md`
- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/04_Software_Engineering/openapi.yaml`
- `trustbite-docs/08_Compliance_and_Privacy/Privacy_Policy.md`
- `trustbite-docs/08_Compliance_and_Privacy/Store_Privacy_Data_Safety_Mapping.md`
- `trustbite-docs/08_Compliance_and_Privacy/Data_Retention_Policy.md`

## Non-Goals

- Replacing review text with translations.
- Auto-translating every comment on page load.
- Using translated text for trust score, fraud scoring, OCR verification, or moderation decisions.
- Calling Google directly from clients.
