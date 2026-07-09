variable "allocated_storage_gib" {
  description = "Initial allocated storage in GiB."
  type        = number
}

variable "backup_retention_days" {
  description = "Backup retention period in days."
  type        = number
}

variable "create_live_resources" {
  description = "Guardrail flag for future live resources."
  type        = bool
}

variable "database_name" {
  description = "Initial application database name."
  type        = string
}

variable "deletion_protection" {
  description = "Whether RDS deletion protection is enabled."
  type        = bool
}

variable "environment" {
  description = "Environment name."
  type        = string
}

variable "instance_class" {
  description = "RDS instance class."
  type        = string
}

variable "max_allocated_storage_gib" {
  description = "Maximum allocated storage in GiB."
  type        = number
}

variable "multi_az" {
  description = "Whether the RDS instance is Multi-AZ."
  type        = bool
}

variable "name_prefix" {
  description = "Non-secret resource name prefix."
  type        = string
}

variable "parameter_group_family" {
  description = "DB parameter group family."
  type        = string
}

variable "postgres_engine_version" {
  description = "RDS PostgreSQL engine version."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet ids for the DB subnet group."
  type        = list(string)
}

variable "rds_security_group_id" {
  description = "Security group id that allows PostgreSQL ingress from API and worker tasks."
  type        = string
}

variable "tags" {
  description = "Common non-secret tags."
  type        = map(string)
}
