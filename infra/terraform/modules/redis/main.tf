locals {
  contract = {
    at_rest_encryption       = true
    auth_token_required_live = true
    create_live_resources    = var.create_live_resources
    engine                   = "redis"
    engine_version           = var.engine_version
    environment              = var.environment
    module                   = "redis"
    name                     = "${var.name_prefix}-redis"
    node_count               = var.node_count
    node_type                = var.node_type
    parameter_group_family   = var.parameter_group_family
    port                     = var.port
    public_access            = false
    state_secret_approval    = var.auth_token_state_approved
    runtime_env_vars         = ["REDIS_HOST", "REDIS_PORT", "REDIS_PASSWORD", "REDIS_DB", "REDIS_TLS"]
    runtime_use              = "BullMQ queues and cache workflows"
    transit_encryption       = true
    transit_encryption_mode  = "required"
    uses_private_subnets     = true
    uses_security_group_only = true
  }
}

resource "aws_elasticache_subnet_group" "this" {
  count = var.create_live_resources ? 1 : 0

  description = "Private Redis subnet group for TrustBite ${var.environment}"
  name        = "${var.name_prefix}-redis-subnets"
  subnet_ids  = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis-subnets"
  })

  lifecycle {
    precondition {
      condition     = length(var.private_subnet_ids) >= 2
      error_message = "Redis requires at least two private subnet ids before live resources can be created."
    }
  }
}

resource "aws_elasticache_parameter_group" "this" {
  count = var.create_live_resources ? 1 : 0

  description = "TrustBite Redis parameter group for ${var.environment}"
  family      = var.parameter_group_family
  name        = "${var.name_prefix}-redis-params"

  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis-params"
  })
}

resource "aws_elasticache_replication_group" "this" {
  count = var.create_live_resources ? 1 : 0

  at_rest_encryption_enabled = true
  auth_token                 = var.auth_token
  auth_token_update_strategy = var.auth_token == null ? null : var.auth_token_update_strategy
  automatic_failover_enabled = var.node_count > 1
  description                = "TrustBite Redis for BullMQ ${var.environment}"
  engine                     = "redis"
  engine_version             = var.engine_version
  maintenance_window         = "sun:05:00-sun:06:00"
  multi_az_enabled           = var.node_count > 1
  node_type                  = var.node_type
  num_cache_clusters         = var.node_count
  parameter_group_name       = aws_elasticache_parameter_group.this[0].name
  port                       = var.port
  replication_group_id       = "${var.name_prefix}-redis"
  security_group_ids         = [var.redis_security_group_id]
  subnet_group_name          = aws_elasticache_subnet_group.this[0].name
  transit_encryption_enabled = true
  transit_encryption_mode    = "required"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis"
  })

  lifecycle {
    precondition {
      condition     = var.redis_security_group_id != null && var.redis_security_group_id != ""
      error_message = "Redis requires a security group id before live resources can be created."
    }

    precondition {
      condition     = var.auth_token != null
      error_message = "Redis AUTH token must be supplied only after remote state secret handling is approved."
    }

    precondition {
      condition     = var.auth_token_state_approved
      error_message = "Redis AUTH token can enter Terraform state; set auth_token_state_approved only after remote state access, rotation, and exception approval are recorded."
    }
  }
}

output "contract" {
  description = "Non-secret Redis module contract for the next implementation slice."
  value       = local.contract
}

output "ids" {
  description = "Redis ids for runtime config. Empty until live resources are enabled."
  value = {
    auth_token_state_warning   = "REDIS_PASSWORD must not be set until secret-in-state handling is explicitly approved."
    auth_token_state_approved  = var.auth_token_state_approved
    auth_token_update_strategy = var.auth_token_update_strategy
    primary_endpoint_address   = try(aws_elasticache_replication_group.this[0].primary_endpoint_address, null)
    reader_endpoint_address    = try(aws_elasticache_replication_group.this[0].reader_endpoint_address, null)
    redis_port                 = var.port
    replication_group_arn      = try(aws_elasticache_replication_group.this[0].arn, null)
    replication_group_id       = var.create_live_resources ? "${var.name_prefix}-redis" : null
    runtime_env_host           = "REDIS_HOST"
    runtime_env_password       = "REDIS_PASSWORD"
    runtime_env_port           = "REDIS_PORT"
    security_group_id          = var.create_live_resources ? var.redis_security_group_id : null
    subnet_group_name          = try(aws_elasticache_subnet_group.this[0].name, null)
    commits_plaintext_secret   = false
  }
}
