# TrustBite AWS Infrastructure

This folder contains the Terraform entrypoint for the TrustBite non-production
AWS MVP infrastructure story `TB-INFRA-001`.

This first slice is intentionally a skeleton:

- It defines the Terraform layout, provider pin, module boundaries, and static
  validation path.
- It does not create live AWS resources yet.
- It does not commit real state backend values, `tfvars`, account ids,
  credentials, database passwords, Redis tokens, or bucket names.

## Layout

```text
infra/terraform/
  envs/dev/        # first non-production environment entrypoint
  modules/         # bounded infrastructure modules
```

Current module boundaries:

- `network`
- `rds`
- `s3_receipts`
- `redis`
- `ecr`
- `ecs`
- `iam`
- `observability`

## State Backend

Live `plan` or `apply` requires an approved encrypted remote state backend with
locking. The `envs/dev/backend.dev.example.hcl` file is a placeholder only.
Copy it to an ignored local file such as `backend.dev.hcl` and replace the
placeholders after the AWS account, region, state bucket, and state access
principals are approved. The active Terraform backend block is intentionally
not enabled in this skeleton so local no-live validation can run without
accidentally initializing unapproved state.

Do not commit local backend config, plan files, state files, provider debug
logs, or real `tfvars`.

## Low-Cost Defaults

`envs/dev/low-cost.dev.tfvars.example` records the non-production credit-safety
defaults used by static verification. Copy it to an ignored local `.tfvars`
file only after the AWS account, backend, budget, and cleanup owner are
approved.

The low-cost example keeps these defaults off:

- `create_live_resources`
- `create_ecs_resources`
- `enable_nat_gateway`
- `ecs_private_egress_enabled`

It also keeps the smallest current RDS/Redis classes, single desired ECS task
counts, 7-day CloudWatch log retention, RDS deletion protection, and ECR
`force_delete=false`.

The current stack does not model VPC endpoints for ECR, CloudWatch Logs,
Secrets Manager, or AWS APIs. Live ECS creation therefore requires NAT egress:
`create_ecs_resources=true` must be paired with `enable_nat_gateway=true` and
`ecs_private_egress_enabled=true`. A future VPC endpoint slice can replace this
NAT requirement after it provisions and validates the required endpoints.

## Static Validation

When Terraform is installed locally:

```powershell
terraform -chdir=infra/terraform fmt -check -recursive
terraform -chdir=infra/terraform/envs/dev init -backend=false
terraform -chdir=infra/terraform/envs/dev validate
terraform -chdir=infra/terraform/envs/dev plan -refresh=false -input=false
npm run verify:tb-infra-static
```

Docker fallback from the repository root:

```powershell
docker run --rm -v "${PWD}:/workspace" -w /workspace hashicorp/terraform:1.14.5 -chdir=infra/terraform fmt -check -recursive
docker run --rm -v "${PWD}:/workspace" -w /workspace hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev init -backend=false
docker run --rm -v "${PWD}:/workspace" -w /workspace hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev validate
docker run --rm -v "${PWD}:/workspace" -w /workspace -e AWS_ACCESS_KEY_ID=static-placeholder -e AWS_SECRET_ACCESS_KEY=static-placeholder -e AWS_EC2_METADATA_DISABLED=true hashicorp/terraform:1.14.5 -chdir=infra/terraform/envs/dev plan -refresh=false -input=false -no-color
```

The static plan command is for `create_live_resources=false` only. It uses
placeholder AWS environment variables and provider static-mode skips so the
module contract can be rendered without contacting AWS. A live plan still
requires real credentials, approved remote state, deterministic image tags, and
explicit approval.

Live resource creation is intentionally phased:

1. `create_live_resources=true`, `create_ecs_resources=false` creates the
   platform foundations, including ECR repositories, without starting ECS tasks.
2. Build and push API and worker images with the commit SHA tag.
3. `create_live_resources=true`, `create_ecs_resources=true` creates or updates
   ECS task definitions, services, ECS service alarms, and NAT egress for the
   private API/worker tasks unless a future VPC endpoint slice replaces NAT.

## Live Plan Gate

Before any live `terraform plan`:

1. Load AWS credentials into the shell that runs Terraform.
2. Verify the caller identity without printing secrets.
3. Confirm region, environment, state backend, locking, budget, and apply gate.
4. Confirm `ALLOWED_ORIGINS` is approved for API CORS and S3 presigned upload
   CORS. For ECS runtime creation, confirm `API_CERTIFICATE_ARN` points to an
   approved ACM certificate for the public HTTPS listener.
5. Add the approved `backend "s3"` block and run `terraform init` with an
   approved backend config outside git.
6. Confirm the non-production Redis AUTH token plaintext-in-state exception,
   state access boundary, and rotation plan before setting
   `redis_auth_token_state_approved=true`.
7. Treat the generated plan as sensitive and keep it out of the repository.

Do not run `terraform apply` without explicit human approval for the selected
non-production account and region. The GitHub workflow requires
`cost_ack=TB-COST-ACK` for `apply=true` because RDS, Redis, ALB, ECS, NAT, logs,
and related services can consume AWS credits after creation.

## Live Migration And Smoke

RDS and Redis are private and security-group limited to ECS task security
groups. Do not run the live migration or smoke from an ordinary host-side GitHub
runner or laptop unless that host is explicitly attached to the VPC through an
approved bastion/VPN path or an approved runner security group.

The preferred proof path is an ECS one-off task using the API task definition,
private subnets, and API task security group from `environment_contract`:

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

The `runtime_smoke` output is non-secret and only hands off endpoint-style
values: `TRUSTBITE_API_BASE_URL`, `DATABASE_HOST`, `DATABASE_NAME`,
`DATABASE_SSL`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`, `REDIS_HOST`,
`REDIS_PORT`, and `REDIS_TLS`. The ECS task definition supplies `DATABASE_USER`,
`DATABASE_PASSWORD`, and `REDIS_PASSWORD` from Secrets Manager. If an operator
uses the alternative bastion/VPN or runner-security-group path, they must export
the non-secret `runtime_smoke` values plus those approved secrets locally and set
`TRUSTBITE_SMOKE_NETWORK_CONTEXT` to `bastion-vpn` or
`runner-security-group`. The smoke runner requires Redis AUTH and TLS for live
ElastiCache, and `DATABASE_SSL=true` for live RDS. It does not replace the
manual CloudWatch log inspection for secret/token/receipt redaction.
