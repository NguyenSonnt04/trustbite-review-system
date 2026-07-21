locals {
  cluster_name        = "${var.name_prefix}-cluster"
  api_service_name    = "${var.name_prefix}-api"
  web_service_name    = "${var.name_prefix}-web"
  worker_service_name = "${var.name_prefix}-worker"
  api_image           = var.create_live_resources ? "${var.api_repository_url}:${var.api_image_tag}" : "placeholder-api"
  web_image           = var.create_live_resources ? "${var.web_repository_url}:${var.web_image_tag}" : "placeholder-web"
  worker_image        = var.create_live_resources ? "${var.worker_repository_url}:${var.worker_image_tag}" : "placeholder-worker"

  common_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "AWS_REGION", value = var.aws_region },
    { name = "AWS_COGNITO_USER_POOL_ID", value = var.cognito_user_pool_id == null ? "" : var.cognito_user_pool_id },
    { name = "AWS_COGNITO_CLIENT_ID", value = var.cognito_client_id == null ? "" : var.cognito_client_id },
    { name = "ALLOWED_ORIGINS", value = var.allowed_origins == null ? "" : var.allowed_origins },
    { name = "AWS_S3_BUCKET_NAME", value = coalesce(var.receipt_bucket_name, "pending-receipt-bucket") },
    { name = "TRUSTBITE_AVATAR_ALLOWED_HOSTS", value = coalesce(var.receipt_bucket_domain_name, "pending-receipt-bucket.s3.amazonaws.com") },
    { name = "TRUSTBITE_S3_ALLOWED_HOSTS", value = coalesce(var.receipt_bucket_domain_name, "pending-receipt-bucket.s3.amazonaws.com") },
    { name = "TRUSTBITE_S3_ALLOWED_PREFIXES", value = "avatars/,receipts/,review-media/,merchant-claims/,restaurant-images/" },
    { name = "DATABASE_HOST", value = coalesce(var.database_host, "pending-rds-host") },
    { name = "DATABASE_PORT", value = "5432" },
    { name = "DATABASE_NAME", value = var.database_name },
    { name = "DATABASE_SSL", value = "true" },
    { name = "REDIS_HOST", value = coalesce(var.redis_host, "pending-redis-host") },
    { name = "REDIS_PORT", value = tostring(var.redis_port) },
    { name = "REDIS_DB", value = "0" },
    { name = "REDIS_TLS", value = "true" },
    { name = "OCR_PROVIDER", value = "textract" },
    { name = "OCR_QUEUE_NAME", value = "receipt-ocr" },
  ]

  api_environment = concat(local.common_environment, [
    { name = "AWS_COGNITO_ADMIN_WEB_CLIENT_ID", value = var.cognito_admin_web_client_id == null ? "" : var.cognito_admin_web_client_id },
    { name = "TRUST_PROXY", value = "1" },
  ])

  web_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = tostring(var.web_container_port) },
    { name = "NEXT_PUBLIC_API_URL", value = var.web_api_base_url == null ? "" : var.web_api_base_url },
    { name = "NEXT_PUBLIC_AWS_REGION", value = var.aws_region },
    { name = "TRUSTBITE_SERVER_API_URL", value = var.web_api_base_url == null ? "" : var.web_api_base_url },
    { name = "ADMIN_WEB_PUBLIC_ORIGIN", value = var.web_domain == null ? "" : "https://${var.web_domain}" },
    { name = "ADMIN_WEB_TRUSTED_CLIENT_IP_HEADER", value = "x-forwarded-for" },
  ]

  web_secrets = var.admin_web_bff_secret_arn == null ? [] : [
    { name = "ADMIN_WEB_BFF_SECRET", valueFrom = var.admin_web_bff_secret_arn },
  ]

  database_secrets = var.database_secret_arn == null ? [] : [
    { name = "DATABASE_USER", valueFrom = "${var.database_secret_arn}:username::" },
    { name = "DATABASE_PASSWORD", valueFrom = "${var.database_secret_arn}:password::" },
  ]

  redis_secrets = var.redis_auth_secret_arn == null ? [] : [
    { name = "REDIS_PASSWORD", valueFrom = var.redis_auth_secret_arn },
  ]

  admin_web_secrets = [
    for secret in [
      {
        name      = "AWS_COGNITO_ADMIN_WEB_CLIENT_SECRET"
        valueFrom = var.cognito_admin_web_client_secret_arn
      },
      {
        name      = "ADMIN_WEB_BFF_SECRET"
        valueFrom = var.admin_web_bff_secret_arn
      },
      {
        name      = "ADMIN_WEB_SESSION_KEY_SECRET"
        valueFrom = var.admin_web_session_key_secret_arn
      },
    ] : secret if secret.valueFrom != null
  ]

  contract = {
    api_container_port    = var.api_container_port
    api_command           = ["node", "src/server.js"]
    api_service           = local.api_service_name
    create_live_resources = var.create_live_resources
    creation_phase        = "after-ecr-image-push"
    cpu_architecture      = var.cpu_architecture
    environment           = var.environment
    launch_type           = "FARGATE"
    private_egress        = var.private_egress_enabled
    module                = "ecs"
    public_ingress        = "shared-alb-host-routed-api-and-web"
    public_tls            = var.api_certificate_arn != null
    web_container_port    = var.web_container_port
    web_domain            = var.web_domain
    web_service           = local.web_service_name
    web_tls               = var.web_certificate_arn != null
    worker_command        = ["node", "src/worker.js"]
    worker_ingress        = false
    worker_service        = local.worker_service_name
  }
}

resource "aws_ecs_cluster" "this" {
  count = var.create_live_resources ? 1 : 0

  name = local.cluster_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(var.tags, {
    Name = local.cluster_name
  })
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  count = var.create_live_resources ? 1 : 0

  capacity_providers = ["FARGATE"]
  cluster_name       = aws_ecs_cluster.this[0].name

  default_capacity_provider_strategy {
    base              = 1
    capacity_provider = "FARGATE"
    weight            = 100
  }
}

resource "aws_lb" "api" {
  count = var.create_live_resources ? 1 : 0

  internal           = false
  load_balancer_type = "application"
  name               = "${var.name_prefix}-api-alb"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-alb"
  })

  lifecycle {
    precondition {
      condition     = var.alb_security_group_id != null && var.alb_security_group_id != ""
      error_message = "API ALB requires an ALB security group id."
    }

    precondition {
      condition     = length(var.public_subnet_ids) >= 2
      error_message = "API ALB requires at least two public subnet ids."
    }
  }
}

resource "aws_lb_target_group" "api" {
  count = var.create_live_resources ? 1 : 0

  deregistration_delay = 30
  name                 = "${var.name_prefix}-api-tg"
  port                 = var.api_container_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-tg"
  })

  lifecycle {
    precondition {
      condition     = var.vpc_id != null && var.vpc_id != ""
      error_message = "API target group requires a VPC id."
    }
  }
}

resource "aws_lb_listener" "api_http" {
  count = var.create_live_resources ? 1 : 0

  load_balancer_arn = aws_lb.api[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "api_https" {
  count = var.create_live_resources ? 1 : 0

  certificate_arn   = var.api_certificate_arn
  load_balancer_arn = aws_lb.api[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"

  default_action {
    target_group_arn = aws_lb_target_group.api[0].arn
    type             = "forward"
  }

  lifecycle {
    precondition {
      condition     = try(trimspace(var.api_certificate_arn) != "", false)
      error_message = "Public API HTTPS listener requires an ACM certificate ARN."
    }
  }
}

resource "aws_lb_listener_certificate" "web" {
  count = var.create_live_resources ? 1 : 0

  certificate_arn = var.web_certificate_arn
  listener_arn    = aws_lb_listener.api_https[0].arn

  lifecycle {
    precondition {
      condition     = try(trimspace(var.web_certificate_arn) != "", false)
      error_message = "Public web routing requires an ACM certificate ARN."
    }
  }
}

resource "aws_lb_target_group" "web" {
  count = var.create_live_resources ? 1 : 0

  deregistration_delay = 30
  name                 = "${var.name_prefix}-web-tg"
  port                 = var.web_container_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-web-tg"
  })
}

resource "aws_lb_listener_rule" "web" {
  count = var.create_live_resources ? 1 : 0

  listener_arn = aws_lb_listener.api_https[0].arn
  priority     = 100

  action {
    target_group_arn = aws_lb_target_group.web[0].arn
    type             = "forward"
  }

  condition {
    host_header {
      values = [var.web_domain]
    }
  }

  lifecycle {
    precondition {
      condition     = try(trimspace(var.web_domain) != "", false)
      error_message = "Public web routing requires a web domain."
    }
  }
}

resource "aws_ecs_task_definition" "api" {
  count = var.create_live_resources ? 1 : 0

  container_definitions = jsonencode([
    {
      command     = ["node", "src/server.js"]
      cpu         = var.api_cpu
      environment = concat(local.api_environment, [{ name = "PORT", value = tostring(var.api_container_port) }, { name = "OCR_WORKER_ENABLED", value = "false" }])
      essential   = true
      image       = local.api_image
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = var.api_log_group_name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "api"
        }
      }
      memory = var.api_memory
      name   = "api"
      portMappings = [
        {
          containerPort = var.api_container_port
          hostPort      = var.api_container_port
          protocol      = "tcp"
        }
      ]
      secrets = concat(local.database_secrets, local.redis_secrets, local.admin_web_secrets)
    }
  ])
  cpu                      = var.api_cpu
  execution_role_arn       = var.execution_role_arn
  family                   = "${var.name_prefix}-api"
  memory                   = var.api_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  task_role_arn            = var.api_task_role_arn

  runtime_platform {
    cpu_architecture        = var.cpu_architecture
    operating_system_family = "LINUX"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-task"
  })

  lifecycle {
    precondition {
      condition     = var.api_image_tag != "REPLACE_WITH_COMMIT_SHA"
      error_message = "API image tag must be a deterministic commit SHA before live ECS resources can be created."
    }

    precondition {
      condition     = var.private_egress_enabled && var.nat_gateway_enabled
      error_message = "Private ECS tasks require actual outbound egress. This stack does not model VPC endpoints yet, so enable_nat_gateway must be true before live ECS resources can be created."
    }

    precondition {
      condition     = try(trimspace(var.cognito_user_pool_id) != "", false)
      error_message = "API ECS tasks require AWS_COGNITO_USER_POOL_ID before live resources can be created."
    }

    precondition {
      condition     = try(trimspace(var.cognito_user_pool_arn) != "", false)
      error_message = "API ECS tasks require a Cognito user pool ARN for administrator provisioning permissions."
    }

    precondition {
      condition     = try(trimspace(var.cognito_client_id) != "", false)
      error_message = "API ECS tasks require AWS_COGNITO_CLIENT_ID before live resources can be created."
    }

    precondition {
      condition     = try(trimspace(var.cognito_admin_web_client_id) != "", false)
      error_message = "API ECS tasks require AWS_COGNITO_ADMIN_WEB_CLIENT_ID before live resources can be created."
    }

    precondition {
      condition     = try(trimspace(var.cognito_admin_web_client_secret_arn) != "", false)
      error_message = "API ECS tasks require cognito_admin_web_client_secret_arn before live resources can be created."
    }

    precondition {
      condition     = try(trimspace(var.admin_web_bff_secret_arn) != "", false)
      error_message = "API ECS tasks require admin_web_bff_secret_arn before live resources can be created."
    }

    precondition {
      condition     = try(trimspace(var.admin_web_session_key_secret_arn) != "", false)
      error_message = "API ECS tasks require admin_web_session_key_secret_arn before live resources can be created."
    }

    precondition {
      condition     = try(trimspace(var.allowed_origins) != "", false)
      error_message = "API ECS tasks require ALLOWED_ORIGINS before live resources can be created."
    }

    precondition {
      condition     = try(trimspace(var.receipt_bucket_domain_name) != "", false)
      error_message = "API ECS tasks require the S3 bucket domain for TRUSTBITE_AVATAR_ALLOWED_HOSTS before live resources can be created."
    }

    precondition {
      condition     = try(trimspace(var.database_secret_arn) != "", false)
      error_message = "API ECS tasks require database_secret_arn so DATABASE_USER and DATABASE_PASSWORD are injected before live resources can be created."
    }

    precondition {
      condition     = try(trimspace(var.redis_auth_secret_arn) != "", false)
      error_message = "API ECS tasks require redis_auth_secret_arn so REDIS_PASSWORD is injected before live resources can be created."
    }
  }
}

resource "aws_ecs_task_definition" "web" {
  count = var.create_live_resources ? 1 : 0

  container_definitions = jsonencode([
    {
      cpu         = var.web_cpu
      environment = local.web_environment
      essential   = true
      image       = local.web_image
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = var.web_log_group_name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "web"
        }
      }
      memory = var.web_memory
      name   = "web"
      portMappings = [
        {
          containerPort = var.web_container_port
          hostPort      = var.web_container_port
          protocol      = "tcp"
        }
      ]
      secrets = local.web_secrets
    }
  ])
  cpu                      = var.web_cpu
  execution_role_arn       = var.execution_role_arn
  family                   = "${var.name_prefix}-web"
  memory                   = var.web_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  task_role_arn            = var.web_task_role_arn

  runtime_platform {
    cpu_architecture        = var.cpu_architecture
    operating_system_family = "LINUX"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-web-task"
  })

  lifecycle {
    precondition {
      condition     = var.web_image_tag != "REPLACE_WITH_COMMIT_SHA"
      error_message = "Web image tag must be a deterministic commit SHA before live ECS resources can be created."
    }

    precondition {
      condition     = var.private_egress_enabled && var.nat_gateway_enabled
      error_message = "Private ECS tasks require actual outbound egress. This stack does not model VPC endpoints yet, so enable_nat_gateway must be true before live ECS resources can be created."
    }

    precondition {
      condition     = try(trimspace(var.web_api_base_url) != "", false)
      error_message = "Web ECS tasks require an HTTPS API base URL."
    }

    precondition {
      condition     = try(startswith(var.web_api_base_url, "https://"), false)
      error_message = "Web ECS tasks require web_api_base_url to use HTTPS."
    }

    precondition {
      condition     = try(trimspace(var.admin_web_bff_secret_arn) != "", false)
      error_message = "Web ECS tasks require admin_web_bff_secret_arn."
    }
  }
}

resource "aws_ecs_task_definition" "worker" {
  count = var.create_live_resources ? 1 : 0

  container_definitions = jsonencode([
    {
      command     = ["node", "src/worker.js"]
      cpu         = var.worker_cpu
      environment = local.common_environment
      essential   = true
      image       = local.worker_image
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = var.worker_log_group_name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "worker"
        }
      }
      memory  = var.worker_memory
      name    = "worker"
      secrets = concat(local.database_secrets, local.redis_secrets)
    }
  ])
  cpu                      = var.worker_cpu
  execution_role_arn       = var.execution_role_arn
  family                   = "${var.name_prefix}-worker"
  memory                   = var.worker_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  task_role_arn            = var.worker_task_role_arn

  runtime_platform {
    cpu_architecture        = var.cpu_architecture
    operating_system_family = "LINUX"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-worker-task"
  })

  lifecycle {
    precondition {
      condition     = var.worker_image_tag != "REPLACE_WITH_COMMIT_SHA"
      error_message = "Worker image tag must be a deterministic commit SHA before live ECS resources can be created."
    }

    precondition {
      condition     = var.private_egress_enabled && var.nat_gateway_enabled
      error_message = "Private ECS tasks require actual outbound egress. This stack does not model VPC endpoints yet, so enable_nat_gateway must be true before live ECS resources can be created."
    }

    precondition {
      condition     = try(trimspace(var.database_secret_arn) != "", false)
      error_message = "Worker ECS tasks require database_secret_arn so DATABASE_USER and DATABASE_PASSWORD are injected before live resources can be created."
    }

    precondition {
      condition     = try(trimspace(var.redis_auth_secret_arn) != "", false)
      error_message = "Worker ECS tasks require redis_auth_secret_arn so REDIS_PASSWORD is injected before live resources can be created."
    }
  }
}

resource "aws_ecs_service" "api" {
  count = var.create_live_resources ? 1 : 0

  cluster         = aws_ecs_cluster.this[0].id
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"
  name            = local.api_service_name
  task_definition = aws_ecs_task_definition.api[0].arn

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  load_balancer {
    container_name   = "api"
    container_port   = var.api_container_port
    target_group_arn = aws_lb_target_group.api[0].arn
  }

  network_configuration {
    assign_public_ip = false
    security_groups  = [var.api_security_group_id]
    subnets          = var.private_subnet_ids
  }

  depends_on = [
    aws_ecs_cluster_capacity_providers.this,
    aws_lb_listener.api_http,
  ]
}

resource "aws_ecs_service" "web" {
  count = var.create_live_resources ? 1 : 0

  cluster         = aws_ecs_cluster.this[0].id
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"
  name            = local.web_service_name
  task_definition = aws_ecs_task_definition.web[0].arn

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  load_balancer {
    container_name   = "web"
    container_port   = var.web_container_port
    target_group_arn = aws_lb_target_group.web[0].arn
  }

  network_configuration {
    assign_public_ip = false
    security_groups  = [var.web_security_group_id]
    subnets          = var.private_subnet_ids
  }

  depends_on = [
    aws_ecs_cluster_capacity_providers.this,
    aws_lb_listener_certificate.web,
    aws_lb_listener_rule.web,
  ]
}

resource "aws_ecs_service" "worker" {
  count = var.create_live_resources ? 1 : 0

  cluster         = aws_ecs_cluster.this[0].id
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"
  name            = local.worker_service_name
  task_definition = aws_ecs_task_definition.worker[0].arn

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    assign_public_ip = false
    security_groups  = [var.worker_security_group_id]
    subnets          = var.private_subnet_ids
  }

  depends_on = [aws_ecs_cluster_capacity_providers.this]
}

output "contract" {
  description = "Non-secret ECS module contract for the next implementation slice."
  value       = local.contract
}

output "ids" {
  description = "ECS ids for deploy and smoke proof. Empty until live resources are enabled."
  value = {
    api_alb_dns_name           = try(aws_lb.api[0].dns_name, null)
    api_service_name           = local.api_service_name
    api_task_definition_arn    = try(aws_ecs_task_definition.api[0].arn, null)
    cluster_name               = local.cluster_name
    web_service_name           = local.web_service_name
    web_task_definition_arn    = try(aws_ecs_task_definition.web[0].arn, null)
    worker_service_name        = local.worker_service_name
    worker_task_definition_arn = try(aws_ecs_task_definition.worker[0].arn, null)
  }
}
