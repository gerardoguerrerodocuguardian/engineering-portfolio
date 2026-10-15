variable "name" {
  description = "Name prefix for all resources."
  type        = string
}

variable "cidr" {
  description = "VPC CIDR block (a /16 is expected; subnets are carved as /20)."
  type        = string
  default     = "10.20.0.0/16"
}

variable "azs" {
  description = "Availability zones to use (2 or 3)."
  type        = list(string)

  validation {
    condition     = length(var.azs) >= 2 && length(var.azs) <= 3
    error_message = "Use 2 or 3 availability zones."
  }
}

variable "single_nat_gateway" {
  description = "true = one shared NAT gateway (cheaper, not AZ-resilient); false = one NAT per AZ."
  type        = bool
  default     = true
}

variable "enable_interface_endpoints" {
  description = "Create interface VPC endpoints so private tasks reach AWS APIs without NAT."
  type        = bool
  default     = true
}

variable "interface_endpoint_services" {
  description = "Service suffixes for interface endpoints (com.amazonaws.<region>.<suffix>)."
  type        = list(string)
  default     = ["ecr.api", "ecr.dkr", "logs", "secretsmanager", "kms"]
}

variable "tags" {
  description = "Extra tags."
  type        = map(string)
  default     = {}
}
