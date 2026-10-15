output "cloudfront_domain" {
  description = "Public entry point (CloudFront)."
  value       = module.site.distribution_domain_name
}

output "site_bucket" {
  description = "Bucket for static assets (deploy with CI, then invalidate)."
  value       = module.site.bucket_name
}

output "distribution_id" {
  description = "CloudFront distribution id."
  value       = module.site.distribution_id
}

output "ecr_repository_url" {
  description = "Push the API image here."
  value       = aws_ecr_repository.api.repository_url
}

output "alb_dns_name" {
  description = "ALB DNS name (origin; not meant for direct access)."
  value       = module.alb.dns_name
}

output "cognito_user_pool_id" {
  description = "Cognito user pool id."
  value       = module.auth.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito SPA client id."
  value       = module.auth.client_id
}

output "ci_plan_role_arn" {
  description = "Role for GitHub Actions plan jobs."
  value       = module.github_oidc.plan_role_arn
}

output "ci_apply_role_arn" {
  description = "Role for GitHub Actions apply jobs."
  value       = module.github_oidc.apply_role_arn
}
