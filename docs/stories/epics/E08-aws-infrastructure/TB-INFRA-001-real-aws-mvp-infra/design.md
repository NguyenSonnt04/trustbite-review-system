# Design

## Domain Model

This is a platform/infrastructure story. It does not introduce new product
entities, but it establishes runtime infrastructure for existing product
domains:

- User/auth: Cognito token verification and account-state checks remain in the
  Express backend. This story only supplies runtime config and network access.
- Restaurant/review/receipt: PostgreSQL remains the source of truth for
  application state.
- Receipt storage: S3 stores private receipt objects and related media evidence.
- OCR/fraud worker: Redis/BullMQ queues receipt OCR and verification jobs; ECS
  worker tasks process those jobs.
- Web/admin: the server-rendered Next.js BFF runs as a private ECS task, receives
  only the shared BFF secret, and is exposed through an exact-host ALB rule.
- Observability: CloudWatch logs and alarms support operational diagnosis, not
  product audit replacement.

## Proposed Infrastructure Shape

Default proposed IaC layout:

```text
infra/
  terraform/
    README.md
    versions.tf
    providers.tf
    variables.tf
    outputs.tf
    modules/
      network/
      rds-postgres/
      s3-private-bucket/
      redis-cache/
      ecr/
      ecs-service/
      iam/
      observability/
    envs/
      dev/
        backend.tf
        main.tf
        variables.tf
        terraform.tfvars.example
      staging/
        backend.tf
        main.tf
        variables.tf
        terraform.tfvars.example
```

This layout is a proposal, not a production decision. If the team has an
existing AWS standard, replace it before implementation and record the decision.

## Application Flow

Deployment flow after implementation:

```text
developer/CI
  -> validate IaC syntax and policy checks
  -> build client/server images
  -> push API, web, and worker images to ECR
  -> run terraform plan for selected environment
  -> human reviews plan, cost, and blast radius
  -> terraform apply for selected non-production environment
  -> run DB migrations against RDS
  -> deploy/update ECS API service
  -> deploy/update ECS web service
  -> deploy/update ECS worker service
  -> run smoke checks
  -> record Harness evidence
```

Runtime flow:

```text
shared HTTPS ALB
  -> API default action -> ECS API task
  -> exact web host rule -> ECS Next.js web/BFF task
  -> RDS PostgreSQL/PostGIS
  -> S3 private receipt bucket
  -> Redis/BullMQ cache
  -> ECS worker task
  -> Textract/Cognito/SES provider boundaries as selected by product stories
```

## Interface Contract

No new public API contract is created by this story. Existing application
contracts must continue to work after deployment:

- `GET /health` returns a healthy response from the ECS API service.
- Existing `/api/v1/...` routes keep their current request/response contracts.
- Receipt upload/storage behavior remains private-S3-backed.
- Worker behavior continues to use BullMQ job semantics and existing receipt OCR
  degradation rules.

Infrastructure outputs should expose only non-secret values needed by deploy and
smoke tooling:

- API load balancer or service URL.
- Web hostname and API/web/worker ECR repository URLs.
- ECS cluster/service names.
- S3 bucket name for the selected environment.
- RDS endpoint reference only through secret/config wiring where possible.
- Redis endpoint reference only through secret/config wiring where possible.
- CloudWatch log group names.

Secrets must not be emitted as Terraform outputs.

## State And Secret Handling

Terraform state, plans, and provider debug logs are treated as sensitive
infrastructure artifacts. The implementation must use an approved encrypted
remote state backend with locking before any shared or live AWS plan/apply. State
access must be narrower than general repository read access.

Avoid managing raw secret values directly in Terraform when that would persist
the value in state. Prefer creating secret containers/references and injecting
values through an approved operator or CI secret process. If a provider/resource
requires a secret value in state, pause and record the explicit exception,
rotation plan, and access boundary before proceeding.

## Data Model

No TrustBite product migration is added by this story unless a live RDS-specific
compatibility issue is found and accepted separately.

RDS requirements:

- PostgreSQL version must be compatible with local migrations and CI PostGIS
  baseline.
- PostGIS extension must be available and migration proof must run:
  `npm run db:migrate`.
- RDS must be private by default.
- Backups/snapshots must be enabled for persistent environments.
- Deletion protection should be enabled outside disposable development
  environments.
- Parameter group choices must be documented if they differ from AWS defaults.

S3 data requirements:

- Private bucket only; block public access.
- Server-side encryption enabled.
- Versioning and lifecycle policy chosen deliberately.
- CORS policy only if direct browser/mobile signed upload requires it.
- Lifecycle must not delete receipt evidence sooner than product retention docs
  allow.

Redis/cache requirements:

- Private access only from ECS task security groups.
- Connection settings wired through environment/secrets.
- Durable job expectations documented: BullMQ state is operational queue state,
  not the product source of truth.

## IAM And Security

Principles:

- Use least-privilege task roles.
- Separate task execution role from application task role.
- Keep API and worker roles separate when permissions differ.
- Allow S3 object actions only on the selected receipt bucket/prefixes.
- Allow CloudWatch log writes only to expected log groups.
- Avoid wildcard AWS permissions except where AWS service mechanics require them
  and the exception is documented.
- Prefer GitHub Actions OIDC over long-lived CI access keys.
- Do not allow deploy workflow to run with secrets on forked/untrusted PRs.
- Constrain GitHub OIDC by `aud`, repository, branch/tag or protected
  environment, and selected workflow where practical.
- Scope `iam:PassRole` to the exact ECS task roles and execution roles needed by
  deploys; do not grant administrator access to CI.

Minimum IAM surfaces:

- ECS task execution role for image pull and log delivery.
- API task role for S3 signed upload/storage access and provider calls needed by
  API flows.
- Web task role with no provider permissions; the execution role injects only
  the BFF secret referenced by the web task definition.
- Worker task role for S3 receipt read/write/delete as needed and Textract/OCR
  provider access.
- GitHub deploy role with scoped ECR/ECS/Terraform backend access.

## Networking

Default shape:

- VPC with public subnets only for load balancer/NAT if selected.
- Private subnets for API/web/worker ECS tasks, RDS, and Redis.
- RDS security group allows PostgreSQL only from ECS task security groups or an
  approved migration runner boundary.
- Redis security group allows Redis only from ECS task security groups.
- S3 accessed through normal AWS endpoints or VPC endpoint if cost/security trade
  off is accepted.
- Outbound internet/NAT requirements are documented, especially for provider SDK
  calls and image pulls. Until a future VPC endpoint slice provisions the
  required ECR, CloudWatch Logs, Secrets Manager, and AWS API endpoints, live ECS
  tasks require NAT egress.

## UI / Platform Impact

Platform impact is limited to infrastructure, deploy workflow, and runtime
configuration. The client/mobile UI should not change in this story.

Expected repository additions during implementation:

- `infra/terraform/**` or equivalent IaC.
- `.github/workflows/deploy-aws.yml` only after credential boundary is agreed.
- `scripts/smoke-aws-mvp.mjs` or equivalent smoke runner if it is the smallest
  reliable proof surface.
- README/deployment docs for environment setup and non-secret variables.

## Observability

Minimum observability for non-production closeout:

- ECS API, web, and worker CloudWatch log groups with retention.
- API task health and restart/failure visibility.
- Worker task failure/restart visibility.
- RDS availability/storage/CPU alarm baseline.
- Redis/cache connection or node health alarm baseline where available.
- Optional queue-depth metric must be added only if the application exposes a
  reliable metric source.

Operational logs must not include:

- AWS credentials or secret values.
- raw JWT/access/refresh tokens.
- database password or Redis auth values.
- full receipt bytes or full OCR payloads.
- unredacted GPS coordinates unless product audit policy explicitly requires it.

Audit logs remain application database records and are not replaced by
CloudWatch logs.

## Alternatives Considered

1. Keep using only Docker Compose and LocalStack. Rejected because task `1.2`
   specifically asks for AWS infrastructure and ECS/RDS/Redis/S3 setup.
2. Add deploy steps directly to the existing container-build workflow. Rejected
   because image build proof and live cloud deployment have different permissions
   and risk profiles.
3. Use ad hoc AWS CLI commands with manually created resources. Rejected because
   the result would be hard to review, repeat, rollback, or audit.
4. Provision production first. Rejected because the repo lacks non-production
   live-AWS proof and production deployment would combine cost, data, security,
   and rollback risk too early.
5. Use long-lived AWS access keys in GitHub secrets. Rejected unless no OIDC path
   is available and a human accepts the temporary risk with rotation/expiry.
