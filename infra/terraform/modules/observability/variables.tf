variable "alarm_actions" {
  description = "Optional CloudWatch alarm action ARNs."
  type        = list(string)
}

variable "api_ecs_cluster_name" {
  description = "API ECS cluster name for alarms."
  type        = string
  default     = null
}

variable "api_ecs_service_name" {
  description = "API ECS service name for alarms."
  type        = string
  default     = null
}

variable "create_live_resources" {
  description = "Guardrail flag for future live resources."
  type        = bool
}

variable "ecs_alarms_enabled" {
  description = "Whether ECS service alarms should be created. Keep false until ECS services exist."
  type        = bool
}

variable "environment" {
  description = "Environment name."
  type        = string
}

variable "name_prefix" {
  description = "Non-secret resource name prefix."
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
}

variable "rds_instance_identifier" {
  description = "RDS instance identifier for storage alarms."
  type        = string
  default     = null
}

variable "redis_alarms_enabled" {
  description = "Whether Redis alarms should be created. Gate on known input intent, not generated replication group ids."
  type        = bool
  default     = false
}

variable "redis_replication_group_id" {
  description = "ElastiCache replication group id for CPU alarms."
  type        = string
  default     = null
}

variable "tags" {
  description = "Common non-secret tags."
  type        = map(string)
}

variable "worker_ecs_cluster_name" {
  description = "Worker ECS cluster name for alarms."
  type        = string
  default     = null
}

variable "web_ecs_cluster_name" {
  description = "Web ECS cluster name for alarms."
  type        = string
  default     = null
}

variable "web_ecs_service_name" {
  description = "Web ECS service name for alarms."
  type        = string
  default     = null
}

variable "worker_ecs_service_name" {
  description = "Worker ECS service name for alarms."
  type        = string
  default     = null
}
