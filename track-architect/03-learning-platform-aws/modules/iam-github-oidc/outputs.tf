output "plan_role_arn" {
  description = "Role ARN for PR plan jobs."
  value       = aws_iam_role.plan.arn
}

output "apply_role_arn" {
  description = "Role ARN for apply jobs."
  value       = aws_iam_role.apply.arn
}
