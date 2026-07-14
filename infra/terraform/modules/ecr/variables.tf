variable "create_live_resources" {
  description = "Guardrail flag for future live resources."
  type        = bool
}

variable "environment" {
  description = "Environment name."
  type        = string
}

variable "force_delete" {
  description = "Whether repositories can be force-deleted with images."
  type        = bool
}

variable "image_tag_mutability" {
  description = "ECR image tag mutability setting."
  type        = string
}

variable "name_prefix" {
  description = "Non-secret resource name prefix."
  type        = string
}

variable "scan_on_push" {
  description = "Whether ECR scans images on push."
  type        = bool
}

variable "tags" {
  description = "Common non-secret tags."
  type        = map(string)
}
