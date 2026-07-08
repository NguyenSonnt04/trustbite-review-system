# Overview

Story: TB-AWS-001
Lane: high-risk
Epic: E02 Local Development / Provider Foundations

## Current Behavior

Before the first implementation slice, the Harness matrix tracked TB-AWS-001 as
planned with no proof. AWS-related behavior already existed in several narrow
stories, but there was no single story packet that defined the platform/provider
proof contract for LocalStack support, service boundaries, configuration, and
unsupported provider gaps.

As of 2026-07-08, TB-AWS-001 is implemented for the accepted local provider
boundary contract. The verifier proves AWS SDK client placement stays behind
`server/src/config/` or `server/src/services/`, applies the shared endpoint
fallback to the S3 config boundary, exercises S3 and SES through LocalStack
where supported, records Cognito/Textract/Bedrock LocalStack support as
unclaimed provider gaps, and runs targeted Textract/Cognito unit or test-double
proof without claiming live AWS behavior.

Current implementation evidence from source inspection:

- `server/src/config/aws.js` centralizes AWS env-derived config.
- `server/src/services/s3ReceiptStorageService.js` uses S3 for receipt objects.
- `server/src/services/providers/textractProvider.js` instantiates S3/Textract
  clients behind an OCR provider boundary.
- `server/src/services/identityProviders/cognitoProvider.js` owns Cognito auth
  provider behavior.
- `server/src/services/messaging/sesEmailProvider.js` owns the narrow SES
  provider boundary for email send proof.
- `server/src/routes/aws.js` currently returns `501 ROUTE_NOT_IMPLEMENTED`.

## Target Behavior

AWS integrations work locally through LocalStack where supported and are isolated
behind backend config/service boundaries. Unsupported provider behavior is named
explicitly and proven with sanctioned test doubles or deferred to live-AWS proof,
without claiming LocalStack coverage that does not exist.

## Affected Users

- Developers running TrustBite locally.
- Backend maintainers adding provider-backed features.
- QA/release reviewers validating provider behavior.
- Future operators deploying real AWS providers.

## Affected Product Docs

- `docs/product/provider-integrations.md`
- `docs/product/authentication.md`
- `docs/product/verification.md`
- `docs/product/reviews.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_MATRIX.md`

## Acceptance Criteria

1. AWS SDK clients are instantiated only behind `server/src/config/` or
   `server/src/services/`; controllers/routes do not create provider clients.
2. Required provider configuration keys are documented and loaded from env only.
   Source code must not hardcode secrets, credentials, bucket names, pool ids,
   client ids, user ids, or production endpoints.
3. LocalStack proof records exactly which services were exercised locally.
4. S3 local proof covers create/use/delete of a temporary object through the
   same service/config boundary used by application code.
5. Textract proof distinguishes wired adapter syntax/unit coverage from actual
   `AnalyzeExpense` provider proof. If LocalStack cannot prove `AnalyzeExpense`,
   the story records a mock/test-double or live-AWS gap instead of claiming it.
6. Cognito proof follows the accepted Cognito-first boundary. If LocalStack
   cannot prove Cognito APIs, JWT/JWKS/admin behavior remains covered by named
   Cognito-compatible test doubles unless a real AWS or supported LocalStack tier
   is available.
7. SES and Bedrock are documented with their local proof route or explicitly
   listed as unsupported/live-AWS gaps.
8. Provider errors fail closed with structured application errors and do not log
   raw tokens, credentials, receipt bytes, or other sensitive provider payloads.
9. The Harness matrix and story validation notes remain honest about proof type:
   LocalStack, test double, syntax/unit only, or live AWS.

## Non-Goals

- Provisioning real AWS infrastructure.
- Adding production credentials or secrets.
- Replacing Cognito as the auth source of truth.
- Adding new product schema or migrations.
- Building new user-facing AWS routes or UI in this planning step.
- Claiming live Textract, Cognito, SES, or Bedrock behavior without a supported
  provider environment and recorded proof.
