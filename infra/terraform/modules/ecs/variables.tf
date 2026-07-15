variable "api_container_port" {
  description = "Container port for the Express API task."
  type        = number
}

variable "api_certificate_arn" {
  description = "ACM certificate ARN for the public HTTPS API listener."
  type        = string
  default     = null
}

variable "api_cpu" {
  description = "Fargate CPU units for the API task."
  type        = number
}

variable "api_desired_count" {
  description = "Desired API task count."
  type        = number
}

variable "api_image_tag" {
  description = "Deterministic API image tag."
  type        = string
}

variable "api_log_group_name" {
  description = "CloudWatch log group name for API logs."
  type        = string
  default     = null
}

variable "api_memory" {
  description = "Fargate memory MiB for the API task."
  type        = number
}

variable "api_repository_url" {
  description = "ECR repository URL for the API image."
  type        = string
  default     = null
}

variable "api_security_group_id" {
  description = "API ECS task security group id."
  type        = string
  default     = null
}

variable "api_task_role_arn" {
  description = "API ECS task role ARN."
  type        = string
  default     = null
}

variable "alb_security_group_id" {
  description = "ALB security group id."
  type        = string
  default     = null
}

variable "aws_region" {
  description = "AWS region for runtime config."
  type        = string
}

variable "cognito_client_id" {
  description = "AWS_COGNITO_CLIENT_ID runtime value required by the production API config."
  type        = string
  default     = null
}

variable "cognito_admin_web_client_id" {
  description = "AWS_COGNITO_ADMIN_WEB_CLIENT_ID runtime value required by administrator web authentication."
  type        = string
  default     = null
}

variable "cognito_admin_web_client_secret_arn" {
  description = "Secrets Manager ARN containing AWS_COGNITO_ADMIN_WEB_CLIENT_SECRET."
  type        = string
  default     = null
}

variable "cognito_user_pool_id" {
  description = "AWS_COGNITO_USER_POOL_ID runtime value required by the production API config."
  type        = string
  default     = null
}

variable "admin_web_bff_secret_arn" {
  description = "Secrets Manager ARN containing ADMIN_WEB_BFF_SECRET."
  type        = string
  default     = null
}

variable "admin_web_session_key_secret_arn" {
  description = "Secrets Manager ARN containing ADMIN_WEB_SESSION_KEY_SECRET."
  type        = string
  default     = null
}

variable "create_live_resources" {
  description = "Guardrail flag for future live resources."
  type        = bool
}

variable "cpu_architecture" {
  description = "Fargate task CPU architecture."
  type        = string
}

variable "cognito_user_pool_arn" {
  description = "Cognito user pool ARN required by the API task role for administrator provisioning."
  type        = string
  default     = null
}

variable "database_host" {
  description = "RDS endpoint address for DATABASE_HOST."
  type        = string
  default     = null
}

variable "database_name" {
  description = "DATABASE_NAME runtime value."
  type        = string
}

variable "database_secret_arn" {
  description = "Secrets Manager ARN for RDS managed master credentials."
  type        = string
  default     = null
}

variable "environment" {
  description = "Environment name."
  type        = string
}

variable "execution_role_arn" {
  description = "ECS execution role ARN."
  type        = string
  default     = null
}

variable "name_prefix" {
  description = "Non-secret resource name prefix."
  type        = string
}

variable "allowed_origins" {
  description = "Comma-separated ALLOWED_ORIGINS runtime value required by the production API config."
  type        = string
  default     = null
}

variable "nat_gateway_enabled" {
  description = "Whether this stack creates NAT egress for private ECS tasks. Current live ECS support requires NAT because VPC endpoints are not modeled yet."
  type        = bool
  default     = false
}

variable "private_subnet_ids" {
  description = "Private subnet ids for ECS tasks."
  type        = list(string)
}

variable "private_egress_enabled" {
  description = "Whether private ECS tasks have approved outbound egress through NAT or required VPC endpoints."
  type        = bool
}

variable "public_subnet_ids" {
  description = "Public subnet ids for the API load balancer."
  type        = list(string)
}

variable "receipt_bucket_name" {
  description = "S3 receipt bucket name for AWS_S3_BUCKET_NAME."
  type        = string
  default     = null
}

variable "receipt_bucket_domain_name" {
  description = "S3 bucket domain used as the default avatar upload host."
  type        = string
  default     = null
}

variable "redis_auth_secret_arn" {
  description = "Optional REDIS_PASSWORD secret ARN."
  type        = string
  default     = null
}

variable "redis_host" {
  description = "Redis endpoint for REDIS_HOST."
  type        = string
  default     = null
}

variable "redis_port" {
  description = "Redis port for REDIS_PORT."
  type        = number
}

variable "tags" {
  description = "Common non-secret tags."
  type        = map(string)
}

variable "vpc_id" {
  description = "VPC id for the API load balancer target group."
  type        = string
  default     = null
}

variable "worker_cpu" {
  description = "Fargate CPU units for the worker task."
  type        = number
}

variable "worker_desired_count" {
  description = "Desired worker task count."
  type        = number
}

variable "worker_image_tag" {
  description = "Deterministic worker image tag."
  type        = string
}

variable "worker_log_group_name" {
  description = "CloudWatch log group name for worker logs."
  type        = string
  default     = null
}

variable "worker_memory" {
  description = "Fargate memory MiB for the worker task."
  type        = number
}

variable "worker_repository_url" {
  description = "ECR repository URL for the worker image."
  type        = string
  default     = null
}

variable "worker_security_group_id" {
  description = "Worker ECS task security group id."
  type        = string
  default     = null
}

variable "worker_task_role_arn" {
  description = "Worker ECS task role ARN."
  type        = string
  default     = null
}
