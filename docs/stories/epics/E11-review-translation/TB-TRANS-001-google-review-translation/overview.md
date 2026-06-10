# Overview

## Current Behavior

TrustBite review comments are displayed in their original language. There is no accepted product contract for on-demand translation, Google Cloud Translation usage, translation caching, or UI toggling between translated and original text.

## Target Behavior

Users can request a translation for a visible review comment. The client shows the original comment first, calls a backend translation endpoint only when the user chooses `Translate`, displays the machine-translated text with an automatic-translation label, and lets the user switch back to the original without another provider call.

The backend uses Google Cloud Translation through a service layer, caches translations by review/comment hash and target locale, and never treats translated text as source data for trust, fraud, or moderation decisions.

## Affected Users

- Users reading reviews in a different language.
- Mobile and web clients rendering review lists/details.
- Backend developers implementing provider integration.
- QA validating provider fallback, cache behavior, and privacy boundaries.

## Affected Product Docs

- `docs/product/review-translation.md`
- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/04_Software_Engineering/openapi.yaml`
- `trustbite-docs/08_Compliance_and_Privacy/Privacy_Policy.md`
- `trustbite-docs/08_Compliance_and_Privacy/Store_Privacy_Data_Safety_Mapping.md`

## Non-Goals

- Automatic translation of every review on page load.
- Storing translated text as the canonical review comment.
- Using translated text in trust score, fraud scoring, OCR verification, or moderation decisions.
- Calling Google Cloud Translation directly from client code.
- Translating hidden, deleted, private, or unauthorized review content.
