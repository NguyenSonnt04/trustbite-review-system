locals {
  bucket_prefix = "${var.name_prefix}-receipts-"

  contract = {
    block_public_access    = true
    bucket_name_overridden = var.bucket_name_override != null
    create_live_resources  = var.create_live_resources
    cors_allowed_origins   = length(var.cors_allowed_origins)
    encryption             = "SSE-S3"
    encryption_required    = true
    environment            = var.environment
    force_destroy          = false
    lifecycle_policy       = "no-delete-or-expiration-rules"
    module                 = "s3_receipts"
    name_prefix            = local.bucket_prefix
    object_ownership       = "BucketOwnerEnforced"
    object_prefix          = var.object_prefix
    prevent_destroy        = true
    public_acl             = false
    tls_only_policy        = true
    versioning             = "Enabled"
  }
}

resource "aws_s3_bucket" "receipts" {
  count = var.create_live_resources ? 1 : 0

  bucket        = var.bucket_name_override
  bucket_prefix = var.bucket_name_override == null ? local.bucket_prefix : null
  force_destroy = false

  tags = merge(var.tags, {
    Name        = "${var.name_prefix}-receipts"
    ObjectScope = var.object_prefix
  })

  lifecycle {
    prevent_destroy = true

    precondition {
      condition     = var.environment != "production"
      error_message = "TB-INFRA-001 may only create non-production receipt buckets."
    }
  }
}

resource "aws_s3_bucket_public_access_block" "receipts" {
  count = var.create_live_resources ? 1 : 0

  block_public_acls       = true
  block_public_policy     = true
  bucket                  = aws_s3_bucket.receipts[0].id
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "receipts" {
  count = var.create_live_resources ? 1 : 0

  bucket = aws_s3_bucket.receipts[0].id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "receipts" {
  count = var.create_live_resources ? 1 : 0

  bucket = aws_s3_bucket.receipts[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_cors_configuration" "receipts" {
  count = var.create_live_resources ? 1 : 0

  bucket = aws_s3_bucket.receipts[0].id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 300
  }

  lifecycle {
    precondition {
      condition     = length(var.cors_allowed_origins) > 0
      error_message = "Receipt/avatar S3 bucket CORS requires at least one ALLOWED_ORIGINS value before live resources can be created."
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "receipts" {
  count = var.create_live_resources ? 1 : 0

  bucket = aws_s3_bucket.receipts[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_policy" "receipts_tls_only" {
  count = var.create_live_resources ? 1 : 0

  bucket = aws_s3_bucket.receipts[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.receipts[0].arn,
          "${aws_s3_bucket.receipts[0].arn}/*",
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.receipts]
}

output "contract" {
  description = "Non-secret S3 receipt bucket module contract for the next implementation slice."
  value       = local.contract
}

output "ids" {
  description = "S3 receipt bucket ids for runtime config and IAM wiring. Empty until live resources are enabled."
  value = {
    bucket_arn         = try(aws_s3_bucket.receipts[0].arn, null)
    bucket_domain_name = try(aws_s3_bucket.receipts[0].bucket_domain_name, null)
    bucket_name        = try(aws_s3_bucket.receipts[0].bucket, null)
    object_prefix      = var.object_prefix
    runtime_env_var    = "AWS_S3_BUCKET_NAME"
  }
}
