output "distribution_domain_name" {
  description = "CloudFront domain name (*.cloudfront.net)."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "distribution_id" {
  description = "Distribution id (for cache invalidations in CI)."
  value       = aws_cloudfront_distribution.this.id
}

output "distribution_arn" {
  description = "Distribution ARN."
  value       = aws_cloudfront_distribution.this.arn
}

output "bucket_name" {
  description = "Static site bucket name."
  value       = aws_s3_bucket.site.bucket
}

output "bucket_arn" {
  description = "Static site bucket ARN."
  value       = aws_s3_bucket.site.arn
}
