# 0031 Independent Bill Price Scan Boundary

Date: 2026-07-20

## Status

Accepted

## Context

The existing receipt lifecycle requires a review and changes verification and
trust state. The new mobile tool only checks whether bill item prices differ
from the selected branch's electronic menu.

## Decision

Create a separate authenticated bill-scan aggregate and API. Require an active
branch, use its available menu prices, use Textract for OCR, and use Bedrock
Gemma only to map normalized item names. Backend arithmetic marks an item as a
price mismatch only when the absolute unit-price difference exceeds 1,000 VND.
The scan does not create a review or mutate trust score or price history.

## Alternatives Considered

1. Reuse `receipt_verifications` with a hidden review.
2. Make `receipt_verifications.review_id` nullable.
3. Let the model make the final price decision.

## Consequences

Positive:

- Keeps review evidence and the checking tool independent.
- Makes numeric decisions deterministic and testable.
- Preserves branch-specific pricing.

Tradeoffs:

- Adds a new schema aggregate and API surface.
- Requires separate retention and provider-cost monitoring follow-up.

## Follow-Up

- Validate the configured Gemma model ID and region in deployment.
- Define time-based retention for completed bill scans before production
  release. Account deletion cleanup is implemented in this story.
