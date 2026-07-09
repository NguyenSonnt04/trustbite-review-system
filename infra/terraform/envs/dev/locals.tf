locals {
  name_prefix = "${var.project_name}-${var.environment}"

  base_tags = {
    Project     = "TrustBite"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Story       = "TB-INFRA-001"
    Owner       = var.owner
  }

  optional_tags = var.cost_center == null ? {} : {
    CostCenter = var.cost_center
  }

  common_tags = merge(local.base_tags, local.optional_tags, var.tags)
}
