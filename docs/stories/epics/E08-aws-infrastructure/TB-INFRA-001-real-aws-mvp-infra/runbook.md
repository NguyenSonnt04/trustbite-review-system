# Runbook

## Live Plan Gate

Run this story against a non-production AWS account only.

Before `create_live_resources=true`, confirm:

- AWS caller identity, account alias/id, region, and environment are approved.
- Encrypted remote state and locking are approved.
- Terraform plan artifacts stay outside git and are treated as sensitive.
- Deterministic image tag is a commit SHA pushed to the approved ECR repos.
- The server image contains the AWS RDS global CA bundle and sets
  `NODE_EXTRA_CA_CERTS` to that bundle. Keep certificate verification enabled;
  do not use `DATABASE_SSL_REJECT_UNAUTHORIZED=false` to work around a missing
  runtime trust bundle.
- Private ECS task egress is approved through NAT. The current Terraform stack
  does not model the required ECR, CloudWatch Logs, Secrets Manager, and AWS API
  VPC endpoints yet.
  - Redis AUTH token plaintext-in-state exception, state access, and rotation
    handling are explicitly approved.
- Production API config is available from the selected GitHub environment:
  Cognito user-pool identifiers, both app-client identifiers, the three admin
  secret ARNs, and `ALLOWED_ORIGINS`.
- Budget and cleanup owner are recorded.

## Cost Safety

Plan-only runs (`apply=false`) do not create paid AWS resources. They still use
AWS APIs and should be treated as sensitive, but they are the safe first live
step.

Before any `apply=true`, confirm expected cost exposure:

- RDS charges while the instance exists, plus storage and snapshots.
- ElastiCache Redis charges while the replication group exists.
- ALB charges while provisioned.
- ECS Fargate charges while tasks run.
- NAT Gateway can become a major hourly and data-processing cost; it remains
  disabled by default but is required by the current live ECS path because VPC
  endpoints are not modeled yet.
- CloudWatch logs and alarms are smaller but still billable.
- S3/ECR are usually low at MVP scale but are not free.

Use `infra/terraform/envs/dev/low-cost.dev.tfvars.example` as the starting point
for non-production planning. It keeps live creation, ECS creation, NAT, and
private ECS egress disabled by default, with small RDS/Redis classes and short
log retention.

## GitHub Environment Inputs

The `.github/workflows/aws-infra.yml` live job reads deployment configuration
from the selected protected GitHub environment.

Required environment variables:

- `AWS_DEPLOY_ROLE_ARN`: AWS IAM role assumed by GitHub Actions through OIDC.
- `API_CERTIFICATE_ARN`: ACM certificate ARN used by the public HTTPS API
  listener when `create_ecs=true`.
- `WEB_CERTIFICATE_ARN`: issued ACM certificate ARN added to the shared HTTPS
  listener for the Next.js web hostname.
- `WEB_DOMAIN`: exact lowercase hostname routed to the Next.js web service,
  such as `trustbite.io.vn`.
- `WEB_API_BASE_URL`: public HTTPS API origin embedded into the web image and
  supplied to the server-side BFF, such as `https://api.autolearn.io.vn`.
- `TF_STATE_BUCKET`: encrypted S3 bucket for Terraform state.
- `TF_STATE_KEY`: optional state key; defaults to
  `trustbite/<environment>/terraform.tfstate` when unset.
- `REDIS_AUTH_TOKEN_SECRET_ARN`: Secrets Manager ARN that ECS tasks read as
  `REDIS_PASSWORD`.
- `AWS_COGNITO_USER_POOL_ID`: Cognito user pool id injected into API and worker
  task definitions.
- `AWS_COGNITO_USER_POOL_ARN`: Cognito user pool ARN used to scope API task
  permissions for administrator identity provisioning.
- `AWS_COGNITO_CLIENT_ID`: Cognito app client id injected into API and worker
  task definitions.
- `AWS_COGNITO_ADMIN_WEB_CLIENT_ID`: confidential Cognito app client id used
  only by the API administrator-login runtime.
- `AWS_COGNITO_ADMIN_WEB_CLIENT_SECRET_ARN`: Secrets Manager ARN containing
  `AWS_COGNITO_ADMIN_WEB_CLIENT_SECRET`.
- `ADMIN_WEB_BFF_SECRET_ARN`: Secrets Manager ARN containing the shared
  `ADMIN_WEB_BFF_SECRET` used by the API and the separately deployed Next.js
  BFF.
- `ADMIN_WEB_SESSION_KEY_SECRET_ARN`: Secrets Manager ARN containing
  `ADMIN_WEB_SESSION_KEY_SECRET`.
- `ALLOWED_ORIGINS`: comma-separated production CORS origins for the API task.
  The same value also configures receipt/avatar S3 bucket CORS for browser
  presigned PUT requests.

Required environment secret:

- `REDIS_AUTH_TOKEN`: ElastiCache Redis AUTH token. This can enter Terraform
  state, so remote-state access must be approved before using it.

Required workflow dispatch inputs for a live apply:

- `apply=true`
- `confirm_live=TB-INFRA-001`
- `cost_ack=TB-COST-ACK`
- `redis_secret_state_approved=true` after the non-production Redis AUTH token
  plaintext-in-state exception, remote-state access boundary, and rotation plan
  are approved.
- `create_ecs=true` only after the foundation phase has created ECR and
  private ECS egress has been approved.
- `ecs_private_egress_enabled=true` only when NAT egress is approved. The
  workflow enables `enable_nat_gateway=true` during the ECS phase.

## Apply Flow

1. Run a workflow dispatch with `apply=false` first and review the live plan.
2. Initialize Terraform with the approved backend config outside git.
3. Run/apply the foundation phase with `apply=true`,
   `confirm_live=TB-INFRA-001`, `cost_ack=TB-COST-ACK`,
   `create_live_resources=true`, and
   `create_ecs_resources=false`.
4. Build and push API, Next.js web, and worker images using the commit SHA tag.
5. Run a saved ECS phase plan with `create_live_resources=true`,
   `create_ecs_resources=true`, `enable_nat_gateway=true`, the production
   Cognito/CORS runtime config, and the pushed image tag.
6. Run a saved live plan and review it for deletes, IAM broadening, public
   access, retention weakening, and secret exposure.
7. Apply only the reviewed plan.
8. Run migration from a VPC-reachable boundary. The preferred path is an ECS
   one-off task using the API task definition, private subnets, and API task
   security group. Do not run host-side migration from an ordinary laptop or
   GitHub runner because RDS is private and security-group limited to ECS tasks.
9. Read `terraform output -json environment_contract` and use
   `runtime_smoke.TRUSTBITE_API_BASE_URL`, `runtime_smoke.DATABASE_HOST`,
   `runtime_smoke.DATABASE_NAME`, `runtime_smoke.AWS_REGION`,
   `runtime_smoke.AWS_S3_BUCKET_NAME`, `runtime_smoke.REDIS_HOST`,
   `runtime_smoke.REDIS_PORT`, `runtime_smoke.REDIS_TLS`, and the `ecs_ids`
   service/task identifiers for deploy verification handoff.
10. Run live smoke from a VPC-reachable boundary. The preferred path is another
    ECS one-off task using the API task definition, private subnets, and API
    task security group, with container command
    `npm run smoke:aws-mvp -- --env dev` and environment overrides for
    `TRUSTBITE_API_BASE_URL` plus
    `TRUSTBITE_SMOKE_NETWORK_CONTEXT=ecs-run-task`. The task definition supplies
    RDS and Redis secrets from Secrets Manager. The live Redis smoke must use
    AUTH and `REDIS_TLS=true`.
11. Inspect API and worker CloudWatch logs for secret/token/receipt redaction.

### ECS One-Off Proof Commands

After the ECS phase apply, this is the default VPC-reachable proof path:

```powershell
$Contract = terraform -chdir=infra/terraform/envs/dev output -json environment_contract | ConvertFrom-Json
$Ecs = $Contract.ecs_ids
$Network = $Contract.network_ids
$NetworkConfig = "awsvpcConfiguration={subnets=[$($Network.private_subnet_ids -join ',')],securityGroups=[$($Network.api_security_group_id)],assignPublicIp=DISABLED}"

aws ecs run-task `
  --region $Contract.runtime_smoke.AWS_REGION `
  --cluster $Ecs.cluster_name `
  --launch-type FARGATE `
  --task-definition $Ecs.api_task_definition_arn `
  --network-configuration $NetworkConfig `
  --overrides '{"containerOverrides":[{"name":"api","command":["npm","run","db:migrate"]}]}'

aws ecs run-task `
  --region $Contract.runtime_smoke.AWS_REGION `
  --cluster $Ecs.cluster_name `
  --launch-type FARGATE `
  --task-definition $Ecs.api_task_definition_arn `
  --network-configuration $NetworkConfig `
  --overrides "{""containerOverrides"":[{""name"":""api"",""command"":[""npm"",""run"",""smoke:aws-mvp"",""--"",""--env"",""dev""],""environment"":[{""name"":""TRUSTBITE_API_BASE_URL"",""value"":""$($Contract.runtime_smoke.TRUSTBITE_API_BASE_URL)""},{""name"":""TRUSTBITE_SMOKE_NETWORK_CONTEXT"",""value"":""ecs-run-task""}]}]}"
```

An approved bastion/VPN or runner-security-group path is acceptable only when
that host is actually VPC-reachable and allowed by RDS/Redis security groups. In
that path, export all non-secret `runtime_smoke` values, add
`DATABASE_USER`, `DATABASE_PASSWORD`, and `REDIS_PASSWORD` from the approved
secret source, set `TRUSTBITE_SMOKE_NETWORK_CONTEXT=bastion-vpn` or
`runner-security-group`, then run `node scripts/smoke-aws-mvp.mjs --env dev`.

## Rollback

Use the least destructive rollback first:

- ECS app rollback: update API, web, and worker services back to the previous task
  definition revision or previous image tag.
- Bad image rollback: push or select the previous known-good commit SHA tag and
  force a new ECS deployment.
- Migration rollback: use the documented application migration rollback or a
  reviewed forward-fix migration; do not manually edit RDS data unless an
  incident owner approves it.
- S3 smoke cleanup: delete only the generated `receipts/smoke/` object created
  by the smoke script.
- Redis smoke cleanup: delete only `trustbite:smoke:*` keys created by the smoke
  script.
- Infrastructure rollback: use a reviewed Terraform plan; do not disable RDS
  deletion protection, bucket `prevent_destroy`, or ECR force deletion as an
  emergency shortcut.

Record rollback start/end time, resource names, task definition revisions,
image tags, and smoke result in `validation.md`.
