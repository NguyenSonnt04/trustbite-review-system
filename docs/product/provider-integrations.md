# AWS And Local Provider Integrations

## Product Contract

TrustBite uses AWS services through backend service/config boundaries. Controllers and routes must not instantiate provider clients directly.

Planned provider responsibilities:

| Provider | Product use | Boundary |
| --- | --- | --- |
| Cognito | Authentication, token issuance, JWT signing keys, configured signup/login/OTP/MFA behavior | Express auth middleware/authorizer plus identity provider adapter/auth service/config |
| S3 | Receipt/media object storage, including short-lived avatar upload URLs for TrustBite-owned `avatars/` objects | `server/src/services/` and `server/src/config/` |
| Textract | Receipt OCR extraction | OCR/provider service |
| SES / AWS messaging | Email or notification delivery where selected | Messaging/provider service |
| Bedrock/Claude | Review summarization | Summarization/provider service |
| LocalStack | Local simulation where supported | Docker/config only; production must use real provider endpoints |

## Cognito Boundary

Cognito is selected from the start. TrustBite must not build a provider-neutral generic auth/session implementation first and then attach Cognito later.

Express business APIs remain normal backend services. Auth integration happens at the HTTP boundary:

- middleware verifies Cognito JWTs for local Express runs,
- deployed API Gateway may use a Cognito authorizer,
- backend still enforces local user status and product authorization before business services mutate state.

Implementation must keep provider-specific validation explicit: issuer, access-token client id, token use, expiry, signature/JWKS, required claims, and local status mapping.

Cognito verification lives behind the identity provider adapter boundary accepted in `docs/decisions/0011-auth-provider-adapter-boundary.md`. Business services consume normalized `req.user` state rather than provider JWT claims directly. TrustBite-local `user_roles` remains the product-role source of truth; Cognito groups are diagnostics unless a future accepted decision defines role synchronization.

## LocalStack And Test Doubles

LocalStack is configured for local AWS simulation. Cognito coverage may differ from production AWS. When LocalStack cannot prove a Cognito behavior, use an explicit Cognito-compatible test double that preserves the relevant provider semantics for tests. For token verification this means JWT claim and JWKS behavior; for account cleanup this means the real Cognito provider boundary issues global sign-out before admin delete and treats `UserNotFoundException` as idempotent.

The local Docker Compose environment pins `localstack/localstack:4.4.0` instead of `latest` because current `latest` images require a LocalStack auth token before startup. In the current community image, S3 and SES provider smokes are available through `npm run verify:tb-aws-localstack`, but Cognito IdP and Textract are recorded as missing in the LocalStack health output for the accepted TB-AWS-001 proof. Cognito admin cleanup is therefore proven locally with a Cognito-compatible admin client test double unless real AWS smoke or a configured LocalStack auth-token/pro environment is available. Textract has targeted adapter/unit proof but no claimed LocalStack/live `AnalyzeExpense` success. Bedrock has no local/runtime adapter proof yet and must remain an explicit gap until a separate story introduces that boundary.

`npm run verify:tb-aws-localstack` also runs a static AWS SDK provider-boundary audit. The audit fails if AWS SDK provider imports or client instantiation move outside `server/src/config/` or `server/src/services/`.

Rules for local/test provider behavior:

- Never hardcode production provider credentials or secrets.
- Keep bucket names, pool ids, client ids, and endpoints in environment/config examples, not source literals.
- Test doubles must be named as test/local behavior and must fail closed outside allowed environments.
- Do not mark provider behavior implemented until proof names whether it used LocalStack, real AWS, or a test double.

## Provider Proof Expectations

Provider stories must record:

- provider configuration keys required,
- local simulation path,
- positive integration proof,
- negative provider/error path proof,
- logging/audit redaction expectations,
- deployment differences from local proof.

Avatar upload URL proof may use a deterministic signer test double for the signed URL itself, but the object key, bucket, content type, required signed content length, allowlisted cleanup-compatible public URL, and fail-closed validation must be proven through the backend service boundary. Custom CDN or path-style LocalStack avatar hosts must include `/<bucket>/avatars/...` in returned public URLs and must also be accepted by the account-deletion S3 cleanup allowlist so deletion can parse and remove TrustBite-owned avatar objects. Live S3 upload success is not claimed unless a separate provider smoke uploads to the returned URL.

Auth/security/provider work is high-risk unless the human explicitly narrows scope.
