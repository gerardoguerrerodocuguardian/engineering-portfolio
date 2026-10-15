output "address" {
  description = "Database hostname."
  value       = aws_db_instance.this.address
}

output "port" {
  description = "Database port."
  value       = aws_db_instance.this.port
}

output "database_name" {
  description = "Initial database name."
  value       = aws_db_instance.this.db_name
}

output "master_secret_arn" {
  description = "ARN of the RDS-managed master credentials secret (JSON with username/password)."
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
}

output "kms_key_arn" {
  description = "KMS key protecting storage and the master secret."
  value       = aws_kms_key.this.arn
}

output "security_group_id" {
  description = "Database security group id."
  value       = aws_security_group.this.id
}
