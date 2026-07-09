variable "bucket_name_override" {
  description = "Optional approved non-production receipt bucket name."
  type        = string
  default     = null
}

variable "cors_allowed_origins" {
  description = "Browser origins allowed to PUT presigned receipt/avatar objects."
  type        = list(string)
  default     = []
}

variable "create_live_resources" {
  description = "Guardrail flag for future live resources."
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

variable "object_prefix" {
  description = "S3 object prefix used for receipt uploads."
  type        = string
}

variable "tags" {
  description = "Common non-secret tags."
  type        = map(string)
}
