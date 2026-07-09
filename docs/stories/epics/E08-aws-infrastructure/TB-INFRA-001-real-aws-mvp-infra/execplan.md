# Exec Plan

## Goal

Create and implement a real AWS MVP infrastructure baseline for TrustBite that
can support non-production API, worker, database, cache, receipt storage, image
registry, logging, and smoke validation without weakening existing LocalStack,
database, provider-boundary, or container-build contracts.

## Scope

In scope:

- IaC for a non-production AWS environment.
- RDS PostgreSQL with PostGIS migration proof.
- Private S3 receipt bucket and application IAM access.
- Redis-compatible managed cache for BullMQ.
- ECR repositories for API and worker images.
- ECS Fargate API service and worker service.
- Task execution roles, task roles, security groups, and environment/secret
  references.
- CloudWatch log groups and minimum alarms.
- Optional GitHub Actions deploy workflow gated by approved OIDC/credential
  setup.
- Smoke scripts and documentation needed to prove the environment.
- Harness matrix/story/trace updates after proof exists.

Out of scope:

- Production traffic cutover.
- Public DNS/domain/WAF setup unless explicitly selected.
- Mobile store deployment.
- Admin portal production deployment unless it is required for the selected
  smoke scope.
- New product features, API contracts, or database schema.
- Live Textract/Cognito/SES/Bedrock behavior beyond the existing provider story
  unless accepted as a separate provider proof extension.
- Secrets or real environment-specific tfvars committed to git.

## Risk Classification

Risk flags:

- Data model and persistence, because RDS hosts the application database.
- Audit/security, because IAM, secrets, logs, and private receipt storage are in
  scope.
- External systems, because this provisions AWS services.
- Public contracts, if ingress exposes deployed API endpoints.
- Existing behavior, because all backend stories must continue working after
  deployment.
- Weak proof, because no real AWS IaC/deploy proof exists yet.
- Multi-domain, because auth, review, receipt OCR, storage, queues, database, and
  deployment all depend on this foundation.

Hard gates:

- External provider behavior.
- Audit/security.
- Data/persistence risk.
- Architecture direction, if the IaC/deploy tool differs from the proposed
  Terraform path.

Lane: high-risk.

## Dependencies

Before implementation:

1. Confirm AWS account, region, and target environment name.
2. Confirm IaC tool. Default proposal: Terraform.
3. Confirm whether the first target is `dev` or `staging`; do not start with
   production.
4. Confirm budget limits and deletion protection defaults.
5. Confirm GitHub Actions deploy credential strategy, preferably AWS OIDC.
6. Confirm whether DB migrations run from local operator machine, CI runner, ECS
   one-off task, or another approved migration boundary.
7. Confirm any organization naming/tagging standards.
8. Confirm encrypted remote state backend, locking mechanism, state access
   boundary, and whether any secret values would enter state.

Relevant existing proof:

- `TB-AWS-001`: provider boundaries and LocalStack S3/SES proof.
- `TB-DATA-002`: local PostgreSQL/PostGIS migrations.
- `TB-DEV-003`: client/server Docker image build baseline without AWS deploy.
- `TB-REVIEW-001` and `TB-FRAUD-001`: receipt upload/OCR flows that need S3,
  Redis/BullMQ, and worker runtime support.

## Proposed Work Phases

### Phase 0 - Planning And Guardrails

1. Record/confirm intake and story status as `planned` or `in_progress`.
2. Confirm Terraform vs CDK/CloudFormation.
3. Add or confirm a durable architecture decision if the team has not already
   accepted the IaC/deploy tool and credential boundary.
4. Define environment names, region, tags, budget cap, and resource naming
   convention.
5. Define state backend and plan-artifact handling before live `plan` or `apply`.
6. Decide whether first implementation stops at `terraform plan` or includes
   live `apply`.

Exit criteria:

- Human confirms tool/environment/account assumptions.
- State backend and secret/state handling assumptions are confirmed.
- No secrets are introduced.
- Story remains planned until implementation starts.

### Phase 1 - IaC Skeleton

1. Add `infra/terraform/` skeleton with provider/version pins.
2. Add non-secret variable definitions and example tfvars.
3. Add README explaining prerequisites and the no-secrets rule.
4. Add module boundaries for network, RDS, S3, Redis/cache, ECR, ECS, IAM, and
   observability.
5. Add `.gitignore` rules if the IaC tool creates local state, tfvars, or plan
   artifacts.

Red/green idea:

- Red: `terraform fmt -check -recursive` or equivalent fails before files exist.
- Green: formatting/validate commands pass with no live credentials.

Exit criteria:

- IaC files parse locally without credentials where possible.
- No live apply has been attempted.

### Phase 2 - Network And Security Baseline

1. Define VPC/subnets/security groups or consume existing network ids if the AWS
   account already owns the network baseline.
2. Put RDS, Redis, and ECS tasks in private placement by default.
3. Define ingress boundary for API service only.
4. Define egress requirements for provider SDK calls and image pulls.
5. Add tags for environment, service, owner, cost center if available.

Exit criteria:

- `terraform plan` shows expected network/security resources.
- No public DB/cache exposure is present in the plan.

### Phase 3 - Data And Storage

1. Add RDS PostgreSQL resource/config with PostGIS-compatible engine/version.
2. Add DB subnet group, parameter group if needed, backup retention, storage, and
   deletion protection defaults.
3. Add S3 private bucket with encryption, block public access, lifecycle, and
   optional CORS for signed upload only if needed.
4. Add Secrets Manager/SSM references for DB and application secrets.
5. Add outputs that expose non-secret references only.

Exit criteria:

- Plan review confirms private DB, private bucket, encryption, backup/lifecycle.
- No secret values in Terraform output.

### Phase 4 - Queue, Images, And ECS Runtime

1. Add Redis/ElastiCache resources and private security group access.
2. Add ECR repositories for API and worker.
3. Add ECS cluster, task definitions, API service, and worker service.
4. API task runs `node src/server.js`.
5. Worker task runs the explicit worker entrypoint or a documented command; if
   no production worker entrypoint exists yet, stop and add the smallest backend
   story/code change before claiming ECS worker completion.
6. Inject env/config through ECS environment variables and secret references.
7. Configure health checks and log groups.

Exit criteria:

- Plan review confirms separate API/worker runtime shape.
- Worker command exists and can be smoke-tested.

### Phase 5 - Deploy Workflow

1. Add or update GitHub Actions workflow for AWS deploy only after credential
   boundary is confirmed.
2. Use OIDC or approved temporary credential strategy.
3. Build and push API/worker images to ECR.
4. Run IaC plan on PRs where safe; gate apply to manual dispatch or protected
   environment.
5. Prevent deploy secrets from running on untrusted pull requests.
6. Record workflow summary with image tags, environment, and whether apply ran.

Exit criteria:

- Workflow validates syntax and does not expose credentials.
- Push/apply steps are gated and environment-scoped.

### Phase 6 - Live Apply And Smoke Proof

Only run after explicit human approval.

1. Run `terraform plan` and review resource diff/cost/blast radius.
2. Run `terraform apply` for the selected non-production environment.
3. Push images and deploy/update ECS services.
4. Run database migrations against the provisioned RDS endpoint.
5. Run API health smoke.
6. Run S3 private receipt storage smoke.
7. Run Redis/BullMQ connectivity smoke.
8. Run a worker job smoke or a receipt OCR queued/degraded smoke with non-PII
   fixture data.
9. Confirm CloudWatch logs show no raw secrets or receipt payloads.
10. Record exact commands and results in `validation.md`.

Exit criteria:

- Non-production environment passes the required smoke checks.
- Harness story can move to `implemented` only after evidence is recorded.

### Phase 7 - Rollback And Closeout

1. Document rollback for ECS task definitions and image tags.
2. Document migration rollback/forward-fix policy.
3. Document how to stop worker processing safely.
4. Document how snapshots/backups are used for RDS.
5. Document cleanup for disposable environments without deleting retained data
   unexpectedly.
6. Update `docs/TEST_MATRIX.md`, Harness durable story row, and trace.

Exit criteria:

- Rollback doc exists before production consideration.
- Matrix accurately separates planned, in-progress, and implemented proof.

## Suggested First Implementation Slice

Start with a docs/IaC skeleton PR:

1. Add `infra/terraform` skeleton.
2. Add `.gitignore` rules for Terraform local state and plan files.
3. Add `terraform fmt -check -recursive` and `terraform validate` proof if
   Terraform is available locally.
4. Do not create live AWS resources in the first PR unless the human explicitly
   approves account/region/cost.

This keeps the first slice reviewable and avoids coupling cloud spend to initial
story setup.

## Stop Conditions

Pause for human confirmation if:

- The selected IaC tool is ambiguous.
- AWS account, region, environment, or budget is unknown.
- A live `terraform apply` or equivalent command is required.
- Any command asks for real credentials not already approved for this task.
- A plan would expose RDS or Redis publicly.
- A plan would disable encryption, public-access-block, or backups without an
  explicit accepted reason.
- A plan includes delete, replace, destroy, deletion-protection weakening,
  retention weakening, backup weakening, or S3 lifecycle changes that can remove
  retained evidence.
- A plan broadens IAM permissions, especially wildcard actions/resources,
  administrator access, OIDC trust scope, or `iam:PassRole`.
- Terraform state, plan output, provider logs, or secret values would be written
  to git or to an unapproved storage location.
- The ECS worker needs an application entrypoint that does not exist yet.
- A production bucket/database/resource name would be committed to source.
- Existing backend behavior must change to make the deployment work.
- Validation requirements need to be weakened.
