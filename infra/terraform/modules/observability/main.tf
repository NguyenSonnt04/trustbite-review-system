locals {
  log_groups = {
    api    = "/aws/ecs/${var.name_prefix}/api"
    web    = "/aws/ecs/${var.name_prefix}/web"
    worker = "/aws/ecs/${var.name_prefix}/worker"
  }

  ecs_alarm_targets = {
    api = {
      cluster = var.api_ecs_cluster_name
      service = var.api_ecs_service_name
    }
    web = {
      cluster = var.web_ecs_cluster_name
      service = var.web_ecs_service_name
    }
    worker = {
      cluster = var.worker_ecs_cluster_name
      service = var.worker_ecs_service_name
    }
  }

  enabled_ecs_alarm_targets = {
    for name, target in local.ecs_alarm_targets : name => target
    if var.create_live_resources && var.ecs_alarms_enabled && target.cluster != null && target.service != null
  }
  redis_alarm_enabled = var.create_live_resources && var.redis_alarms_enabled

  contract = {
    alarm_actions_count   = length(var.alarm_actions)
    alarm_baseline        = ["api-cpu", "web-cpu", "worker-cpu", "rds-storage", "redis-cpu"]
    create_live_resources = var.create_live_resources
    ecs_alarms_enabled    = var.ecs_alarms_enabled
    environment           = var.environment
    log_groups            = local.log_groups
    log_retention_days    = var.log_retention_days
    module                = "observability"
    redis_alarms_enabled  = var.redis_alarms_enabled
    secret_redaction      = "required-in-runtime-logs"
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  for_each = var.create_live_resources ? local.log_groups : {}

  name              = each.value
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name        = each.value
    RuntimeRole = each.key
  })
}

resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  for_each = local.enabled_ecs_alarm_targets

  alarm_actions       = var.alarm_actions
  alarm_description   = "TrustBite ${each.key} ECS service CPU is high"
  alarm_name          = "${var.name_prefix}-${each.key}-ecs-cpu-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions = {
    ClusterName = each.value.cluster
    ServiceName = each.value.service
  }
  evaluation_periods = 2
  metric_name        = "CPUUtilization"
  namespace          = "AWS/ECS"
  period             = 300
  statistic          = "Average"
  threshold          = 80
  treat_missing_data = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage_low" {
  count = var.create_live_resources && var.rds_instance_identifier != null ? 1 : 0

  alarm_actions       = var.alarm_actions
  alarm_description   = "TrustBite RDS free storage is low"
  alarm_name          = "${var.name_prefix}-rds-free-storage-low"
  comparison_operator = "LessThanThreshold"
  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }
  evaluation_periods = 2
  metric_name        = "FreeStorageSpace"
  namespace          = "AWS/RDS"
  period             = 300
  statistic          = "Average"
  threshold          = 2147483648
  treat_missing_data = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  count = local.redis_alarm_enabled ? 1 : 0

  alarm_actions       = var.alarm_actions
  alarm_description   = "TrustBite Redis CPU is high"
  alarm_name          = "${var.name_prefix}-redis-cpu-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions = {
    ReplicationGroupId = var.redis_replication_group_id
  }
  evaluation_periods = 2
  metric_name        = "CPUUtilization"
  namespace          = "AWS/ElastiCache"
  period             = 300
  statistic          = "Average"
  threshold          = 80
  treat_missing_data = "notBreaching"
}

output "contract" {
  description = "Non-secret observability module contract for the next implementation slice."
  value       = local.contract
}

output "ids" {
  description = "Observability ids for ECS and closeout proof. Empty until live resources are enabled."
  value = {
    api_log_group_name       = try(aws_cloudwatch_log_group.ecs["api"].name, null)
    log_retention_days       = var.log_retention_days
    rds_storage_alarm_name   = try(aws_cloudwatch_metric_alarm.rds_free_storage_low[0].alarm_name, null)
    redis_cpu_alarm_name     = try(aws_cloudwatch_metric_alarm.redis_cpu_high[0].alarm_name, null)
    web_log_group_name       = try(aws_cloudwatch_log_group.ecs["web"].name, null)
    worker_log_group_name    = try(aws_cloudwatch_log_group.ecs["worker"].name, null)
    ecs_cpu_alarm_names      = [for alarm in aws_cloudwatch_metric_alarm.ecs_cpu_high : alarm.alarm_name]
    runtime_log_secret_check = "manual CloudWatch log inspection required after live deploy"
  }
}
