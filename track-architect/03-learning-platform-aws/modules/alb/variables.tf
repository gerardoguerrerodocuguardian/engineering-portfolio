variable "name" {
  description = "Name prefix (max ~20 chars; used in ALB and target group names)."
  type        = string
}

variable "vpc_id" {
  description = "VPC id."
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR; the ALB may only send traffic to targets inside it."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnets for the ALB."
  type        = list(string)
}

variable "container_port" {
  description = "Port the targets listen on."
  type        = number
  default     = 8080
}

variable "health_check_path" {
  description = "HTTP path used by target group health checks."
  type        = string
  default     = "/healthz"
}

variable "certificate_arn" {
  description = "Regional ACM certificate. If set, an HTTPS:443 listener is created; otherwise HTTP:80 (dev only)."
  type        = string
  default     = null
}

variable "origin_verify_secret" {
  description = "Shared secret CloudFront sends in X-Origin-Verify. Requests without it get a 403."
  type        = string
  sensitive   = true
}

variable "restrict_to_cloudfront" {
  description = "Allow ingress only from the CloudFront origin-facing managed prefix list."
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Enable ALB deletion protection."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Extra tags."
  type        = map(string)
  default     = {}
}
