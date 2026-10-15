output "table_name" {
  description = "Table name."
  value       = aws_dynamodb_table.this.name
}

output "table_arn" {
  description = "Table ARN."
  value       = aws_dynamodb_table.this.arn
}

output "access_policy_json" {
  description = "Least-privilege IAM policy JSON for application roles."
  value       = data.aws_iam_policy_document.access.json
}
