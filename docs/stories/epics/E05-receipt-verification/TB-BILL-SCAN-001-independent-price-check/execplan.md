# Exec Plan

## Goal

Deliver an independent mobile bill-price checking flow backed by Textract,
Bedrock Gemma, branch menu data, and deterministic price comparison.

## Scope

In scope:

- Active branch discovery.
- Private JPG/PNG bill upload and OCR.
- Gemma item-name mapping.
- Item comparison with a 1,000 VND tolerance.
- Owner-scoped API and mobile result UI.

Out of scope:

- Review creation, trust-score mutation, price-history mutation, and
  fee/tax/discount comparison.

## Risk Classification

Risk flags:

- Data model.
- External systems.
- Public contracts.
- Cross-platform.
- Weak provider proof.
- Multi-domain.

Hard gates:

- AWS provider behavior.
- Schema migration.

## Work Phases

1. Add product, API, provider, and schema contracts.
2. Write backend unit/integration tests and mobile service/widget tests.
3. Add migration and provider boundaries.
4. Implement API, persistence, comparison rules, and mobile pages.
5. Run migrations, server tests/build, Flutter tests/analyze, and Android build.
6. Update Harness evidence and trace.

## Stop Conditions

Pause for human confirmation if:

- Branch prices are unavailable and fallback behavior would change.
- A live Bedrock model cannot be invoked in the configured AWS region.
- Validation would require exposing private receipt data.
