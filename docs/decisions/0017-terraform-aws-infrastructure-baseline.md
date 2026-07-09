# 0017 Terraform AWS Infrastructure Baseline

Date: 2026-07-09

## Status

Accepted

## Context

Spreadsheet task 1.2 requires real AWS infrastructure for RDS PostgreSQL, S3,
Redis, and ECS. Existing TrustBite proof only covers local Docker, LocalStack
provider boundaries, and container build syntax. A live AWS baseline needs an
explicit IaC tool, state handling rule, and apply gate before implementation can
continue safely.

## Decision

Use Terraform for the first TrustBite non-production AWS MVP infrastructure
baseline under `infra/terraform`.

The first environment entrypoint is `infra/terraform/envs/dev`. Terraform state
for live work must use an approved encrypted remote backend with locking before
any live `plan` or `apply`. Local state, real `tfvars`, plan files, provider
debug logs, and credentials must stay out of git.

The first implementation slice may add an IaC skeleton and static validation
only. Live `terraform plan` and `terraform apply` remain gated on explicit
confirmation of AWS account, region, state backend, budget, and blast radius.

## Alternatives Considered

1. AWS CDK: familiar for application teams but adds another Node build surface
   and still needs careful state/bootstrap handling.
2. CloudFormation: native AWS option, but less ergonomic for the module-oriented
   MVP slice and reviewable plan workflow wanted here.
3. Manual console setup: fastest for a one-off environment, but weak for
   repeatability, review, rollback, and Harness evidence.

## Consequences

Positive:

- Infrastructure changes become reviewable through Terraform config and plan
  output.
- The repository can separate static validation from live AWS proof.
- The story can add modules incrementally without claiming task 1.2 complete.

Tradeoffs:

- Terraform CLI or a Docker fallback is required for local validation.
- Provider and backend lock files must be maintained intentionally.
- Some IAM resources may need narrowly documented exceptions during future live
  apply work.

## Follow-Up

- Add the first `infra/terraform` skeleton and static validation evidence.
- Confirm remote state backend values outside git before any live plan.
- Add concrete AWS resources only after account, region, budget, and apply gates
  are approved.
