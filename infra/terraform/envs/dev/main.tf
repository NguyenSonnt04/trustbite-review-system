module "network" {
  source = "../../modules/network"

  availability_zone_count = var.availability_zone_count
  api_container_port      = var.api_container_port
  create_live_resources   = var.create_live_resources
  enable_nat_gateway      = var.enable_nat_gateway
  environment             = var.environment
  name_prefix             = local.name_prefix
  public_ingress_cidrs    = var.public_ingress_cidrs
  redis_port              = var.redis_port
  tags                    = local.common_tags
  vpc_cidr                = var.vpc_cidr
}

module "rds" {
  source = "../../modules/rds"

  allocated_storage_gib     = var.rds_allocated_storage_gib
  backup_retention_days     = var.rds_backup_retention_days
  create_live_resources     = var.create_live_resources
  database_name             = var.rds_database_name
  deletion_protection       = var.rds_deletion_protection
  environment               = var.environment
  instance_class            = var.rds_instance_class
  max_allocated_storage_gib = var.rds_max_allocated_storage_gib
  multi_az                  = var.rds_multi_az
  name_prefix               = local.name_prefix
  parameter_group_family    = var.rds_parameter_group_family
  postgres_engine_version   = var.rds_postgres_engine_version
  private_subnet_ids        = module.network.ids.private_subnet_ids
  rds_security_group_id     = module.network.ids.rds_security_group_id
  tags                      = local.common_tags
}

module "s3_receipts" {
  source = "../../modules/s3_receipts"

  bucket_name_override  = var.receipt_bucket_name_override
  cors_allowed_origins  = var.allowed_origins == null ? [] : compact([for origin in split(",", var.allowed_origins) : trimspace(origin)])
  create_live_resources = var.create_live_resources
  environment           = var.environment
  object_prefix         = var.receipt_object_prefix
  name_prefix           = local.name_prefix
  tags                  = local.common_tags
}

module "redis" {
  source = "../../modules/redis"

  auth_token                 = var.redis_auth_token
  auth_token_state_approved  = var.redis_auth_token_state_approved
  auth_token_update_strategy = var.redis_auth_token_update_strategy
  create_live_resources      = var.create_live_resources
  engine_version             = var.redis_engine_version
  environment                = var.environment
  node_count                 = var.redis_node_count
  node_type                  = var.redis_node_type
  parameter_group_family     = var.redis_parameter_group_family
  port                       = var.redis_port
  private_subnet_ids         = module.network.ids.private_subnet_ids
  redis_security_group_id    = module.network.ids.redis_security_group_id
  name_prefix                = local.name_prefix
  tags                       = local.common_tags
}

module "ecr" {
  source = "../../modules/ecr"

  create_live_resources = var.create_live_resources
  environment           = var.environment
  force_delete          = var.ecr_force_delete
  image_tag_mutability  = var.ecr_image_tag_mutability
  name_prefix           = local.name_prefix
  scan_on_push          = var.ecr_scan_on_push
  tags                  = local.common_tags
}

module "iam" {
  source = "../../modules/iam"

  admin_web_bff_secret_arn            = var.admin_web_bff_secret_arn
  admin_web_session_key_secret_arn    = var.admin_web_session_key_secret_arn
  cognito_admin_web_client_secret_arn = var.aws_cognito_admin_web_client_secret_arn
  cognito_user_pool_arn               = var.aws_cognito_user_pool_arn
  create_live_resources               = var.create_live_resources
  environment                         = var.environment
  name_prefix                         = local.name_prefix
  rds_master_user_secret_arn          = module.rds.ids.master_user_secret_arn
  receipt_bucket_arn                  = module.s3_receipts.ids.bucket_arn
  receipt_object_prefix               = var.receipt_object_prefix
  redis_auth_token_secret_arn         = var.redis_auth_token_secret_arn
  task_secret_policy_enabled          = true
  tags                                = local.common_tags
}

module "observability" {
  source = "../../modules/observability"

  alarm_actions              = var.cloudwatch_alarm_actions
  api_ecs_cluster_name       = "${local.name_prefix}-cluster"
  api_ecs_service_name       = "${local.name_prefix}-api"
  create_live_resources      = var.create_live_resources
  ecs_alarms_enabled         = var.create_ecs_resources
  environment                = var.environment
  log_retention_days         = var.cloudwatch_log_retention_days
  name_prefix                = local.name_prefix
  rds_instance_identifier    = module.rds.ids.db_instance_identifier
  redis_alarms_enabled       = var.redis_node_count > 0
  redis_replication_group_id = "${local.name_prefix}-redis"
  tags                       = local.common_tags
  worker_ecs_cluster_name    = "${local.name_prefix}-cluster"
  worker_ecs_service_name    = "${local.name_prefix}-worker"
}

module "ecs" {
  source = "../../modules/ecs"

  depends_on = [module.iam]

  allowed_origins                     = var.allowed_origins
  api_certificate_arn                 = var.api_certificate_arn
  api_container_port                  = var.api_container_port
  api_cpu                             = var.ecs_api_cpu
  api_desired_count                   = var.ecs_api_desired_count
  api_image_tag                       = var.ecs_image_tag
  api_log_group_name                  = module.observability.ids.api_log_group_name
  api_memory                          = var.ecs_api_memory
  api_repository_url                  = module.ecr.ids.api_repository_url
  alb_security_group_id               = module.network.ids.alb_security_group_id
  api_security_group_id               = module.network.ids.api_security_group_id
  api_task_role_arn                   = module.iam.ids.api_task_role_arn
  aws_region                          = var.aws_region
  admin_web_bff_secret_arn            = var.admin_web_bff_secret_arn
  admin_web_session_key_secret_arn    = var.admin_web_session_key_secret_arn
  cognito_admin_web_client_id         = var.aws_cognito_admin_web_client_id
  cognito_admin_web_client_secret_arn = var.aws_cognito_admin_web_client_secret_arn
  cognito_client_id                   = var.aws_cognito_client_id
  cognito_user_pool_arn               = var.aws_cognito_user_pool_arn
  cognito_user_pool_id                = var.aws_cognito_user_pool_id
  create_live_resources               = var.create_live_resources && var.create_ecs_resources
  cpu_architecture                    = var.ecs_cpu_architecture
  database_host                       = module.rds.ids.db_instance_address
  database_name                       = var.rds_database_name
  database_secret_arn                 = module.rds.ids.master_user_secret_arn
  environment                         = var.environment
  execution_role_arn                  = module.iam.ids.execution_role_arn
  name_prefix                         = local.name_prefix
  nat_gateway_enabled                 = var.enable_nat_gateway
  private_egress_enabled              = var.ecs_private_egress_enabled
  private_subnet_ids                  = module.network.ids.private_subnet_ids
  public_subnet_ids                   = module.network.ids.public_subnet_ids
  receipt_bucket_domain_name          = module.s3_receipts.ids.bucket_domain_name
  receipt_bucket_name                 = module.s3_receipts.ids.bucket_name
  redis_auth_secret_arn               = var.redis_auth_token_secret_arn
  redis_host                          = module.redis.ids.primary_endpoint_address
  redis_port                          = var.redis_port
  tags                                = local.common_tags
  vpc_id                              = module.network.ids.vpc_id
  worker_cpu                          = var.ecs_worker_cpu
  worker_desired_count                = var.ecs_worker_desired_count
  worker_image_tag                    = var.ecs_image_tag
  worker_log_group_name               = module.observability.ids.worker_log_group_name
  worker_memory                       = var.ecs_worker_memory
  worker_repository_url               = module.ecr.ids.worker_repository_url
  worker_security_group_id            = module.network.ids.worker_security_group_id
  worker_task_role_arn                = module.iam.ids.worker_task_role_arn
}
