locals {
  task_secret_arns = compact([
    var.rds_master_user_secret_arn,
    var.redis_auth_token_secret_arn,
  ])

  contract = {
    create_live_resources = var.create_live_resources
    deploy_role_policy    = "no-admin-scoped-passrole-only"
    environment           = var.environment
    managed_policy_arns = {
      ecs_task_execution = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
    }
    module                = "iam"
    oidc_trust_scope      = "repository-ref-or-protected-environment"
    receipt_object_prefix = var.receipt_object_prefix
    secret_arn_count      = length(local.task_secret_arns)
    secret_policy_gate    = "create_live_resources_and_task_secret_policy_enabled"
    s3_policy_scope       = "receipt-bucket-prefix-only"
    textract_policy_scope = "AnalyzeExpense requires provider-level wildcard"
    task_roles            = ["api-task-role", "worker-task-role", "execution-role"]
  }
}

data "aws_iam_policy_document" "ecs_task_assume_role" {
  count = var.create_live_resources ? 1 : 0

  statement {
    actions = ["sts:AssumeRole"]
    effect  = "Allow"

    principals {
      identifiers = ["ecs-tasks.amazonaws.com"]
      type        = "Service"
    }
  }
}

data "aws_iam_policy_document" "api_task" {
  count = var.create_live_resources ? 1 : 0

  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    effect = "Allow"
    resources = [
      "${var.receipt_bucket_arn}/${var.receipt_object_prefix}*",
    ]
    sid = "ReceiptObjectAccess"
  }

  statement {
    actions   = ["s3:PutObject"]
    effect    = "Allow"
    resources = ["${var.receipt_bucket_arn}/avatars/*"]
    sid       = "AvatarObjectUpload"
  }

  statement {
    actions   = ["s3:ListBucket"]
    effect    = "Allow"
    resources = [var.receipt_bucket_arn]
    sid       = "ReceiptPrefixList"

    condition {
      test     = "StringLike"
      values   = ["${var.receipt_object_prefix}*"]
      variable = "s3:prefix"
    }
  }

  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    effect    = "Allow"
    resources = local.task_secret_arns
    sid       = "RuntimeSecretRead"
  }
}

data "aws_iam_policy_document" "worker_task" {
  count = var.create_live_resources ? 1 : 0

  statement {
    actions = [
      "s3:GetObject",
    ]
    effect = "Allow"
    resources = [
      "${var.receipt_bucket_arn}/${var.receipt_object_prefix}*",
    ]
    sid = "ReceiptObjectRead"
  }

  statement {
    actions   = ["s3:ListBucket"]
    effect    = "Allow"
    resources = [var.receipt_bucket_arn]
    sid       = "ReceiptPrefixList"

    condition {
      test     = "StringLike"
      values   = ["${var.receipt_object_prefix}*"]
      variable = "s3:prefix"
    }
  }

  statement {
    actions   = ["textract:AnalyzeExpense"]
    effect    = "Allow"
    resources = ["*"]
    sid       = "TextractAnalyzeExpense"
  }

  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    effect    = "Allow"
    resources = local.task_secret_arns
    sid       = "RuntimeSecretRead"
  }
}

data "aws_iam_policy_document" "execution_secrets" {
  count = var.create_live_resources && var.task_secret_policy_enabled ? 1 : 0

  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    effect    = "Allow"
    resources = local.task_secret_arns
    sid       = "TaskDefinitionSecretRead"
  }
}

resource "aws_iam_role" "execution" {
  count = var.create_live_resources ? 1 : 0

  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role[0].json
  description        = "TrustBite ECS task execution role for ${var.environment}"
  name               = "${var.name_prefix}-ecs-execution"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-ecs-execution"
  })
}

resource "aws_iam_role" "api_task" {
  count = var.create_live_resources ? 1 : 0

  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role[0].json
  description        = "TrustBite API ECS task role for ${var.environment}"
  name               = "${var.name_prefix}-api-task"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-task"
  })
}

resource "aws_iam_role" "worker_task" {
  count = var.create_live_resources ? 1 : 0

  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role[0].json
  description        = "TrustBite worker ECS task role for ${var.environment}"
  name               = "${var.name_prefix}-worker-task"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-worker-task"
  })
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  count = var.create_live_resources ? 1 : 0

  policy_arn = local.contract.managed_policy_arns.ecs_task_execution
  role       = aws_iam_role.execution[0].name
}

resource "aws_iam_role_policy" "execution_secrets" {
  count = var.create_live_resources && var.task_secret_policy_enabled ? 1 : 0

  name   = "${var.name_prefix}-execution-secrets"
  policy = data.aws_iam_policy_document.execution_secrets[0].json
  role   = aws_iam_role.execution[0].id
}

resource "aws_iam_role_policy" "api_task" {
  count = var.create_live_resources ? 1 : 0

  name   = "${var.name_prefix}-api-task-runtime"
  policy = data.aws_iam_policy_document.api_task[0].json
  role   = aws_iam_role.api_task[0].id
}

resource "aws_iam_role_policy" "worker_task" {
  count = var.create_live_resources ? 1 : 0

  name   = "${var.name_prefix}-worker-task-runtime"
  policy = data.aws_iam_policy_document.worker_task[0].json
  role   = aws_iam_role.worker_task[0].id
}

output "contract" {
  description = "Non-secret IAM module contract for the next implementation slice."
  value       = local.contract
}

output "ids" {
  description = "IAM role ids for ECS task definition wiring. Empty until live resources are enabled."
  value = {
    api_task_role_arn       = try(aws_iam_role.api_task[0].arn, null)
    api_task_role_name      = try(aws_iam_role.api_task[0].name, null)
    execution_role_arn      = try(aws_iam_role.execution[0].arn, null)
    execution_role_name     = try(aws_iam_role.execution[0].name, null)
    task_secret_arn_count   = length(local.task_secret_arns)
    worker_task_role_arn    = try(aws_iam_role.worker_task[0].arn, null)
    worker_task_role_name   = try(aws_iam_role.worker_task[0].name, null)
    deploy_role_configured  = false
    wildcard_policy_reasons = ["textract:AnalyzeExpense does not have a narrower resource ARN in this static slice"]
  }
}
