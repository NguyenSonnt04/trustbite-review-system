data "aws_availability_zones" "available" {
  count = var.create_live_resources ? 1 : 0

  state = "available"
}

locals {
  az_names = var.create_live_resources ? slice(data.aws_availability_zones.available[0].names, 0, var.availability_zone_count) : []

  contract = {
    create_live_resources   = var.create_live_resources
    enable_nat_gateway      = var.enable_nat_gateway
    environment             = var.environment
    module                  = "network"
    planned_public_ingress  = "api-load-balancer-only"
    planned_private_runtime = ["rds", "redis", "ecs-api-task", "ecs-worker-task"]
    public_ingress_cidrs    = var.public_ingress_cidrs
    subnet_az_count         = var.availability_zone_count
    vpc_cidr                = var.vpc_cidr
    vpc_name                = "${var.name_prefix}-vpc"
  }
}

resource "aws_vpc" "this" {
  count = var.create_live_resources ? 1 : 0

  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpc"
  })
}

resource "aws_subnet" "public" {
  count = var.create_live_resources ? var.availability_zone_count : 0

  availability_zone       = local.az_names[count.index]
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  map_public_ip_on_launch = true
  vpc_id                  = aws_vpc.this[0].id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-${count.index + 1}"
    Tier = "public"
  })
}

resource "aws_subnet" "private" {
  count = var.create_live_resources ? var.availability_zone_count : 0

  availability_zone = local.az_names[count.index]
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + var.availability_zone_count)
  vpc_id            = aws_vpc.this[0].id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-${count.index + 1}"
    Tier = "private"
  })
}

resource "aws_internet_gateway" "this" {
  count = var.create_live_resources ? 1 : 0

  vpc_id = aws_vpc.this[0].id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-igw"
  })
}

resource "aws_route_table" "public" {
  count = var.create_live_resources ? 1 : 0

  vpc_id = aws_vpc.this[0].id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-rt"
    Tier = "public"
  })
}

resource "aws_route" "public_internet" {
  count = var.create_live_resources ? 1 : 0

  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this[0].id
  route_table_id         = aws_route_table.public[0].id
}

resource "aws_route_table_association" "public" {
  count = var.create_live_resources ? var.availability_zone_count : 0

  route_table_id = aws_route_table.public[0].id
  subnet_id      = aws_subnet.public[count.index].id
}

resource "aws_eip" "nat" {
  count = var.create_live_resources && var.enable_nat_gateway ? 1 : 0

  domain = "vpc"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat-eip"
  })
}

resource "aws_nat_gateway" "this" {
  count = var.create_live_resources && var.enable_nat_gateway ? 1 : 0

  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id

  depends_on = [
    aws_internet_gateway.this
  ]

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat"
  })
}

resource "aws_route_table" "private" {
  count = var.create_live_resources ? 1 : 0

  vpc_id = aws_vpc.this[0].id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-rt"
    Tier = "private"
  })
}

resource "aws_route" "private_nat" {
  count = var.create_live_resources && var.enable_nat_gateway ? 1 : 0

  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[0].id
  route_table_id         = aws_route_table.private[0].id
}

resource "aws_route_table_association" "private" {
  count = var.create_live_resources ? var.availability_zone_count : 0

  route_table_id = aws_route_table.private[0].id
  subnet_id      = aws_subnet.private[count.index].id
}

resource "aws_security_group" "alb" {
  count = var.create_live_resources ? 1 : 0

  description = "Public ingress for the TrustBite API load balancer"
  name        = "${var.name_prefix}-alb-sg"
  vpc_id      = aws_vpc.this[0].id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-alb-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  count = var.create_live_resources ? length(var.public_ingress_cidrs) : 0

  cidr_ipv4         = var.public_ingress_cidrs[count.index]
  from_port         = 80
  ip_protocol       = "tcp"
  security_group_id = aws_security_group.alb[0].id
  to_port           = 80
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  count = var.create_live_resources ? length(var.public_ingress_cidrs) : 0

  cidr_ipv4         = var.public_ingress_cidrs[count.index]
  from_port         = 443
  ip_protocol       = "tcp"
  security_group_id = aws_security_group.alb[0].id
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "alb_to_api" {
  count = var.create_live_resources ? 1 : 0

  from_port                    = var.api_container_port
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.api[0].id
  security_group_id            = aws_security_group.alb[0].id
  to_port                      = var.api_container_port
}

resource "aws_security_group" "api" {
  count = var.create_live_resources ? 1 : 0

  description = "TrustBite API ECS task ingress from ALB only"
  name        = "${var.name_prefix}-api-sg"
  vpc_id      = aws_vpc.this[0].id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "api_from_alb" {
  count = var.create_live_resources ? 1 : 0

  from_port                    = var.api_container_port
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.alb[0].id
  security_group_id            = aws_security_group.api[0].id
  to_port                      = var.api_container_port
}

resource "aws_vpc_security_group_egress_rule" "api_all_egress" {
  count = var.create_live_resources ? 1 : 0

  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  security_group_id = aws_security_group.api[0].id
}

resource "aws_security_group" "worker" {
  count = var.create_live_resources ? 1 : 0

  description = "TrustBite worker ECS task egress only"
  name        = "${var.name_prefix}-worker-sg"
  vpc_id      = aws_vpc.this[0].id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-worker-sg"
  })
}

resource "aws_vpc_security_group_egress_rule" "worker_all_egress" {
  count = var.create_live_resources ? 1 : 0

  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  security_group_id = aws_security_group.worker[0].id
}

resource "aws_security_group" "rds" {
  count = var.create_live_resources ? 1 : 0

  description = "TrustBite RDS ingress from API and worker tasks only"
  name        = "${var.name_prefix}-rds-sg"
  vpc_id      = aws_vpc.this[0].id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-rds-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_api" {
  count = var.create_live_resources ? 1 : 0

  from_port                    = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.api[0].id
  security_group_id            = aws_security_group.rds[0].id
  to_port                      = 5432
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_worker" {
  count = var.create_live_resources ? 1 : 0

  from_port                    = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.worker[0].id
  security_group_id            = aws_security_group.rds[0].id
  to_port                      = 5432
}

resource "aws_security_group" "redis" {
  count = var.create_live_resources ? 1 : 0

  description = "TrustBite Redis ingress from API and worker tasks only"
  name        = "${var.name_prefix}-redis-sg"
  vpc_id      = aws_vpc.this[0].id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-redis-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_api" {
  count = var.create_live_resources ? 1 : 0

  from_port                    = var.redis_port
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.api[0].id
  security_group_id            = aws_security_group.redis[0].id
  to_port                      = var.redis_port
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_worker" {
  count = var.create_live_resources ? 1 : 0

  from_port                    = var.redis_port
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.worker[0].id
  security_group_id            = aws_security_group.redis[0].id
  to_port                      = var.redis_port
}

output "contract" {
  description = "Non-secret network module contract for the next implementation slice."
  value       = local.contract
}

output "ids" {
  description = "Network ids for dependent modules. Empty until live resources are enabled."
  value = {
    alb_security_group_id    = try(aws_security_group.alb[0].id, null)
    api_security_group_id    = try(aws_security_group.api[0].id, null)
    private_subnet_ids       = aws_subnet.private[*].id
    public_subnet_ids        = aws_subnet.public[*].id
    rds_security_group_id    = try(aws_security_group.rds[0].id, null)
    redis_security_group_id  = try(aws_security_group.redis[0].id, null)
    vpc_id                   = try(aws_vpc.this[0].id, null)
    worker_security_group_id = try(aws_security_group.worker[0].id, null)
  }
}
