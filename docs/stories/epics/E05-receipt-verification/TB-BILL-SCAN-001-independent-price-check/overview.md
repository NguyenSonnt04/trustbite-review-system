# Overview

## Current Behavior

The mobile home screen displays a `Quét bill` shortcut without navigation.
Receipt OCR exists only for review verification, branch prices are not exposed
to this workflow, and Bedrock has no runtime adapter.

## Target Behavior

An authenticated user selects an active restaurant branch, scans a JPG/PNG
bill, and receives an owner-scoped item-by-item comparison. Gemma maps OCR item
names to the branch menu while backend rules mark price differences above
1,000 VND.

## Affected Users

- Authenticated TrustBite mobile users.

## Affected Product Docs

- `docs/product/bill-price-check.md`
- `docs/product/provider-integrations.md`
- `docs/product/restaurant-discovery.md`
- `docs/product/verification.md`

## Non-Goals

- Creating or verifying a review.
- Updating trust score or price history.
- Comparing taxes, fees, discounts, or final totals.
- Admin correction or merchant dispute workflows.
