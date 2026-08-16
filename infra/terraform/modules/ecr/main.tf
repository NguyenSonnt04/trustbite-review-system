locals {
  repositories = {
    api = {
      name        = "${var.name_prefix}-api"
      description = "TrustBite Express API image repository"
    }
    web = {
      name        = "${var.name_prefix}-web"
      description = "TrustBite Next.js web image repository"
    }
    worker = {
      name        = "${var.name_prefix}-worker"
      description = "TrustBite receipt OCR worker image repository"
    }
  }

  contract = {
    api_repository        = "${var.name_prefix}-api"
    create_live_resources = var.create_live_resources
    encryption            = "AES256"
    environment           = var.environment
    force_delete          = var.force_delete
    image_scan_on_push    = var.scan_on_push
    image_tag_mutability  = var.image_tag_mutability
    lifecycle_policy      = "not-configured-no-expiration"
    module                = "ecr"
    web_repository        = "${var.name_prefix}-web"
    worker_repository     = "${var.name_prefix}-worker"
  }
}

resource "aws_ecr_repository" "this" {
  for_each = var.create_live_resources ? local.repositories : {}

  force_delete         = var.force_delete
  image_tag_mutability = var.image_tag_mutability
  name                 = each.value.name

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = var.scan_on_push
  }

  tags = merge(var.tags, {
    Name        = each.value.name
    Description = each.value.description
    ImageRole   = each.key
  })

  lifecycle {
    precondition {
      condition     = !var.force_delete
      error_message = "ECR force_delete must remain false unless a human-approved artifact deletion exception is recorded."
    }

    precondition {
      condition     = var.image_tag_mutability == "IMMUTABLE"
      error_message = "ECR repositories must use immutable tags for deterministic TrustBite deploys."
    }
  }
}

output "contract" {
  description = "Non-secret ECR module contract for the next implementation slice."
  value       = local.contract
}

output "ids" {
  description = "ECR repository ids for image build and ECS wiring. Empty until live resources are enabled."
  value = {
    repositories = {
      for role, repository in aws_ecr_repository.this : role => {
        arn            = repository.arn
        name           = repository.name
        registry_id    = repository.registry_id
        repository_url = repository.repository_url
      }
    }
    api_repository_name    = try(aws_ecr_repository.this["api"].name, null)
    api_repository_url     = try(aws_ecr_repository.this["api"].repository_url, null)
    image_tag_policy       = "commit-sha"
    web_repository_name    = try(aws_ecr_repository.this["web"].name, null)
    web_repository_url     = try(aws_ecr_repository.this["web"].repository_url, null)
    worker_repository_name = try(aws_ecr_repository.this["worker"].name, null)
    worker_repository_url  = try(aws_ecr_repository.this["worker"].repository_url, null)
  }
}
