# Design

## Domain Model

TB-AWS-001 is a platform/provider story, not a new product entity story. It
defines the proof contract for provider-backed capabilities that other product
stories use:

- Cognito: auth/token source of truth at the HTTP/auth boundary.
- S3: private object storage for receipt/media evidence.
- Textract: OCR extraction provider for receipts.
- SES: email/message delivery where selected by product stories.
- Bedrock/Claude: review summarization provider where selected by product
  stories.
- LocalStack: local simulation only where the service is supported.

## Application Flow

Provider-backed application code should follow this dependency direction:

```text
route/controller -> service/domain rule -> provider adapter -> config/env
```

Controllers may call services, but must not instantiate AWS SDK clients. Config
modules may read env. Domain rules should receive values or normalized provider
results, not raw `process.env` or raw provider responses.

## Interface Contract

No public API shape is accepted by this plan alone. Existing `server/src/routes/aws.js`
returns `501 ROUTE_NOT_IMPLEMENTED`; changing that route would need a separate
API contract or an explicit acceptance criterion added before implementation.

Provider adapter contracts should be documented at the service boundary:

- required env/config keys,
- normalized input/output shape,
- structured application errors,
- retry/degradation behavior,
- redaction/logging rules,
- proof type: LocalStack, test double, syntax/unit only, or live AWS.

## Data Model

No schema change is planned for TB-AWS-001. If implementation discovers that a
provider result needs a missing table or column, stop and create/update the
relevant high-risk data story before writing fields outside the migration schema.

## UI / Platform Impact

Platform impact is local development and provider smoke verification:

- `docker-compose.yml` starts LocalStack at `localhost:4566`.
- Local env files provide local-only endpoint/credential values.
- Provider smoke proof must clean up temporary buckets/objects/identities where
  the emulator supports them.
- Live AWS proof is out of scope unless the human provides a dedicated
  environment and confirms the risk.

## LocalStack Support Plan

Proof must first query LocalStack health and record the available services.
Expected local strategy:

- S3: prove through LocalStack using temporary names derived from env/test setup.
- Textract: prove adapter mapping and command construction with tests; attempt a
  LocalStack smoke only if the local tier supports the needed API. Do not claim
  `AnalyzeExpense` provider proof from an unsupported emulator.
- Cognito: use Cognito-compatible JWT/JWKS/admin-client test doubles unless the
  local LocalStack tier or live AWS environment supports the exact behavior.
- SES: smoke only if supported locally; otherwise record as a live-AWS or future
  LocalStack-tier gap.
- Bedrock: treat as unsupported locally unless proven otherwise by a configured
  provider environment; use an explicit summarization test double for local
  product tests.

## Observability

Provider errors should emit structured, redacted operational logs only after the
logging surface exists. Audit records remain product records and should not be
substituted with console logs. Never log:

- raw access, ID, or refresh tokens,
- AWS access keys or secrets,
- complete receipt bytes or OCR payloads containing user-sensitive details,
- full provider responses when they may contain PII.

## Alternatives Considered

1. Claim LocalStack as proof for all AWS services. Rejected because existing
   docs already note uneven provider support, especially Cognito and Textract.
2. Use live AWS as the default local proof path. Rejected because this would
   require real credentials and cost-bearing resources for routine development.
3. Let each story document provider proof independently only. Rejected because
   repeated provider gaps need one cross-cutting platform contract.

