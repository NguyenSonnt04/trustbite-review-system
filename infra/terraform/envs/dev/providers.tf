provider "aws" {
  region = var.aws_region

  skip_credentials_validation = !var.create_live_resources
  skip_metadata_api_check     = !var.create_live_resources
  skip_requesting_account_id  = !var.create_live_resources

  default_tags {
    tags = local.common_tags
  }
}
