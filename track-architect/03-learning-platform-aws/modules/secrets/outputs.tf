output "secret_arns" {
  description = "Map of secret key to ARN."
  value       = { for k, s in aws_secretsmanager_secret.this : k => s.arn }
}

output "kms_key_arn" {
  description = "KMS key encrypting the secrets (consumers need kms:Decrypt on it)."
  value       = aws_kms_key.this.arn
}
