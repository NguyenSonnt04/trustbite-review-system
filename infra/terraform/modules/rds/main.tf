locals {
  contract = {
    allocated_storage_gib     = var.allocated_storage_gib
    backup_retention_days     = var.backup_retention_days
    create_live_resources     = var.create_live_resources
    database_name             = var.database_name
    deletion_protection       = var.deletion_protection
    encryption_required       = true
    engine                    = "postgres"
    engine_version            = var.postgres_engine_version
    environment               = var.environment
    instance_class            = var.instance_class
    managed_master_password   = true
    max_allocated_storage_gib = var.max_allocated_storage_gib
    module                    = "rds"
    multi_az                  = var.multi_az
    name                      = "${var.name_prefix}-postgres"
    parameter_group_family    = var.parameter_group_family
    postgis_required          = true
    public_access             = false
    ssl_required              = true
  }
}

resource "aws_db_subnet_group" "this" {
  count = var.create_live_resources ? 1 : 0

  description = "Private DB subnet group for TrustBite ${var.environment}"
  name        = "${var.name_prefix}-db-subnets"
  subnet_ids  = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-db-subnets"
  })

  lifecycle {
    precondition {
      condition     = length(var.private_subnet_ids) >= 2
      error_message = "RDS requires at least two private subnet ids before live resources can be created."
    }
  }
}

resource "aws_db_parameter_group" "this" {
  count = var.create_live_resources ? 1 : 0

  description = "TrustBite PostgreSQL parameter group for ${var.environment}"
  family      = var.parameter_group_family
  name        = "${var.name_prefix}-postgres-params"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    apply_method = "pending-reboot"
    name         = "rds.force_ssl"
    value        = "1"
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres-params"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "this" {
  count = var.create_live_resources ? 1 : 0

  allocated_storage                   = var.allocated_storage_gib
  auto_minor_version_upgrade          = true
  backup_retention_period             = var.backup_retention_days
  backup_window                       = "03:00-04:00"
  copy_tags_to_snapshot               = true
  db_name                             = var.database_name
  db_subnet_group_name                = aws_db_subnet_group.this[0].name
  deletion_protection                 = var.deletion_protection
  enabled_cloudwatch_logs_exports     = ["postgresql", "upgrade"]
  engine                              = "postgres"
  engine_version                      = var.postgres_engine_version
  identifier                          = "${var.name_prefix}-postgres"
  instance_class                      = var.instance_class
  maintenance_window                  = "Mon:04:00-Mon:05:00"
  manage_master_user_password         = true
  max_allocated_storage               = var.max_allocated_storage_gib
  multi_az                            = var.multi_az
  parameter_group_name                = aws_db_parameter_group.this[0].name
  performance_insights_enabled        = true
  publicly_accessible                 = false
  skip_final_snapshot                 = false
  storage_encrypted                   = true
  storage_type                        = "gp3"
  username                            = "trustbite_admin"
  vpc_security_group_ids              = [var.rds_security_group_id]
  final_snapshot_identifier           = "${var.name_prefix}-postgres-final"
  iam_database_authentication_enabled = false

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-postgres"
  })

  lifecycle {
    precondition {
      condition     = var.rds_security_group_id != null && var.rds_security_group_id != ""
      error_message = "RDS requires a security group id before live resources can be created."
    }

    precondition {
      condition     = var.deletion_protection
      error_message = "RDS deletion protection must stay enabled unless a human-approved exception is recorded."
    }
  }
}

output "contract" {
  description = "Non-secret RDS module contract for the next implementation slice."
  value       = local.contract
}

output "ids" {
  description = "RDS ids for dependent modules. Empty until live resources are enabled."
  value = {
    db_instance_address        = try(aws_db_instance.this[0].address, null)
    db_instance_arn            = try(aws_db_instance.this[0].arn, null)
    db_instance_identifier     = try(aws_db_instance.this[0].identifier, null)
    db_instance_resource_id    = try(aws_db_instance.this[0].resource_id, null)
    db_subnet_group_name       = try(aws_db_subnet_group.this[0].name, null)
    master_user_secret_arn     = try(aws_db_instance.this[0].master_user_secret[0].secret_arn, null)
    parameter_group_name       = try(aws_db_parameter_group.this[0].name, null)
    security_group_id          = var.create_live_resources ? var.rds_security_group_id : null
    stores_plaintext_passwords = false
  }
}
