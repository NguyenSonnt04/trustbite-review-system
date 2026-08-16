variable "availability_zone_count" {
  description = "Number of availability zones planned for the VPC."
  type        = number
}

variable "api_container_port" {
  description = "Container port exposed by the Express API task."
  type        = number
}

variable "create_live_resources" {
  description = "Guardrail flag for future live resources."
  type        = bool
}

variable "enable_nat_gateway" {
  description = "Whether to create NAT gateway egress for private subnets."
  type        = bool
}

variable "environment" {
  description = "Environment name."
  type        = string
}

variable "name_prefix" {
  description = "Non-secret resource name prefix."
  type        = string
}

variable "public_ingress_cidrs" {
  description = "CIDR blocks allowed to reach the public API load balancer."
  type        = list(string)
}

variable "redis_port" {
  description = "Redis port allowed from ECS task security groups."
  type        = number
}

variable "tags" {
  description = "Common non-secret tags."
  type        = map(string)
}

variable "vpc_cidr" {
  description = "Planned VPC CIDR."
  type        = string
}

variable "web_container_port" {
  description = "Container port exposed by the Next.js web task."
  type        = number
}
