# Product Contract

This folder contains the living product truth for TrustBite. Product docs are not brainstorming notes; they are the expected behavior that implementation and tests should preserve.

## Current Product Summary

TrustBite is a food review platform focused on trustworthy reviews. Its core promise is: **Trust in every bite**.

Users should be able to discover restaurants, inspect trust signals, and submit reviews that can be verified using receipt/OCR evidence and location proximity. The backend, not the client, must own final verification and trust-score decisions once real behavior is implemented.

## Initial Product Areas

Create focused product docs as stories are selected:

| Product area | Suggested doc | Notes |
| --- | --- | --- |
| Restaurant discovery | `docs/product/restaurant-discovery.md` | Search, filters, details, menu/price signals |
| Reviews | `docs/product/reviews.md` | Review creation, states, ownership, editing/deletion |
| Verification / anti-fraud | `docs/product/verification.md` | Receipt hash, OCR, merchant match, timestamp, GPS, evidence |
| Trust score | `docs/product/trust-score.md` | Score inputs, aggregation, visibility, recalculation |
| Authentication | `docs/product/authentication.md` | Cognito sessions, protected actions, user identity |
| AWS/local provider behavior | `docs/product/provider-integrations.md` | S3, Textract, SES, Bedrock, LocalStack support matrix |

## Product Rules For Agents

- Do not invent final business thresholds silently. If a threshold is used, record it in a product doc or story.
- Separate mock/demo behavior from real product behavior.
- Treat verification, trust score, auth, and data persistence as high-risk product areas.
- Update product docs before or with implementation when behavior changes.
- Link relevant product docs from every normal/high-risk story packet.

## Current Known Behavior

- `client/src/app/page.js` contains a mock/simulated restaurant list and anti-fraud flow.
- The simulation currently uses these visible assumptions:
  - merchant similarity threshold: `>= 80%`,
  - receipt age: within `48h`,
  - GPS proximity threshold: `<= 200m`,
  - selected restaurant 3 intentionally fails GPS validation.
- These assumptions are not yet backend-enforced product contracts until accepted in story/product docs and proven by tests.
