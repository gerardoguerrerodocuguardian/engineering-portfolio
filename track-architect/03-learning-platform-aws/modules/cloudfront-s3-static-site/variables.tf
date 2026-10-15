variable "name" {
  description = "Name prefix."
  type        = string
}

variable "bucket_name" {
  description = "Globally unique S3 bucket name for the static site."
  type        = string
}

variable "api_origin_domain" {
  description = "DNS name of the ALB origin for /api/*. Must match the ALB certificate when api_origin_https is true. Empty = static site only."
  type        = string
  default     = ""
}

variable "api_origin_https" {
  description = "Use HTTPS between CloudFront and the ALB (required outside dev)."
  type        = bool
  default     = false
}

variable "api_path_pattern" {
  description = "Path pattern routed to the API origin."
  type        = string
  default     = "/api/*"
}

variable "origin_verify_secret" {
  description = "Value sent in X-Origin-Verify to the ALB."
  type        = string
  default     = ""
  sensitive   = true
}

variable "aliases" {
  description = "Custom domain names (requires acm_certificate_arn)."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ACM certificate in us-east-1 for aliases. null = default *.cloudfront.net certificate."
  type        = string
  default     = null
}

variable "price_class" {
  description = "PriceClass_100, PriceClass_200 or PriceClass_All."
  type        = string
  default     = "PriceClass_100"
}

variable "web_acl_arn" {
  description = "Optional AWS WAFv2 web ACL (scope CLOUDFRONT, us-east-1)."
  type        = string
  default     = null
}

variable "force_destroy" {
  description = "Allow destroying a non-empty bucket (dev only)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Extra tags."
  type        = map(string)
  default     = {}
}
