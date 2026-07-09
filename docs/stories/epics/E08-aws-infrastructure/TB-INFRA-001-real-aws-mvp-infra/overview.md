# Overview

Story: TB-INFRA-001
Lane: high-risk
Epic: E08 AWS Infrastructure

## Current Behavior

Spreadsheet task `1.2` asks for AWS infrastructure setup: RDS PostgreSQL,
S3, Redis, and ECS. The current repository has implemented local and provider
foundation work, but not real AWS provisioning:

- `TB-AWS-001` proves LocalStack/provider boundaries for supported local paths,
  especially S3 and SES, and explicitly does not claim live AWS infrastructure.
- `TB-DATA-002` proves the local PostgreSQL/PostGIS migration baseline.
- `TB-DEV-003` proves client/server container image builds and scans without
  pushing to a registry or deploying to AWS.
- `.github/workflows/container-build.yml` currently states `AWS deploy | not
  configured`.
- There is no tracked Terraform, CDK, CloudFormation, or other IaC surface for
  RDS, S3, Redis/ElastiCache, ECR, or ECS.

## Target Behavior

TrustBite has a reproducible, reviewable, and least-privilege AWS MVP
infrastructure baseline that can be planned, applied, smoke-tested, and rolled
forward safely for a non-production environment before any production use.

The baseline provisions or wires:

- RDS PostgreSQL with PostGIS support and migration connectivity.
- Private S3 receipt storage with server-side encryption, public access blocked,
  lifecycle policy, and narrow application IAM access.
- Redis-compatible managed cache for BullMQ/OCR jobs, expected to be
  ElastiCache Redis or Valkey-compatible Redis depending on AWS account support.
- ECR repositories for the API and worker images.
- ECS Fargate services for the Express API and OCR worker.
- ECS task definitions, task roles, execution roles, log groups, health checks,
  and environment/secret injection.
- Secrets Manager or SSM Parameter Store entries for runtime secrets and
  provider configuration references, never plaintext secrets in source.
- VPC, subnets, route/security-group boundaries, and DB/cache private placement.
- CloudWatch log groups and minimum release alarms for API health, task restarts,
  queue/worker failures, and database availability.
- A deploy-safe GitHub Actions path using OIDC or another approved credential
  boundary, with image push/deploy disabled until explicitly configured.

## Affected Users

- Developers needing a real AWS development or staging environment.
- Backend maintainers validating provider-backed receipt/review flows.
- DevOps or release owners responsible for cost, access, rollback, and uptime.
- QA/UAT reviewers running smoke tests against deployed API and worker services.
- Future production operators.

## Affected Product Docs

- `trustbite-docs/04_Software_Engineering/AWS_Cloud_Infrastructure.md`
- `trustbite-docs/09_Operations_and_Maintenance/Deployment_Guide.md`
- `trustbite-docs/09_Operations_and_Maintenance/Monitoring_and_Incident_Runbook.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_MATRIX.md`
- `README.md`
- `docs/stories/epics/E02-local-development/TB-AWS-001-localstack-provider-boundaries/`
- `docs/stories/epics/E02-local-development/TB-DEV-003-container-build-baseline.md`
- `docs/stories/epics/E10-data-model/TB-DATA-002-database-migration-baseline/`

## Acceptance Criteria

1. The story selects a single IaC tool before implementation. The default
   proposed path is Terraform under `infra/terraform/`, unless the team confirms
   CDK/CloudFormation or an existing organization standard first.
2. IaC defines separate reusable modules or clearly separated resources for:
   networking, RDS, S3, cache, ECR, ECS API, ECS worker, IAM, secrets/config, and
   observability.
3. No source file contains real AWS credentials, database passwords, Cognito
   secrets, bucket names for production, account ids, or long-lived access keys.
   Environment-specific values are supplied through ignored tfvars, CI secrets,
   SSM/Secrets Manager, or documented placeholders.
4. Terraform or equivalent IaC state is stored in an approved encrypted remote
   backend with locking, least-privilege access, and no committed state or plan
   artifacts. Any secret value that would enter state must be avoided or
   explicitly accepted before implementation.
5. RDS runs PostgreSQL in a private network segment and supports the existing
   migration requirement `CREATE EXTENSION IF NOT EXISTS postgis`.
6. S3 receipt bucket blocks public access, encrypts objects, limits write/read
   access to the application role, and supports short-lived signed URL flows
   without public object ACLs.
7. Redis/cache is private to application networking and configured for BullMQ
   compatibility with documented connection settings.
8. ECS API service exposes the Express server health endpoint through the chosen
   ingress boundary, while ECS worker runs without public ingress.
9. API and worker task definitions use distinct commands, environment variables,
   task roles, and scaling/min-count settings appropriate for MVP.
10. ECR image push and ECS deployment workflow exists but is gated by explicit
    environment configuration and does not run on untrusted pull requests.
    GitHub OIDC trust policy must be constrained by audience, repository,
    branch/tag or protected environment, and must not allow forked pull requests
    to assume deploy roles.
11. Deploy IAM permissions are least-privilege: no administrator policy, scoped
    `iam:PassRole`, documented exceptions for Terraform-required IAM operations,
    and a reviewed permissions boundary when the organization requires one.
12. Database migration proof runs against the provisioned non-production RDS
    endpoint, or the story records the exact blocker and does not claim RDS
    completion. The validation record must include the target environment,
    region, redacted host/config source, and confirmation it did not use local
    Docker/Postgres.
13. Smoke proof validates deployed API health, DB connectivity, S3 receipt
    write/read/delete or signed upload path, Redis/BullMQ connectivity, and
    worker job processing in the target environment.
14. Rollback and cleanup paths are documented before any live `apply`, including
    how to disable worker processing, rollback ECS task definitions, restore or
    snapshot RDS, and retain/delete S3 data.
15. Cost controls are explicit: environment tags, small instance/task sizes,
    log retention, optional deletion protection defaults, and no production-grade
    multi-AZ spend unless deliberately approved.
16. Harness matrix, story validation evidence, and trace are updated only after
    the real validation commands pass.

## Non-Goals

- Production launch or production traffic cutover.
- Migrating the backend stack away from Express/Node.js.
- Replacing Cognito, Textract, SES, or Bedrock provider boundaries.
- Adding new product APIs, schema, or UI flows.
- Hardcoding real environment identifiers or secrets into the repository.
- Claiming live AWS proof from LocalStack-only validation.
- Applying destructive infrastructure changes without an approved plan and
  explicit human confirmation.
