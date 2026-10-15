variable "region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used as a prefix."
  type        = string
  default     = "adflow-learn"
}

variable "image_tag" {
  description = "Tag of the API image in the ECR repository created by this stack."
  type        = string
}

variable "site_bucket_suffix" {
  description = "Suffix that makes the static-site bucket name globally unique (e.g. your account id placeholder)."
  type        = string
}

variable "cognito_domain_prefix" {
  description = "Globally unique Cognito hosted UI domain prefix."
  type        = string
}

variable "github_repository" {
  description = "owner/repo allowed to assume the CI roles."
  type        = string
  default     = "example-org/adflow-learning-platform"
}

variable "state_bucket_arn" {
  description = "ARN of the remote-state bucket (see ../../backend)."
  type        = string
}

variable "lock_table_arn" {
  description = "ARN of the remote-state lock table."
  type        = string
}

variable "alb_certificate_arn" {
  description = "Regional ACM certificate for the ALB (covers api_origin_domain)."
  type        = string
}

variable "api_origin_domain" {
  description = "DNS name (CNAME/alias to the ALB, managed outside this stack) that CloudFront uses as API origin."
  type        = string
}

variable "site_aliases" {
  description = "Custom domain names for the CloudFront distribution (first one is used for Cognito callbacks)."
  type        = list(string)

  validation {
    condition     = length(var.site_aliases) >= 1
    error_message = "Provide at least one site alias in prod."
  }
}

variable "cloudfront_certificate_arn" {
  description = "ACM certificate in us-east-1 covering site_aliases (null = default cloudfront.net certificate)."
  type        = string
  default     = null
}
