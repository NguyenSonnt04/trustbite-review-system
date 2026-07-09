variable "auth_token" {
  description = "Optional Redis AUTH token. Sensitive; do not set before remote state secret handling is approved."
  type        = string
  default     = null
  sensitive   = true
}

variable "auth_token_state_approved" {
  description = "Explicit approval that the Redis AUTH token may enter encrypted Terraform state for this non-production apply."
  type        = bool
  default     = false
}

variable "auth_token_update_strategy" {
  description = "Redis AUTH token update strategy. SET revokes the previous token; ROTATE must be followed by SET after clients move."
  type        = string
  default     = "SET"

  validation {
    condition     = contains(["SET", "ROTATE"], var.auth_token_update_strategy)
    error_message = "auth_token_update_strategy must be SET or ROTATE."
  }
}

variable "create_live_resources" {
  description = "Guardrail flag for future live resources."
  type        = bool
}

variable "engine_version" {
  description = "Redis engine version."
  type        = string
}

variable "environment" {
  description = "Environment name."
  type        = string
}

variable "name_prefix" {
  description = "Non-secret resource name prefix."
  type        = string
}

variable "node_count" {
  description = "Number of cache nodes in the replication group."
  type        = number
}

variable "node_type" {
  description = "ElastiCache node type."
  type        = string
}

variable "parameter_group_family" {
  description = "ElastiCache parameter group family."
  type        = string
}

variable "port" {
  description = "Redis port."
  type        = number
}

variable "private_subnet_ids" {
  description = "Private subnet ids for the cache subnet group."
  type        = list(string)
}

variable "redis_security_group_id" {
  description = "Security group id that allows Redis ingress from API and worker tasks."
  type        = string
}

variable "tags" {
  description = "Common non-secret tags."
  type        = map(string)
}
