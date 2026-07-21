# Validation

## Proof Strategy

TB-INFRA-001 is not done when an IaC file merely exists. It is done only when
the selected non-production AWS environment can be planned, applied after human
approval, smoke-tested, and documented with rollback and cost/security guardrails.

Proof must stay honest by tier:

- Static proof: IaC formatting, validation, policy checks, workflow syntax.
- Plan proof: reviewed `terraform plan` or equivalent with no secret exposure.
- Apply proof: live AWS resources created or updated in the selected
  non-production environment.
- Runtime proof: API, DB, S3, Redis/BullMQ, worker, logs, and rollback surfaces
  are exercised.

LocalStack proof from `TB-AWS-001` can support provider-boundary confidence, but
it cannot close this story's real AWS infrastructure acceptance criteria.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Not product unit tests by default. If helper scripts are added, test config parsing, command construction, redaction, and failure messages. |
| Integration | `npm run db:migrate` against provisioned RDS; S3 receipt storage smoke against private bucket; Redis/BullMQ queue add/process smoke; ECS API and worker runtime smoke. |
| E2E | Optional until a user-visible deploy smoke is selected. Minimum manual/API smoke should call `GET /health` and one safe non-PII backend flow. |
| Platform | IaC `fmt`, `validate`, `plan`, approved `apply`, ECR push, ECS service update, CloudWatch log inspection, rollback or cleanup rehearsal. |
| Performance | No load test required for MVP closeout; confirm task sizes, RDS/cache classes, and scaling defaults are intentionally small and documented. |
| Logs/Audit | Confirm CloudWatch logs redact secrets/tokens/receipt payloads; confirm product audit logs remain in PostgreSQL where application behavior requires them. |

## Fixtures

Use non-production, non-PII fixtures only:

- Environment name: `dev` or `staging`, never production for first proof.
- Test receipt object: small generated text/image fixture without personal data.
- Test review/receipt rows created by existing integration helpers or a dedicated
  smoke fixture, then cleaned up where safe.
- Test BullMQ job with a generated id or a receipt verification id created for
  the smoke run.
- Test image tag with commit SHA or explicit temporary tag.
- AWS tags: environment, service, owner, managed-by, cost-center if available.

Never commit:

- `terraform.tfstate`
- `.terraform/`
- real `*.tfvars`
- plan files
- provider debug logs
- AWS credentials
- database passwords
- Redis auth tokens
- Cognito secrets
- production bucket names or account-specific secret values

## State Backend Validation

Before any live plan/apply, record:

- Terraform backend type and environment.
- Encryption setting.
- Locking mechanism.
- State access principals.
- Where plan artifacts are stored and how they are deleted.
- Whether any secret value is expected to enter state.

If encrypted remote state and locking are not available, stop at local static
validation and do not claim live AWS proof.

## Static Validation Commands

Expected once Terraform files exist:

```text
terraform -chdir=infra/terraform fmt -check -recursive
terraform -chdir=infra/terraform/envs/dev init -backend=false
terraform -chdir=infra/terraform/envs/dev validate
terraform -chdir=infra/terraform/envs/dev plan -refresh=false -input=false
npm run verify:tb-infra-static
git diff --check
npm run harness -- query matrix
```

Optional if tooling is installed:

```text
tflint --chdir=infra/terraform/envs/dev
checkov -d infra/terraform
actionlint .github/workflows/deploy-aws.yml
```

If these optional tools are unavailable, record the blocker and use the
smallest reliable fallback. Do not claim optional proof that was not run.

## Plan Validation Commands

Expected once AWS credentials and backend strategy are approved:

```text
terraform -chdir=infra/terraform/envs/dev init
terraform -chdir=infra/terraform/envs/dev plan -out=tfplan
terraform -chdir=infra/terraform/envs/dev show -no-color tfplan
```

Plan review checklist:

- RDS is private and encrypted.
- RDS backup/deletion-protection defaults match environment policy.
- PostGIS-compatible engine/version is selected.
- S3 public access is blocked and encryption is enabled.
- Redis/cache has no public ingress.
- ECS API and worker task roles are least-privilege and separate where useful.
- API has ingress; worker does not.
- Secrets are referenced, not printed.
- CloudWatch log retention is bounded.
- Resources are tagged.
- Estimated cost is acceptable for the selected environment.
- Plan does not include unapproved delete, replace, destroy, retention weakening,
  deletion-protection weakening, backup weakening, or IAM broadening.
- Plan/state artifacts are stored outside git and handled as sensitive.

## Apply Validation Commands

Run only after explicit human approval:

```text
terraform -chdir=infra/terraform/envs/dev apply tfplan
```

Record:

- AWS account alias/id redacted as needed.
- Region.
- Environment.
- Terraform version.
- Resource summary.
- Apply start/end time.
- Any manual approvals.

## Runtime Smoke Commands

Expected after apply and image deployment. RDS and Redis are private and
security-group limited to ECS task security groups, so migration and live smoke
must run from a VPC-reachable boundary. The preferred path is ECS one-off
Fargate tasks using the API task definition, private subnets, and API task
security group.

```text
npm run server:build
aws ecs run-task ... --overrides '{"containerOverrides":[{"name":"api","command":["npm","run","db:migrate"]}]}'
aws ecs run-task ... --overrides '{"containerOverrides":[{"name":"api","command":["npm","run","smoke:aws-mvp","--","--env","dev"],"environment":[{"name":"TRUSTBITE_API_BASE_URL","value":"<api-url>"},{"name":"TRUSTBITE_SMOKE_NETWORK_CONTEXT","value":"ecs-run-task"}]}]}'
```

For `npm run db:migrate`, the validation record must show that the command used
the selected RDS configuration, not local Docker/Postgres. Record the target
environment, region, redacted host or config source, and the command environment
shape without exposing credentials.

Host-side smoke is acceptable only from an approved bastion/VPN host or an
approved runner security group that can reach the private RDS and Redis security
groups. In that case, export the non-secret `runtime_smoke` values, add
`DATABASE_USER`, `DATABASE_PASSWORD`, and `REDIS_PASSWORD` from the approved
secret source, set `TRUSTBITE_SMOKE_NETWORK_CONTEXT` to `bastion-vpn` or
`runner-security-group`, and then run `node scripts/smoke-aws-mvp.mjs --env dev`.

The final smoke runner may use a different name, but it must prove these
behaviors before the story is implemented:

1. API health endpoint responds through the deployed ingress.
2. API can connect to RDS.
3. `npm run db:migrate` completes against RDS with expected applied/skipped
   migrations.
4. PostGIS extension is present in RDS.
5. S3 receipt object write/read/delete or signed upload flow works with a
   non-PII fixture and no public ACL.
6. Redis/BullMQ connection works.
7. Worker can process a safe test job, or the story records the missing worker
   entrypoint as a blocker.
8. CloudWatch logs exist for API and worker.
9. Logs do not expose secrets, raw tokens, raw receipt bytes, or full OCR payloads.
10. Rollback instructions were exercised or reviewed for ECS task/image rollback.

## GitHub Actions Validation

Expected once deploy workflow exists:

```text
actionlint .github/workflows/aws-infra.yml
```

Workflow proof must show:

- Pull requests can run non-secret validation only.
- Apply/deploy requires manual dispatch or protected environment approval.
- `create_ecs=true` runs a reviewable ECS Terraform plan even when
  `apply=false`; only the apply step remains gated by `apply=true`.
- Forked/untrusted PRs do not receive AWS secrets or deploy role access.
- Image tags are deterministic.
- ECR push and ECS service update are environment-scoped.
- Live ECS creation enables actual private egress through NAT unless a future
  VPC endpoint slice replaces NAT with the required ECR, CloudWatch Logs,
  Secrets Manager, and AWS API endpoints.
- Live ECS task definitions inject required production API config:
  `AWS_COGNITO_USER_POOL_ID`, `AWS_COGNITO_CLIENT_ID`, and `ALLOWED_ORIGINS`.
- ECS task execution role can read Secrets Manager values referenced by
  `container_definitions.secrets`.
- GitHub OIDC trust policy constrains `aud`, repository, ref or protected
  environment, and selected workflow where practical.
- CI/deploy role has no administrator policy, scopes `iam:PassRole` to required
  ECS roles, and documents any Terraform-required IAM exception.
- Live apply requires explicit cost acknowledgement.

## Deploy Phasing

Live Terraform apply is split so ECS does not start before images exist:

1. `create_live_resources=true`, `create_ecs_resources=false`: create platform
   foundations such as network, RDS, S3, Redis, ECR, IAM, and log groups.
2. Build and push API and worker images using the commit SHA tag.
3. `create_live_resources=true`, `create_ecs_resources=true`: create or update
   ECS task definitions, services, and ECS service alarms.

## Harness Closeout Commands

When implementation evidence exists:

```text
npm run harness -- story update --id TB-INFRA-001 --status implemented --unit 0 --integration 1 --e2e 0 --platform 1
npm run harness -- story verify TB-INFRA-001
npm run harness -- query matrix
npm run harness -- trace --summary "<summary>" --story TB-INFRA-001 --outcome completed
```

Do not set `implemented` until live non-production proof exists. Until then,
keep status `planned` or `in_progress`.

## Acceptance Evidence

2026-07-09 planning packet created.

Planning evidence only:

- Story packet created with `overview.md`, `design.md`, `execplan.md`, and
  `validation.md`.
- Harness row should remain `planned` with no unit/integration/e2e/platform
  proof until implementation begins.
- No IaC, credentials, or live AWS resources were added by this planning step.

2026-07-09 IaC skeleton static validation:

- Added `docs/decisions/0017-terraform-aws-infrastructure-baseline.md` and
  registered Harness decision
  `0017-terraform-aws-infrastructure-baseline`.
- Added `infra/terraform` skeleton with `envs/dev`, module boundaries for
  network, RDS, S3 receipts, Redis, ECR, ECS, IAM, and observability, and a
  non-secret `environment_contract` output.
- Added ignored Terraform artifact rules for `.terraform/`, state files, plan
  files, real backend config files, real `tfvars`, override files, and
  Terraform crash/debug logs.
- Added `backend.dev.example.hcl` showing encrypted S3 remote state with
  `use_lockfile = true`; real backend values are not committed. The active
  Terraform backend block is intentionally not enabled until the remote state
  backend is approved for live plan/apply.
- `terraform` and `aws` were not on `PATH` in the Codex PowerShell process.
  Docker fallback was available through Docker Engine 29.2.1.
- Repository `.env` contains `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and
  `AWS_SECRET_ACCESS_KEY`, but those values were not loaded into the Codex
  process and were not printed.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  failed before formatting, listing `envs/dev/main.tf`,
  `modules/ecr/main.tf`, and `modules/s3_receipts/main.tf`.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -recursive`
  formatted those three files.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  passed.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev
  init -backend=false` passed and generated
  `infra/terraform/envs/dev/.terraform.lock.hcl` for AWS provider `6.53.0`.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev validate`
  passed.
- No live `terraform plan`, live `terraform apply`, AWS resource creation, RDS
  migration, ECS deployment, or runtime smoke proof was run. Spreadsheet task
  1.2 remains incomplete.

2026-07-09 network baseline static validation:

- Added guarded Terraform resources in `infra/terraform/modules/network` for
  VPC, public/private subnets, internet gateway, public/private route tables,
  optional NAT gateway, ALB/API/worker/RDS/Redis security groups, and
  least-ingress security group rules.
- Added `public_ingress_cidrs` and `enable_nat_gateway` variables to the dev
  environment. NAT remains disabled by default until cost/runtime egress is
  approved.
- All network resources are guarded by `create_live_resources`; the default
  remains `false`.
- Added non-secret network ids to `environment_contract` for future RDS, Redis,
  and ECS module wiring.
- Removed the active `backend "s3"` block from the skeleton after repeated
  Terraform backend-initialization errors during no-live plan attempts. The
  encrypted S3 backend example remains, but the active backend block must be
  added only after remote state is approved for live plan/apply.
- Researched backend-initialization fixes and chose the safer skeleton approach:
  keep local validation independent from unapproved remote backend state.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  passed.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev
  init -reconfigure` passed with the local backend.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev validate`
  passed.
- A no-live `terraform plan -refresh=false -input=false` with
  `create_live_resources=false` was attempted after local reconfigure. It did
  not show AWS resource creation, but the AWS provider still failed credential
  discovery because credentials are not loaded into the Codex process. This is
  recorded as a live-provider boundary blocker, not as infrastructure proof.
- Secret-pattern scan over changed Terraform/story files returned no matches.
- No live AWS identity check, plan with approved credentials, apply, resource
  creation, RDS migration, ECS deployment, or runtime smoke proof was run.

2026-07-09 RDS baseline static validation:

- Confirmed existing schema bootstrap requires PostgreSQL extensions
  `pgcrypto` and `postgis` in `server/migrations/001_init_schema.sql`.
- Added guarded Terraform resources in `infra/terraform/modules/rds` for a
  private RDS PostgreSQL instance, DB subnet group, and DB parameter group.
- RDS config uses `manage_master_user_password = true`; no database password is
  committed or required in Terraform variables.
- RDS config defaults to PostgreSQL 16 family, private networking only,
  encrypted `gp3` storage, backup retention, CloudWatch PostgreSQL/upgrade log
  exports, copy-tags-to-snapshot, final snapshot on destroy, and deletion
  protection.
- RDS live resources require `module.network.ids.private_subnet_ids` and
  `module.network.ids.rds_security_group_id`, so the DB remains wired to the
  private network baseline rather than public exposure.
- Added non-secret RDS ids and `stores_plaintext_passwords = false` to the
  environment contract output for future ECS/migration wiring.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  passed.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev validate`
  passed.
- `git diff --check` passed with LF/CRLF warnings only.
- No live AWS plan/apply, RDS creation, `npm run db:migrate` against RDS, or
  runtime smoke proof was run. Spreadsheet task 1.2 remains incomplete.

2026-07-09 S3 receipt bucket static validation:

- Confirmed runtime receipt upload uses `AWS_S3_BUCKET_NAME` and object keys
  under the `receipts/` prefix in `server/src/services/s3ReceiptStorageService.js`
  and `server/src/config/aws.js`.
- Added guarded Terraform resources in `infra/terraform/modules/s3_receipts`
  for a private receipt bucket, S3 public access block, ownership controls,
  versioning, server-side encryption, and TLS-only bucket policy.
- Bucket config uses `force_destroy = false` and `prevent_destroy = true`.
- No expiration/delete lifecycle rule was added; receipt retention/lifecycle
  changes remain human-approved future work.
- Bucket ownership is `BucketOwnerEnforced`; ACL-based public access is blocked.
- Server-side encryption uses SSE-S3 (`AES256`) for this static baseline.
- Added optional `receipt_bucket_name_override`; default live behavior uses a
  Terraform-generated suffix instead of committing a globally unique real bucket
  name.
- Added `receipt_object_prefix` defaulting to `receipts/`.
- Added non-secret S3 receipt outputs for bucket name, ARN, domain name, object
  prefix, and runtime env var `AWS_S3_BUCKET_NAME` for future ECS/IAM wiring.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  initially failed on `envs/dev/main.tf`; `terraform fmt -recursive` formatted
  it.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  passed after formatting.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev validate`
  passed.
- Refined secret-pattern scan over changed Terraform/story files returned no
  matches.
- `git diff --check` passed with LF/CRLF warnings only.
- No live AWS plan/apply, S3 bucket creation, receipt object smoke, ECS deploy,
  or runtime proof was run. Spreadsheet task 1.2 remains incomplete.

2026-07-09 Redis/ElastiCache baseline static validation:

- Confirmed runtime queue config uses `REDIS_HOST`, `REDIS_PORT`,
  `REDIS_PASSWORD`, `REDIS_DB`, and `OCR_QUEUE_NAME` in
  `server/src/config/ocr.js`, `receiptOcrQueue.js`, and
  `receiptOcrWorker.js`.
- Added guarded Terraform resources in `infra/terraform/modules/redis` for an
  ElastiCache Redis subnet group, parameter group, and replication group.
- Redis resources are wired to `module.network.ids.private_subnet_ids` and
  `module.network.ids.redis_security_group_id`; public access is not modeled.
- Redis config enables at-rest encryption and transit encryption.
- Redis AUTH token is modeled as a sensitive variable but defaults to null and
  must not be set until remote-state secret handling is explicitly approved.
  Live Redis creation has a precondition requiring an AUTH token, so accidental
  unauthenticated live cache creation is blocked.
- Added non-secret Redis runtime outputs for endpoint, port, security group,
  subnet group, and env var names (`REDIS_HOST`, `REDIS_PORT`,
  `REDIS_PASSWORD`).
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  initially failed on `modules/redis/main.tf`; `terraform fmt -recursive`
  formatted it.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  passed after formatting.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev validate`
  passed.
- Changed-file secret-pattern scan returned no matches.
- `git diff --check` passed with LF/CRLF warnings only.
- No live AWS plan/apply, Redis creation, BullMQ smoke, ECS deploy, or runtime
  proof was run. Spreadsheet task 1.2 remains incomplete.

2026-07-09 ECR repository baseline static validation:

- Confirmed existing container build context includes `server/Dockerfile` for
  the Express API image. Worker image entrypoint remains an ECS/runtime slice
  decision because the current receipt OCR worker lifecycle is owned from
  `server/src/server.js`.
- Added guarded Terraform resources in `infra/terraform/modules/ecr` for API
  and worker ECR repositories.
- ECR repositories default to immutable tags for deterministic commit-SHA image
  promotion.
- ECR scan-on-push is enabled by default.
- ECR encryption uses AES256.
- `force_delete` defaults to false and has a live precondition preventing
  force deletion without a human-approved artifact deletion exception.
- No ECR lifecycle expiration policy was added; image retention/deletion remains
  future work requiring explicit approval.
- Added non-secret ECR outputs for API and worker repository names and URLs for
  future image build and ECS task definition wiring.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  passed.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev validate`
  passed.
- Changed-file secret-pattern scan returned no matches.
- `git diff --check` passed with LF/CRLF warnings only.
- No live AWS plan/apply, ECR repository creation, image build/push, ECS deploy,
  or runtime proof was run. Spreadsheet task 1.2 remains incomplete.

2026-07-09 IAM/ECS task-role baseline static validation:

- Confirmed runtime IAM-sensitive surfaces: S3 receipt access in
  `s3ReceiptStorageService.js`/`textractProvider.js`, database env settings in
  `server/src/config/db.js`, Redis env settings in `server/src/config/ocr.js`,
  and worker startup in `server/src/server.js`.
- Added guarded Terraform resources in `infra/terraform/modules/iam` for ECS
  task execution role, API task role, and worker task role.
- Execution role attaches AWS managed
  `AmazonECSTaskExecutionRolePolicy` for ECR image pull and CloudWatch log
  delivery.
- API task policy scopes S3 access to the receipt bucket prefix only and allows
  runtime secret reads from wired Secrets Manager ARNs.
- Worker task policy scopes S3 read/list to the receipt bucket prefix, allows
  runtime secret reads from wired Secrets Manager ARNs, and grants
  `textract:AnalyzeExpense` with a documented wildcard resource reason because
  the static slice does not have a narrower Textract resource ARN.
- IAM module outputs non-secret execution/API/worker role names and ARNs for
  future ECS task definition wiring.
- Deploy role/OIDC policy was intentionally not added in this slice because
  repository, ref/environment, and workflow trust constraints must be confirmed
  before creating that role.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  passed.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev validate`
  passed.
- Changed-file secret-pattern scan returned no matches.
- `git diff --check` passed with LF/CRLF warnings only.
- No live AWS plan/apply, IAM role creation, ECS deploy, or runtime proof was
  run. Spreadsheet task 1.2 remains incomplete.

2026-07-09 CloudWatch observability baseline static validation:

- Added guarded Terraform resources in `infra/terraform/modules/observability`
  for API and worker CloudWatch log groups.
- Log retention defaults to 30 days and must use a standard CloudWatch
  retention value.
- Added conditional ECS CPU alarms for API and worker services; these activate
  only after ECS cluster/service names are wired by the ECS slice.
- Added conditional RDS free-storage and Redis CPU alarms; these activate only
  when live RDS/Redis identifiers exist.
- Alarm actions are optional ARNs supplied through `cloudwatch_alarm_actions`;
  no notification target is hardcoded.
- Added non-secret observability outputs for log group names, alarm names, and
  manual log-secret inspection reminder.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  initially failed on `modules/observability/main.tf`; `terraform fmt
  -recursive` formatted it.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  passed after formatting.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev validate`
  passed.
- Changed-file secret-pattern scan returned no matches.
- `git diff --check` passed with LF/CRLF warnings only.
- No live AWS plan/apply, CloudWatch log group/alarm creation, ECS deploy, or
  runtime log inspection was run. Spreadsheet task 1.2 remains incomplete.

2026-07-09 ECS runtime baseline static validation:

- Added `server/src/worker.js` as a standalone receipt OCR worker entrypoint so
  the ECS worker service can run `node src/worker.js` without also starting the
  API server.
- Added `npm run worker --prefix server` script.
- Added guarded Terraform resources in `infra/terraform/modules/ecs` for ECS
  cluster, Fargate capacity provider, public API ALB, API target group, HTTP
  listener, API task definition, worker task definition, API service, and worker
  service.
- API task command is `node src/server.js` and sets `OCR_WORKER_ENABLED=false`
  so the API task does not duplicate worker processing.
- Worker task command is `node src/worker.js`.
- API ingress is via ALB only. Worker has no public ingress and uses private
  subnet placement.
- ECS task definitions wire non-secret environment variables for AWS region,
  receipt bucket, RDS host/name, Redis host/port, OCR provider, and queue name.
- ECS task definitions set `REDIS_TLS=true` because the Terraform Redis module
  requires transit encryption.
- ECS task definitions use Secrets Manager references for database credentials
  and optional Redis password rather than hardcoded secrets.
- ECS live creation is gated by deterministic image tag preconditions; default
  `REPLACE_WITH_COMMIT_SHA` cannot create live task definitions.
- ECS task CPU architecture defaults to `X86_64` to match the current
  single-architecture local Docker build unless a multi-arch image pipeline is
  approved.
- ECS live creation is gated by a private-egress precondition; private Fargate
  tasks cannot be created until NAT or required VPC endpoints are explicitly
  approved.
- AWS provider credential validation, metadata lookup, and account-id requests
  are skipped only while `create_live_resources=false`, allowing static
  no-resource plans without real AWS credentials. Live plans still require real
  credentials and approved remote state.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  initially failed on `modules/ecs/main.tf`; `terraform fmt -recursive`
  formatted it.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  passed after formatting.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev validate`
  passed.
- `npm run server:build` passed with syntax check for 105 files.
- `docker build -t trustbite-server:tb-infra-static server` passed; the image
  contains the API and worker entrypoints but was not pushed to ECR.
- Static no-live plan passed with placeholder AWS environment variables and
  `AWS_EC2_METADATA_DISABLED=true`:
  `docker run --rm -v "${PWD}:/workspace" -w /workspace -e
  AWS_ACCESS_KEY_ID=static-placeholder -e
  AWS_SECRET_ACCESS_KEY=static-placeholder -e AWS_EC2_METADATA_DISABLED=true
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev plan
  -refresh=false -input=false -no-color`. The plan produced only
  `environment_contract` output values and no live resource creation.
- Added durable static verify script `scripts/verify-tb-infra-static.mjs` and
  root script `npm run verify:tb-infra-static` covering Docker Terraform
  `fmt`, `init -backend=false`, `validate`, static no-live `plan`,
  `npm run server:build`, Docker image build, and `git diff --check`.
- `npm run verify:tb-infra-static` passed. It confirmed Terraform provider
  initialization from the lock file, static plan output only, server syntax
  check for 105 files, Docker image build, and whitespace check with LF/CRLF
  warnings only.
- Added runtime Redis config support for `REDIS_TLS=true` and unit coverage in
  `server/tests/unit/config/ocrConfig.test.js`. The red test first proved TLS
  was missing; after the fix, the targeted test passed 2 tests.
- Added `scripts/smoke-aws-mvp.mjs` and root script `npm run smoke:aws-mvp`
  for future live smoke after deploy: API health, RDS migration, RDS
  PostGIS/pgcrypto query, S3 receipt fixture write/read/delete, Redis
  set/get/delete, plus a CloudWatch log inspection reminder.
- Added `runbook.md` with live plan gate, apply flow, and least-destructive
  rollback notes for ECS image/task rollback, migration handling, S3/Redis
  smoke cleanup, and Terraform rollback.
- Added `create_ecs_resources` as a second live Terraform gate so ECR can be
  created before images are pushed and ECS services are created.
- Added `infra/terraform/envs/dev/low-cost.dev.tfvars.example` with
  credit-safety defaults: no live creation, no ECS creation, no NAT gateway, no
  private ECS egress, small RDS/Redis classes, one desired API/worker task,
  7-day CloudWatch log retention, RDS deletion protection, and ECR force-delete
  disabled.
- Updated `scripts/verify-tb-infra-static.mjs` so static no-live Terraform plan
  uses `low-cost.dev.tfvars.example`, proving the example stays parseable and
  keeps `create_live_resources=false`.
- Added `.github/workflows/aws-infra.yml` with fork-safe static validation on
  push/PR and manual `workflow_dispatch` live plan/apply through a protected
  GitHub environment and AWS OIDC role. The workflow requires
  `AWS_DEPLOY_ROLE_ARN`, `TF_STATE_BUCKET`, `REDIS_AUTH_TOKEN_SECRET_ARN`, and
  `REDIS_AUTH_TOKEN` from the selected GitHub environment, and requires
  `confirm_live=TB-INFRA-001` plus `cost_ack=TB-COST-ACK` for `apply=true`.
- The live workflow plans foundation resources first, optionally applies them,
  exports ECR repository URLs, pushes API and worker images tagged with
  `github.sha`, then optionally plans/applies ECS resources with
  `create_ecs_resources=true`.
- `.agents/skills/github-actions-validator/scripts/.tools/actionlint.exe
  .github/workflows/aws-infra.yml` passed with no diagnostics. The validator
  wrapper could not run directly because its shell scripts are CRLF in this
  checkout and the installer hit a GitHub rate-limit/HTML response while trying
  to download a second actionlint copy, so the already-installed actionlint
  binary was used as the local validation fallback.
- Changed-file secret-pattern scan returned no matches.
- `git diff --check` passed with LF/CRLF warnings only.
- No live AWS plan/apply, ECS cluster/service creation, image push, deployed
  health check, worker job smoke, or CloudWatch runtime log inspection was run.
  Spreadsheet task 1.2 remains incomplete.

2026-07-09 cost-safety guardrail static validation:

- Added `cost_ack=TB-COST-ACK` workflow dispatch input; `.github/workflows/aws-infra.yml`
  now rejects `apply=true` unless both `confirm_live=TB-INFRA-001` and
  `cost_ack=TB-COST-ACK` are provided.
- Added plan-only notice in the live workflow when `apply=false`, clarifying
  that the workflow will not apply or create paid AWS resources.
- Added `infra/terraform/envs/dev/low-cost.dev.tfvars.example` and wired
  `scripts/verify-tb-infra-static.mjs` to use it for static no-live planning.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -recursive` passed
  after adding the low-cost tfvars example.
- `.agents/skills/github-actions-validator/scripts/.tools/actionlint.exe
  .github/workflows/aws-infra.yml` passed with no diagnostics.
- `npm run test --prefix server -- tests/unit/config/ocrConfig.test.js` passed
  2 tests.
- `node --check scripts/smoke-aws-mvp.mjs` and
  `node --check scripts/verify-tb-infra-static.mjs` passed.
- Initial parallel `npm run verify:tb-infra-static` timed out and left an
  orphan Terraform Docker container running `fmt -check -recursive`; the
  container was inspected and stopped, then `npm run verify:tb-infra-static`
  was rerun by itself and passed in about 41 seconds.
- `npm run harness -- story verify TB-INFRA-001` passed through
  `npm run verify:tb-infra-static`; the static no-live plan output showed
  `create_live_resources_enabled = false`, `enable_nat_gateway = false`,
  `create_ecs_resources` effects as ECS disabled, and CloudWatch retention from
  the low-cost example at 7 days.
- Changed-file secret-pattern scan found only the blank template placeholder
  `server/.env.example: AWS_SECRET_ACCESS_KEY=`; no real access key, secret
  value, private key, database password, or Redis auth token was found.
- `git diff --check` passed with LF/CRLF warnings only through the verify
  script.
- No live AWS plan/apply, AWS resource creation, image push, RDS migration,
  Redis/S3 smoke, ECS deploy, or runtime proof was run. Spreadsheet task 1.2
  remains not done.

2026-07-09 ECS live-path review fix static validation:

- Fixed the live ECS workflow so `create_ecs=true` no longer only flips
  `ecs_private_egress_enabled`; the ECS phase now passes
  `enable_nat_gateway=true`, and ECS task definition preconditions require both
  approved private egress and actual NAT egress because this stack does not yet
  model the required VPC endpoints.
- Added required production runtime config inputs for ECS task definitions:
  `aws_cognito_user_pool_id`, `aws_cognito_client_id`, and `allowed_origins`.
  The API task definition now injects `AWS_COGNITO_USER_POOL_ID`,
  `AWS_COGNITO_CLIENT_ID`, and `ALLOWED_ORIGINS`, and live task definition
  creation fails closed if any are empty.
- Added GitHub environment variable validation for
  `AWS_COGNITO_USER_POOL_ID`, `AWS_COGNITO_CLIENT_ID`, and `ALLOWED_ORIGINS`
  when `create_ecs=true`.
- Added an execution-role inline Secrets Manager read policy for task-definition
  secret injection, separate from API/worker task-role runtime secret access.
- Injected the Redis auth secret into the API task as `REDIS_PASSWORD` so API
  receipt upload enqueue paths can connect to authenticated Redis.
- Docker initially failed twice with
  `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`;
  after checking common fixes, Docker Desktop was started and `docker version`
  confirmed Docker Desktop 4.64.0 / Engine 29.2.1 was available.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -recursive` passed and
  formatted `modules/ecs/main.tf`.
- `.agents/skills/github-actions-validator/scripts/.tools/actionlint.exe
  .github/workflows/aws-infra.yml` passed with no diagnostics.
- `npm run server:build` passed with syntax check for 105 files.
- `npm run test --prefix server -- tests/unit/config/ocrConfig.test.js` passed
  1 file / 2 tests.
- `node --check scripts/smoke-aws-mvp.mjs` and
  `node --check scripts/verify-tb-infra-static.mjs` passed.
- `npm run verify:tb-infra-static` passed: Terraform `fmt -check`,
  `init -backend=false`, `validate`, static no-live `plan` using
  `low-cost.dev.tfvars.example`, `server:build`, server Docker image build, and
  `git diff --check` all completed. The first rerun exposed that Terraform
  `coalesce(null, "")` is invalid because empty strings are skipped; the ECS
  production config fallbacks were changed to explicit null conditionals before
  the final pass.
- No live AWS plan/apply, AWS resource creation, image push, deployed API
  health check, RDS migration, Redis/S3 smoke, ECS deploy, or CloudWatch runtime
  log inspection was run. Spreadsheet task 1.2 remains not done.

2026-07-09 durable-state and CI diff review fix static validation:

- Declared the `backend "s3" {}` block in
  `infra/terraform/envs/dev/versions.tf` so the live workflow
  `terraform init -backend-config=/runner-temp/backend.hcl` binds to the
  approved encrypted S3 backend instead of falling back to ephemeral local
  state.
- Kept cost-safe static proof by updating `scripts/verify-tb-infra-static.mjs`
  to validate the real live-backend config, then copy `infra/terraform` into a
  temporary workspace, remove only the S3 backend declaration in that temp copy,
  and run the no-live plan with `low-cost.dev.tfvars.example`.
- Passed the configured `redis_port` into the network module and used it for
  both Redis security group ingress rules, keeping ElastiCache port, ECS
  `REDIS_PORT`, and security rules aligned for non-default Redis ports.
- Updated CI whitespace validation so GitHub pull requests check the committed
  diff from the PR base merge-base to `HEAD`, push/other CI events check the
  `HEAD` commit with `git diff-tree --check`, and local dirty runs still check
  working-tree and staged diffs.
- Updated the AWS infra workflow static checkout to `fetch-depth: 0` so PR
  merge-base calculation has the commit history it needs.
- `.agents/skills/github-actions-validator/scripts/validate_workflow.sh
  --lint-only .github/workflows/aws-infra.yml` could not run in this Windows
  checkout because the skill script itself has CRLF shell line endings; the
  fallback `.agents/skills/github-actions-validator/scripts/.tools/actionlint.exe
  .github/workflows/aws-infra.yml` passed with no diagnostics.
- `node --check scripts/verify-tb-infra-static.mjs` passed.
- `npm run verify:tb-infra-static` passed after Terraform formatting:
  Terraform `fmt -check`, `init -backend=false`, `validate`, temp-workspace
  static no-live `plan` using `low-cost.dev.tfvars.example`, `server:build`
  for 105 files, server Docker image build, and local working-tree/staged
  whitespace checks all completed.
 - No live AWS plan/apply, AWS resource creation, image push, deployed API
   health check, RDS migration, Redis/S3 smoke, ECS deploy, or CloudWatch runtime
   log inspection was run. Spreadsheet task 1.2 remains not done.

2026-07-09 live smoke handoff review fix static validation:

- Updated `scripts/smoke-aws-mvp.mjs` so the live smoke required-env gate now
  requires `REDIS_PASSWORD` and `REDIS_TLS`, and fails before network access when
  `REDIS_TLS` is not exactly `true`.
- Exposed `ecs_ids` from the top-level
  `terraform output -json environment_contract`, including API ALB DNS, ECS
  cluster/service names, and API/worker task definition ARNs for deploy
  verification handoff.
  - Added a non-secret `runtime_smoke` map to `environment_contract` for smoke
    handoff values: `TRUSTBITE_API_BASE_URL`, `DATABASE_HOST`, `DATABASE_NAME`,
    `AWS_REGION`, `AWS_S3_BUCKET_NAME`, `REDIS_HOST`, `REDIS_PORT`, and
    `REDIS_TLS`. Secret values such as `DATABASE_PASSWORD` and `REDIS_PASSWORD`
    remain outside Terraform output.
- Updated the Terraform README and runbook to pull endpoint-style values from
  `environment_contract.runtime_smoke` and add DB/Redis secrets from the
  approved secret source before running the live smoke.
- `node --check scripts/smoke-aws-mvp.mjs` passed.
- Negative smoke config proof passed: with all other required env vars present
  and `REDIS_TLS=false`, `node scripts/smoke-aws-mvp.mjs --env dev` exited 1
  before network access with `REDIS_TLS must be set to true for live ElastiCache
  Redis smoke.`
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -recursive` formatted
  `envs/dev/outputs.tf`; rerun `fmt -check -recursive` passed.
- `npm run verify:tb-infra-static` passed: Terraform `fmt -check`,
  `init -backend=false`, `validate`, temp-workspace static no-live `plan` using
  `low-cost.dev.tfvars.example`, `server:build` for 105 files, server Docker
  image build, and local working-tree/staged whitespace checks all completed.
  The static plan showed `ecs_ids` and `runtime_smoke` in
  `environment_contract`, with no live resource creation.
- `npm run harness -- story verify TB-INFRA-001` passed through
  `npm run verify:tb-infra-static`.
  - No live AWS plan/apply, AWS resource creation, image push, deployed API
    health check, RDS migration, Redis/S3 smoke, ECS deploy, or CloudWatch runtime
    log inspection was run. Spreadsheet task 1.2 remains not done.

2026-07-09 live-operation review fixes static validation:

- Added an explicit `depends_on = [aws_internet_gateway.this]` to the network
  module NAT gateway so the live ECS/NAT phase cannot race IGW attachment.
- Made the live workflow ECR image step idempotent for immutable repositories:
  it now checks `describe-images` for the API and worker `GITHUB_SHA` tags,
  skips pushes for tags that already exist, and only builds/tags/pushes missing
  images.
- Completed the smoke handoff contract: `environment_contract.runtime_smoke`
  now includes `DATABASE_NAME`, and the Terraform README/runbook document
  exporting every non-secret `runtime_smoke` value before adding DB/Redis
  secrets.
- Changed the Redis AUTH token update default from hardcoded `ROTATE` to
  configurable `SET`, so token changes revoke the previous Redis token by
  default. `ROTATE` remains available only as an explicit temporary operator
  choice that must be followed by `SET`.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -recursive` formatted
  `envs/dev/main.tf`, `envs/dev/outputs.tf`, and `modules/redis/main.tf`.
- `.agents/skills/github-actions-validator/scripts/.tools/actionlint.exe
  .github/workflows/aws-infra.yml` passed with no diagnostics. The validator
  wrapper was attempted and still failed on CRLF shell-script line endings with
  `$'\r': command not found`, so the direct `actionlint.exe` fallback was used.
- `node --check scripts/smoke-aws-mvp.mjs` and
  `node --check scripts/verify-tb-infra-static.mjs` passed.
- `npm run test --prefix server -- tests/unit/config/ocrConfig.test.js` passed
  1 file / 2 tests.
- Negative smoke config proof passed: with all other required env vars present
  and `REDIS_TLS=false`, `node scripts/smoke-aws-mvp.mjs --env dev` exited 1
  before network access with `REDIS_TLS must be set to true for live
  ElastiCache Redis smoke.`
- `npm run verify:tb-infra-static` passed: Terraform `fmt -check`,
  `init -backend=false`, `validate`, temp-workspace static no-live `plan` using
  `low-cost.dev.tfvars.example`, `server:build` for 105 files, server Docker
  image build, and local working-tree/staged whitespace checks all completed.
  The static plan showed `runtime_smoke.DATABASE_NAME = "trustbite"`,
  `redis_ids.auth_token_update_strategy = "SET"`, and no live resource
  creation.
- No live AWS plan/apply, AWS resource creation, image push, deployed API
  health check, RDS migration, Redis/S3 smoke, ECS deploy, or CloudWatch runtime
  log inspection was run. Spreadsheet task 1.2 remains not done.

2026-07-09 accepted Codex review follow-up static validation:

- Split the live ECS workflow phase so `create_ecs=true` runs the ECS Terraform
  plan even when `apply=false`; ECS apply, ECR output export, and image push
  remain gated by `apply=true`.
- Added `scripts/export-terraform-ecr-env.mjs` so the live workflow can export
  ECR repository URLs without embedding JSON parsing in fragile workflow shell.
- Moved the live smoke runner into `server/scripts/smoke-aws-mvp.mjs` and kept
  `scripts/smoke-aws-mvp.mjs` as a root wrapper. The server image now copies
  `server/scripts` and `server/migrations`, and `server/package.json` exposes
  `npm run smoke:aws-mvp` for ECS one-off tasks.
- Updated the Terraform README, story runbook, validation expectations, and test
  matrix so live migration/smoke proof runs from a VPC-reachable boundary by
  default: ECS one-off tasks using the API task definition, private subnets, and
  API task security group. Host-side smoke is documented only for an approved
  bastion/VPN or runner security-group path.
- The smoke runner now requires `TRUSTBITE_SMOKE_NETWORK_CONTEXT` to be
  `ecs-run-task`, `bastion-vpn`, or `runner-security-group`, preventing ordinary
  host-side RDS/Redis smoke from being implied.
- `.agents/skills/github-actions-validator/scripts/.tools/actionlint.exe
  .github/workflows/aws-infra.yml` passed with no diagnostics.
- `node --check scripts/smoke-aws-mvp.mjs`,
  `node --check server/scripts/smoke-aws-mvp.mjs`,
  `node --check scripts/export-terraform-ecr-env.mjs`, and
  `node --check scripts/verify-tb-infra-static.mjs` passed.
- Negative smoke config proof passed twice before network access: missing
  `TRUSTBITE_SMOKE_NETWORK_CONTEXT` exited 1 with the missing-env message, and
  `TRUSTBITE_SMOKE_NETWORK_CONTEXT=ecs-run-task` with `REDIS_TLS=false` exited 1
  with the live Redis TLS requirement.
- `npm run server:build` passed with syntax check for 105 files.
- `npm run test --prefix server -- tests/unit/config/ocrConfig.test.js` passed
  1 file / 2 tests.
- `srcwalk review --scope .` passed as source-evidence navigation over the dirty
  working tree.
- Targeted text checks confirmed the workflow has `Plan ECS resources` gated on
  `inputs.create_ecs == true`, ECS apply/image-push still gated on
  `inputs.apply == true && inputs.create_ecs == true`, and docs/script references
  for the VPC-reachable smoke path and network-context guard.
- No live AWS plan/apply, AWS resource creation, image push, deployed API health
  check, RDS migration, Redis/S3 smoke, ECS deploy, or CloudWatch runtime log
  inspection was run. Spreadsheet task 1.2 remains not done.

2026-07-09 Terraform live-plan count review fix static validation:

- Fixed ECS secret-policy Terraform counts in `infra/terraform/modules/iam` so
  `data.aws_iam_policy_document.execution_secrets` and
  `aws_iam_role_policy.execution_secrets` are gated by the plan-known
  `task_secret_policy_enabled` input instead of `length(local.task_secret_arns)`.
  The policy document may still contain apply-time RDS secret ARNs as resource
  attributes, but Terraform no longer needs those unknown values to determine
  resource instance count.
- Fixed Redis observability gating in `infra/terraform/modules/observability` so
  `aws_cloudwatch_metric_alarm.redis_cpu_high` is gated by the plan-known
  `redis_alarms_enabled` input instead of `var.redis_replication_group_id != null`.
  The dev environment now passes `redis_alarms_enabled = var.redis_node_count > 0`
  and the deterministic replication group dimension
  `redis_replication_group_id = "${local.name_prefix}-redis"`.
- Targeted text verification found no remaining
  `length(local.task_secret_arns) > 0` or
  `var.redis_replication_group_id != null` Terraform count gates under
  `infra/terraform`.
- Local `terraform` was not on PATH in the Codex PowerShell process. Docker was
  available with Engine 29.2.1, so Terraform proof used
  `hashicorp/terraform:1.14.5`.
- `node --check scripts/verify-tb-infra-static.mjs` passed.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive`
  passed.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev
  init -backend=false` passed.
- `docker run --rm -v "${PWD}:/workspace" -w /workspace
  hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev validate` passed.
- `npm run verify:tb-infra-static` passed. The static no-live plan showed
  `secret_policy_gate = "create_live_resources_and_task_secret_policy_enabled"`
  under the IAM contract and `redis_alarms_enabled = true` under the
  observability contract while `create_live_resources_enabled = false`; no live
  resources were planned. The verifier also passed `server:build` for 105 files,
  server Docker image build, and working-tree/staged whitespace checks with only
  LF/CRLF warnings.
- `srcwalk review --scope .` passed as source-evidence navigation over the dirty
  working tree; it is not runtime proof.
- No live AWS plan/apply, AWS resource creation, image push, deployed API health
  check, RDS migration, Redis/S3 smoke, ECS deploy, or CloudWatch runtime log
  inspection was run. Spreadsheet task 1.2 remains not done.

2026-07-09 Redis TLS-only review fix static validation:

- Updated `infra/terraform/modules/redis/main.tf` so live ElastiCache Redis sets
  `transit_encryption_mode = "required"` in addition to
  `transit_encryption_enabled = true`, matching the module contract and ECS
  runtime expectation that `REDIS_TLS=true` is mandatory.
- Static proof was rerun after the patch; no live AWS plan/apply, AWS resource
  creation, image push, deployed API health check, RDS migration, Redis/S3
  smoke, ECS deploy, or CloudWatch runtime log inspection was run. Spreadsheet
  task 1.2 remains not done.

2026-07-09 ECS API avatar/runtime filter review fix static validation:

- Added `server/Dockerfile`, `server/scripts/**`, and `server/migrations/**` to
  `.github/workflows/aws-infra.yml` push and pull-request filters so future
  changes to the Docker image, ECS one-off smoke runner, or bundled migrations
  trigger the infrastructure static workflow.
- Updated the ECS API task definition to set `TRUSTBITE_AVATAR_ALLOWED_HOSTS`
  from the S3 bucket domain and fail live ECS task creation if the bucket domain
  is missing. This keeps the existing authenticated
  `/api/v1/users/me/avatar-upload-url` endpoint from deploying with an empty
  avatar host list.
- Updated the API task IAM policy to allow `s3:PutObject` for `avatars/*`, so
  presigned avatar upload URLs are backed by role permissions for the key prefix
  produced by `AvatarUploadService`.
- Static proof was rerun after the patch; no live AWS plan/apply, AWS resource
  creation, image push, deployed API health check, RDS migration, Redis/S3
 smoke, ECS deploy, or CloudWatch runtime log inspection was run. Spreadsheet
 task 1.2 remains not done.

2026-07-09 ECS IAM dependency review fix static validation:

- Added an explicit `depends_on = [module.iam]` edge to the dev
  `module "ecs"` call so live ECS task definitions and services wait for the
  IAM module's role attachments and inline policies, not only the role ARN
  outputs.
- Static proof was rerun after the patch: `npm run verify:tb-infra-static`,
  `npm run test --prefix server -- tests/unit/config/ocrConfig.test.js`,
  `npm run harness -- story verify TB-INFRA-001`, and
  `codex review --uncommitted` passed. No live AWS plan/apply, AWS resource
  creation, image push, deployed API health check, RDS migration, Redis/S3
  smoke, ECS deploy, or CloudWatch runtime log inspection was run. Spreadsheet
  task 1.2 remains not done.

2026-07-09 RDS SSL review fix static validation:

- Added shared database SSL env parsing in `server/src/config/dbSsl.js` and
  wired it into the API `pg.Pool`, migration runner, and live AWS smoke runner.
  Local development remains non-SSL by default, while `DATABASE_SSL=true` or
  `PGSSLMODE=require` enables TLS for live RDS.
- Added `DATABASE_SSL=true` to the ECS task environment and
  `environment_contract.runtime_smoke`, and documented that alternative
  bastion/VPN or runner-security-group smoke paths must export it.
- Added unit coverage for default local non-SSL, `DATABASE_SSL=true`,
  `PGSSLMODE=require`, explicit no-verify override, and local disable override.
- Static proof was rerun after the patch; no live AWS plan/apply, AWS resource
  creation, image push, deployed API health check, RDS migration, Redis/S3
  smoke, ECS deploy, or CloudWatch runtime log inspection was run. Spreadsheet
  task 1.2 remains not done.

2026-07-09 API TLS and S3 upload CORS review fix static validation:

- Changed the public ALB API listener model so port 80 redirects to HTTPS and
  the forwarding listener is HTTPS on port 443 with an explicit
  `api_certificate_arn` / `API_CERTIFICATE_ARN` requirement before live ECS
  resources can be created.
- Added S3 bucket CORS configuration for browser presigned PUT uploads, using
  the approved `ALLOWED_ORIGINS` list for receipt/avatar object uploads and
  exposing `ETag` for upload clients.
- Updated the live GitHub Actions deployment input checks and Terraform vars so
  foundation resources receive `allowed_origins` for S3 CORS and ECS resources
  require `API_CERTIFICATE_ARN`.
- Static proof was rerun after the patch; no live AWS plan/apply, AWS resource
  creation, image push, deployed API health check, RDS migration, Redis/S3
  smoke, ECS deploy, or CloudWatch runtime log inspection was run. Spreadsheet
  task 1.2 remains not done.

2026-07-09 PR #41 Greptile/CI review fix static validation:

- Removed `s3:DeleteObject` from the API task role receipt object policy so API
  runtime can read/write receipt evidence but cannot delete anti-fraud receipt
  objects. Avatar upload still has its separate `s3:PutObject` prefix grant.
- Added explicit Redis AUTH plaintext-in-state approval gates:
  `redis_auth_token_state_approved` in Terraform and
  `redis_secret_state_approved=true` in the live workflow. The no-live static
  plan showed `redis.state_secret_approval = false` and
  `redis_ids.auth_token_state_approved = false`.
- Updated the decision, Terraform README, story runbook, and low-cost tfvars
  example to record the Redis AUTH state exception, state-access boundary, and
  rotation approval requirement before live Redis plan/apply.
- Fixed `scripts/verify-tb-infra-static.mjs` so Linux CI runs Terraform Docker
  containers as the runner UID/GID with `HOME=/tmp`, preventing root-owned temp
  workspace files from causing `EACCES` cleanup failures.
- Added `DATABASE_SSL_REJECT_UNAUTHORIZED=true` to `server/.env.example`.
- Added red/green unit proof for `REDIS_TLS=1`; the red run failed because TLS
  was not enabled, then the config helper was changed to accept `1`, `true`,
  `yes`, and `on`.
- Validation passed:
  `.agents/skills/github-actions-validator/scripts/.tools/actionlint.exe
  .github/workflows/aws-infra.yml`; `node --check
  scripts/verify-tb-infra-static.mjs`; `npm run test --prefix server --
  tests/unit/config/dbSsl.test.js tests/unit/config/ocrConfig.test.js` (2 files
  / 9 tests); and
  `npm run verify:tb-infra-static` with Terraform `fmt -check`,
  `init -backend=false`, `validate`, temp-workspace no-live plan,
  `server:build` syntax check for 106 files, server Docker image build, and
  git whitespace checks.
- Follow-up Greptile 4/5 items were also addressed: the AWS static workflow now
  runs `dbSsl.test.js` alongside `ocrConfig.test.js`, and worker shutdown catches
  `disconnectDB()` errors after SIGINT/SIGTERM so shutdown cannot hang on a DB
  disconnect failure.
- Follow-up Greptile 3/5 items were also addressed: `DATABASE_SSL` now throws on
  unrecognized values instead of silently disabling TLS, with red/green unit
  proof; API and worker ECS task definitions now fail live planning when
  `database_secret_arn` is missing, so containers cannot start without
  `DATABASE_USER` / `DATABASE_PASSWORD` injection.
- No live AWS plan/apply, AWS resource creation, image push, deployed API health
  check, RDS migration, Redis/S3 smoke, ECS deploy, or CloudWatch runtime log
  inspection was run. Spreadsheet task 1.2 remains not done.

2026-07-10 PR #41 Redis secret precondition follow-up static validation:

- Added `redis_auth_secret_arn` lifecycle preconditions to both API and worker
  ECS task definitions, so live ECS planning fails before either container can
  start without `REDIS_PASSWORD` injection for the Redis AUTH/TLS runtime.
- Confirmed the two remaining Greptile review threads on PR #41 were the API
  and worker Redis secret precondition comments. Earlier review threads were
  already resolved before this follow-up patch.
- Validation passed:
  `.agents/skills/github-actions-validator/scripts/.tools/actionlint.exe
  .github/workflows/aws-infra.yml`; `srcwalk review --scope .`;
  `npm run test --prefix server --
  tests/unit/config/dbSsl.test.js tests/unit/config/ocrConfig.test.js` (2 files
  / 9 tests); `npm run verify:tb-infra-static` with Terraform
  fmt/init/validate/no-live plan, `server:build` syntax check for 106 files,
  server Docker image build, and git whitespace checks; and
  `npm run harness -- story verify TB-INFRA-001`.
- No live AWS plan/apply, AWS resource creation, image push, deployed API health
  check, RDS migration, Redis/S3 smoke, ECS deploy, or CloudWatch runtime log
  inspection was run. Spreadsheet task 1.2 remains not done.

2026-07-10 PR #41 Codex closeout static validation:

- Added `rds.force_ssl = 1` to the RDS PostgreSQL parameter group and set
  `apply_method = "pending-reboot"` so live RDS enforces TLS without Terraform
  attempting an invalid immediate static-parameter apply.
- Removed `secretsmanager:GetSecretValue` from the API and worker task roles.
  ECS secret injection remains scoped to the execution role through the existing
  `execution_secrets` policy.
- Replaced the worker shutdown `.catch(() => {})` cleanup calls with logged
  shutdown steps and a non-zero exit code when OCR worker, queue, or database
  cleanup fails.
- Kept the API avatar S3 grant upload-only (`s3:PutObject` on `avatars/*`).
  Codex review rejected adding `s3:GetObject` because the current avatar service
  only presigns `PutObjectCommand`; no bounded avatar-read call path exists in
  this slice.
- Validation passed:
  `.agents/skills/github-actions-validator/scripts/.tools/actionlint.exe
  .github/workflows/aws-infra.yml`; `node --check
  scripts/verify-tb-infra-static.mjs`; `npm run test --prefix server --
  tests/unit/config/dbSsl.test.js tests/unit/config/ocrConfig.test.js` (2 files
  / 9 tests); `npm run server:build` (106 files); `srcwalk review --scope .`;
  `npm run verify:tb-infra-static` with Terraform fmt/init/validate/no-live
  plan, `server:build`, server Docker image build, and git whitespace checks;
  and final `codex review --uncommitted`, which reported no blocking
  correctness issues.
- No live AWS plan/apply, AWS resource creation, image push, deployed API health
  check, RDS migration, Redis/S3 smoke, ECS deploy, or CloudWatch runtime log
  inspection was run. Spreadsheet task 1.2 remains not done.

Future implementation evidence must be appended here after each slice. Use
concrete commands, dates, counts, environment, and proof classification.

2026-07-21 live dev ECS RDS CA startup regression:

- The approved `dev` foundation and ECS phases applied successfully in
  `ap-southeast-1`, and the API/worker images were pushed with a deterministic
  commit tag. Both ECS services remained `ACTIVE` with desired count 1 but
  running count 0.
- ECS service events showed repeated task startup failures. CloudWatch groups
  `/aws/ecs/trustbite-dev/api` and `/aws/ecs/trustbite-dev/worker` consistently
  logged `self-signed certificate in certificate chain` before either runtime
  could stay up.
- Root cause: the production task definitions correctly required
  `DATABASE_SSL=true` with certificate verification, but the Node Alpine server
  image did not package the AWS RDS CA chain. The fix keeps verification enabled,
  downloads the AWS-published global RDS bundle during the image build, verifies
  that the download contains a PEM certificate, and exposes it to Node through
  `NODE_EXTRA_CA_CERTS`.
- Static verification now fails if the server Dockerfile loses the AWS RDS
  truststore URL, `NODE_EXTRA_CA_CERTS`, or PEM-content check. Live recovery
  proof remains pending a new image build/push, ECS task-definition deployment,
  API/worker running-count check, RDS migration, and smoke test.
- Local validation passed: `node --check scripts/verify-tb-infra-static.mjs`;
  `npm run test --prefix server -- tests/unit/config/dbSsl.test.js
  tests/unit/config/ocrConfig.test.js` (2 files / 9 tests);
  `npm run server:build` (154 files); and
  `npm run verify:tb-infra-static` with Terraform fmt/init/validate/no-live
  plan, a fresh server image build containing the RDS bundle, and git whitespace
  checks.

2026-07-21 dev runtime recovery and Next.js web deployment slice:

- API and worker revision 2 reached desired/running `1/1`. The public health
  check at `https://api.autolearn.io.vn/health` returned HTTP 200 with
  `{"status":"ok"}`; the one-off migration task exited 0.
- The VPC-reachable MVP smoke exited 0 and proved API ingress, idempotent RDS
  migration, PostGIS/pgcrypto, S3 write/read, and Redis AUTH/TLS connectivity.
  Its receipt fixture cleanup was denied by the intentional immutable-receipt
  task-role policy, so the exact non-sensitive versioned smoke object was
  removed through the deploy boundary without broadening receipt delete access.
- BullMQ reported the live ElastiCache default `volatile-lru` policy. The dev
  parameter group was changed to `maxmemory-policy=noeviction`; a replacement
  worker connected to the database and started without the eviction warning.
  Terraform now records this parameter so future applies do not drift.
- Added a third immutable ECR repository and a private ECS Fargate service for
  the standalone Next.js BFF. The web task has a dedicated task role, security
  group, CloudWatch log group/alarm, and receives only the existing shared BFF
  secret. The existing ALB adds the web ACM certificate through SNI and forwards
  only the exact configured web host to the web target group; API remains the
  default action and worker remains private.
- The deployment workflow now requires `WEB_CERTIFICATE_ARN`, `WEB_DOMAIN`, and
  HTTPS `WEB_API_BASE_URL`, builds the client image with non-secret public build
  arguments, pushes all three commit-SHA images, and passes the web inputs to
  the reviewed ECS Terraform plan.
- Live web apply, ECS running/target-health proof, DNS alias/CNAME, HTTPS page
  smoke, administrator login smoke, and web log redaction inspection remain
  pending.
- Static validation passed: Actionlint 1.7.7 reported no workflow errors;
  `node --check` passed for the ECR export and infrastructure verifier scripts;
  `npm run verify:tb-infra-static` passed Terraform fmt/init/validate/no-live
  plan, server syntax for 154 files, server image build, standalone Next.js
  image build with all static/dynamic routes, and working/staged whitespace
  checks. The built web image also started through `node server.js` and returned
  HTTP 200 from `/` on a local container runtime smoke.
