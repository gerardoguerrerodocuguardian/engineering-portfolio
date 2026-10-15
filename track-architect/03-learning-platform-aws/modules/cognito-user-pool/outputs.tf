output "user_pool_id" {
  description = "User pool id."
  value       = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  description = "User pool ARN."
  value       = aws_cognito_user_pool.this.arn
}

output "client_id" {
  description = "SPA app client id (public identifier, not a secret)."
  value       = aws_cognito_user_pool_client.spa.id
}

output "issuer_url" {
  description = "JWT issuer (iss claim). The API validates tokens against this."
  value       = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.this.id}"
}

output "jwks_url" {
  description = "JWKS endpoint for signature verification."
  value       = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.this.id}/.well-known/jwks.json"
}
