output "cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.this.name
}

output "service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.this.name
}

output "security_group_id" {
  description = "Task security group id (allow it on the database)."
  value       = aws_security_group.this.id
}

output "task_role_arn" {
  description = "Application (task) role ARN."
  value       = aws_iam_role.task.arn
}

output "execution_role_arn" {
  description = "Task execution role ARN."
  value       = aws_iam_role.execution.arn
}

output "log_group_name" {
  description = "CloudWatch log group."
  value       = aws_cloudwatch_log_group.this.name
}
