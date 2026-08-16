output "environment_contract" {
  description = "Non-secret summary of the intended dev infrastructure contract."
  value = {
    aws_region                    = var.aws_region
    create_live_resources_enabled = var.create_live_resources
    environment                   = var.environment
    name_prefix                   = local.name_prefix
    network_ids                   = module.network.ids
    rds_ids                       = module.rds.ids
    redis_ids                     = module.redis.ids
    s3_receipt_ids                = module.s3_receipts.ids
    iam_ids                       = module.iam.ids
    observability_ids             = module.observability.ids
    ecs_ids                       = module.ecs.ids
    modules = {
      ecr           = module.ecr.contract
      ecs           = module.ecs.contract
      iam           = module.iam.contract
      network       = module.network.contract
      observability = module.observability.contract
      rds           = module.rds.contract
      redis         = module.redis.contract
      s3_receipts   = module.s3_receipts.contract
    }
    ecr_ids = module.ecr.ids
    runtime_smoke = {
      TRUSTBITE_API_BASE_URL = module.ecs.ids.api_alb_dns_name == null ? null : "http://${module.ecs.ids.api_alb_dns_name}"
      DATABASE_HOST          = module.rds.ids.db_instance_address
      DATABASE_NAME          = var.rds_database_name
      DATABASE_SSL           = "true"
      AWS_REGION             = var.aws_region
      AWS_S3_BUCKET_NAME     = module.s3_receipts.ids.bucket_name
      REDIS_HOST             = module.redis.ids.primary_endpoint_address
      REDIS_PORT             = tostring(var.redis_port)
      REDIS_TLS              = "true"
    }
    web_runtime = {
      TRUSTBITE_WEB_URL        = var.web_domain == null ? null : "https://${var.web_domain}"
      TRUSTBITE_SERVER_API_URL = var.web_api_base_url
      NEXT_PUBLIC_API_URL      = var.web_api_base_url
      NEXT_PUBLIC_AWS_REGION   = var.aws_region
      WEB_ECS_SERVICE_NAME     = module.ecs.ids.web_service_name
      WEB_TASK_DEFINITION_ARN  = module.ecs.ids.web_task_definition_arn
    }
  }
}
