variable "project_name" {
  description = "Short project name used for non-secret resource naming."
  type        = string
  default     = "trustbite"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}$", var.project_name))
    error_message = "project_name must be 3-31 lowercase alphanumeric or hyphen characters and start with a letter."
  }
}

variable "environment" {
  description = "Non-production environment name."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging"], var.environment)
    error_message = "environment must be dev or staging for TB-INFRA-001."
  }
}

variable "aws_region" {
  description = "AWS region for the selected non-production environment."
  type        = string
  default     = "ap-southeast-1"
}

variable "aws_cognito_user_pool_id" {
  description = "AWS_COGNITO_USER_POOL_ID for the ECS production runtime. Required before live ECS resources are created."
  type        = string
  default     = null
}

variable "aws_cognito_client_id" {
  description = "AWS_COGNITO_CLIENT_ID for the ECS production runtime. Required before live ECS resources are created."
  type        = string
  default     = null
}

variable "allowed_origins" {
  description = "Comma-separated ALLOWED_ORIGINS for the ECS production runtime. Required before live ECS resources are created."
  type        = string
  default     = null
}

variable "api_certificate_arn" {
  description = "ACM certificate ARN for the public HTTPS API listener. Required before live ECS resources are created."
  type        = string
  default     = null

  validation {
    condition     = var.api_certificate_arn == null || can(regex("^arn:aws[a-z-]*:acm:[a-z0-9-]+:[0-9]{12}:certificate/.+", var.api_certificate_arn))
    error_message = "api_certificate_arn must be null or an ACM certificate ARN."
  }
}

variable "owner" {
  description = "Owner tag for cost and operations traceability."
  type        = string
  default     = "trustbite"
}

variable "cost_center" {
  description = "Optional cost-center tag. Leave unset until the approved value is known."
  type        = string
  default     = null
}

variable "tags" {
  description = "Additional non-secret tags applied to AWS resources."
  type        = map(string)
  default     = {}
}

variable "create_live_resources" {
  description = "Guardrail flag for future modules. This skeleton does not create live resources."
  type        = bool
  default     = false
}

variable "create_ecs_resources" {
  description = "Second-phase live gate for ECS runtime resources after ECR repositories exist and deterministic images are pushed."
  type        = bool
  default     = false
}

variable "vpc_cidr" {
  description = "Planned VPC CIDR for the non-production environment."
  type        = string
  default     = "10.42.0.0/16"
}

variable "availability_zone_count" {
  description = "Number of availability zones planned for private/public subnet spread."
  type        = number
  default     = 2

  validation {
    condition     = var.availability_zone_count >= 2 && var.availability_zone_count <= 3
    error_message = "availability_zone_count must be 2 or 3 for the MVP environment."
  }
}

variable "api_container_port" {
  description = "Container port for the Express API task."
  type        = number
  default     = 5000
}

variable "public_ingress_cidrs" {
  description = "CIDR blocks allowed to reach the public API load balancer."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "enable_nat_gateway" {
  description = "Whether private subnets get NAT egress. Keep false until cost and runtime egress strategy are approved."
  type        = bool
  default     = false
}

variable "rds_database_name" {
  description = "Initial TrustBite application database name."
  type        = string
  default     = "trustbite"

  validation {
    condition     = can(regex("^[A-Za-z][A-Za-z0-9_]{0,62}$", var.rds_database_name))
    error_message = "rds_database_name must start with a letter and contain only letters, numbers, or underscores."
  }
}

variable "rds_instance_class" {
  description = "RDS instance class for the non-production PostgreSQL database."
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_postgres_engine_version" {
  description = "RDS PostgreSQL engine version. Must remain PostGIS-compatible."
  type        = string
  default     = "16"
}

variable "rds_parameter_group_family" {
  description = "RDS parameter group family matching the selected PostgreSQL major version."
  type        = string
  default     = "postgres16"
}

variable "rds_allocated_storage_gib" {
  description = "Initial RDS allocated storage in GiB."
  type        = number
  default     = 20

  validation {
    condition     = var.rds_allocated_storage_gib >= 20
    error_message = "rds_allocated_storage_gib must be at least 20 GiB."
  }
}

variable "rds_max_allocated_storage_gib" {
  description = "Maximum RDS autoscaled storage in GiB."
  type        = number
  default     = 100

  validation {
    condition     = var.rds_max_allocated_storage_gib >= var.rds_allocated_storage_gib
    error_message = "rds_max_allocated_storage_gib must be greater than or equal to rds_allocated_storage_gib."
  }
}

variable "rds_backup_retention_days" {
  description = "RDS backup retention in days for non-production proof."
  type        = number
  default     = 7

  validation {
    condition     = var.rds_backup_retention_days >= 1
    error_message = "rds_backup_retention_days must be at least 1."
  }
}

variable "rds_deletion_protection" {
  description = "Whether RDS deletion protection is enabled. Defaults true even for dev."
  type        = bool
  default     = true
}

variable "rds_multi_az" {
  description = "Whether RDS uses Multi-AZ. Defaults false for MVP cost control."
  type        = bool
  default     = false
}

variable "receipt_bucket_name_override" {
  description = "Optional approved non-production receipt bucket name. Leave null to let Terraform use a generated suffix."
  type        = string
  default     = null

  validation {
    condition = (
      var.receipt_bucket_name_override == null ||
      can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.receipt_bucket_name_override))
    )
    error_message = "receipt_bucket_name_override must be a valid lowercase S3 bucket name when set."
  }
}

variable "receipt_object_prefix" {
  description = "S3 object prefix used for receipt uploads."
  type        = string
  default     = "receipts/"

  validation {
    condition     = can(regex("^[A-Za-z0-9!_.*'()/.-]+/$", var.receipt_object_prefix))
    error_message = "receipt_object_prefix must be a non-empty S3 prefix ending with slash."
  }
}

variable "redis_engine_version" {
  description = "ElastiCache Redis engine version for BullMQ."
  type        = string
  default     = "7.1"
}

variable "redis_parameter_group_family" {
  description = "ElastiCache parameter group family matching the Redis major version."
  type        = string
  default     = "redis7"
}

variable "redis_node_type" {
  description = "ElastiCache node type for the non-production Redis baseline."
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_node_count" {
  description = "Number of cache nodes in the replication group."
  type        = number
  default     = 1

  validation {
    condition     = var.redis_node_count >= 1 && var.redis_node_count <= 3
    error_message = "redis_node_count must be between 1 and 3 for the MVP environment."
  }
}

variable "redis_port" {
  description = "Redis port used by BullMQ/ioredis."
  type        = number
  default     = 6379
}

variable "redis_auth_token" {
  description = "Optional Redis AUTH token. Do not set until remote state secret handling is approved because provider-managed auth tokens can enter Terraform state."
  type        = string
  default     = null
  sensitive   = true

  validation {
    condition     = var.redis_auth_token == null || length(var.redis_auth_token) >= 16
    error_message = "redis_auth_token must be null or at least 16 characters."
  }
}

variable "redis_auth_token_update_strategy" {
  description = "ElastiCache AUTH token update strategy. Defaults to SET so rotated Redis tokens are revoked instead of left valid."
  type        = string
  default     = "SET"

  validation {
    condition     = contains(["SET", "ROTATE"], var.redis_auth_token_update_strategy)
    error_message = "redis_auth_token_update_strategy must be SET or ROTATE."
  }
}

variable "redis_auth_token_secret_arn" {
  description = "Optional Secrets Manager ARN that ECS tasks can read for REDIS_PASSWORD. Leave null until the Redis secret boundary is approved."
  type        = string
  default     = null
}

variable "ecr_image_tag_mutability" {
  description = "Image tag mutability for ECR repositories. Keep immutable for deterministic deploy tags."
  type        = string
  default     = "IMMUTABLE"

  validation {
    condition     = contains(["IMMUTABLE", "MUTABLE"], var.ecr_image_tag_mutability)
    error_message = "ecr_image_tag_mutability must be IMMUTABLE or MUTABLE."
  }
}

variable "ecr_scan_on_push" {
  description = "Whether ECR scans images when pushed."
  type        = bool
  default     = true
}

variable "ecr_force_delete" {
  description = "Whether ECR repositories can be force-deleted with images. Defaults false to protect pushed artifacts."
  type        = bool
  default     = false
}

variable "cloudwatch_log_retention_days" {
  description = "CloudWatch log retention for API and worker log groups."
  type        = number
  default     = 30

  validation {
    condition     = contains([7, 14, 30, 60, 90, 120, 150, 180, 365], var.cloudwatch_log_retention_days)
    error_message = "cloudwatch_log_retention_days must be a standard CloudWatch retention value."
  }
}

variable "cloudwatch_alarm_actions" {
  description = "Optional SNS or incident action ARNs for CloudWatch alarms."
  type        = list(string)
  default     = []
}

variable "ecs_image_tag" {
  description = "Deterministic image tag for API and worker task definitions. Must be set to a real commit SHA before live ECS creation."
  type        = string
  default     = "REPLACE_WITH_COMMIT_SHA"
}

variable "ecs_cpu_architecture" {
  description = "Fargate task CPU architecture. Defaults to X86_64 to match the current single-arch local Docker build unless a multi-arch ARM64 image pipeline is approved."
  type        = string
  default     = "X86_64"

  validation {
    condition     = contains(["X86_64", "ARM64"], var.ecs_cpu_architecture)
    error_message = "ecs_cpu_architecture must be X86_64 or ARM64."
  }
}

variable "ecs_private_egress_enabled" {
  description = "Set true only after private ECS tasks have approved outbound egress through NAT or required VPC endpoints for ECR, CloudWatch Logs, Secrets Manager, and AWS APIs."
  type        = bool
  default     = false
}

variable "ecs_api_cpu" {
  description = "Fargate CPU units for the API task."
  type        = number
  default     = 512
}

variable "ecs_api_memory" {
  description = "Fargate memory MiB for the API task."
  type        = number
  default     = 1024
}

variable "ecs_worker_cpu" {
  description = "Fargate CPU units for the worker task."
  type        = number
  default     = 512
}

variable "ecs_worker_memory" {
  description = "Fargate memory MiB for the worker task."
  type        = number
  default     = 1024
}

variable "ecs_api_desired_count" {
  description = "Desired API task count."
  type        = number
  default     = 1
}

variable "ecs_worker_desired_count" {
  description = "Desired worker task count."
  type        = number
  default     = 1
}
