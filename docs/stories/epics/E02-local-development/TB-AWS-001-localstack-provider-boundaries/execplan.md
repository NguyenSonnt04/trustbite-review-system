# Exec Plan

## Goal

Create the Harness plan for TB-AWS-001 before implementation: define scope,
acceptance criteria, provider proof expectations, LocalStack limits, affected
modules, and the proof-first implementation approach.

## Scope

In scope:

- Cross-cutting AWS provider boundary contract.
- LocalStack proof plan for supported services.
- Explicit unsupported/live-AWS gaps for Cognito, Textract, SES, and Bedrock
  where local support is unavailable or unproven.
- Env/config discipline: no hardcoded secrets, bucket names, credentials, pool
  ids, client ids, user ids, or production endpoints.
- Likely affected files/modules for the future implementation pass.
- Validation commands and proof classification.

Out of scope:

- Production code implementation in this planning step.
- Real AWS provisioning or credential use.
- Public API changes.
- Database schema changes.
- UI/mobile/admin changes.
- Replacing existing provider-specific story proof, such as TB-AUTH-001 or
  TB-FRAUD-001.

## Risk Classification

Risk flags:

- Auth.
- Audit/security.
- External systems.
- Public contracts, if any AWS route/API is introduced later.
- Existing behavior, because receipt OCR, review creation, account deletion, and
  Cognito auth already depend on provider boundaries.
- Weak proof, because TB-AWS-001 currently has no unit, integration, e2e, or
  platform proof.
- Multi-domain, because S3/Textract/SES/Cognito/Bedrock span auth,
  verification, messaging, summarization, and local development.

Hard gates:

- Auth.
- Audit/security.
- External provider behavior.

Lane: high-risk.

## Files / Modules Likely Affected Later

- `docs/product/provider-integrations.md`
- `docs/TEST_MATRIX.md`
- `README.md`
- `docker-compose.yml`
- `server/src/config/aws.js`
- `server/src/routes/aws.js`
- `server/src/services/s3ReceiptStorageService.js`
- `server/src/services/objectStorage.js`
- `server/src/services/providers/textractProvider.js`
- `server/src/services/providers/index.js`
- `server/src/services/identityProviders/cognitoProvider.js`
- `server/tests/unit/config/awsConfig.test.js`
- future LocalStack/provider integration tests under `server/tests/integration/`
- future provider smoke scripts under `scripts/` only if a script is the smallest
  reliable proof surface.

## Work Phases

1. Discovery: read Harness entry docs, architecture/context rules, matrix,
   provider product docs, relevant decisions, and current provider code.
2. Plan: create this high-risk story packet and keep the matrix status planned
   with no proof claimed.
3. Proof-first design: pick the smallest provider proof surface before changing
   production code.
4. Red: add one failing test or smoke assertion for the first provider boundary,
   likely S3 LocalStack/config behavior because it is locally supported and has a
   narrow blast radius.
5. Green: make the smallest code/config change needed for that provider proof.
6. Refactor: consolidate duplicated AWS client config only after tests pass.
7. Expand one provider at a time: Textract, Cognito, SES, and Bedrock each need
   explicit proof classification.
8. Verification: run targeted tests, LocalStack smoke, server build, and Harness
   queries.
9. Harness update: update story validation evidence and matrix only after proof
   exists.

## Stop Conditions

Pause for human confirmation if:

- A public AWS/provider route is proposed.
- A real AWS credential or live AWS account is needed.
- A provider proof would require paid/pro LocalStack features.
- Any validation requirement must be weakened or skipped.
- Any source code change would hardcode provider identifiers or secrets.
- A schema change appears necessary.
- Provider behavior conflicts with accepted decisions for Cognito or receipt OCR.

