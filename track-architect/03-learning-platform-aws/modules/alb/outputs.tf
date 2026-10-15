output "dns_name" {
  description = "ALB DNS name."
  value       = aws_lb.this.dns_name
}

output "security_group_id" {
  description = "ALB security group id (ECS tasks accept traffic only from it)."
  value       = aws_security_group.this.id
}

output "target_group_arn" {
  description = "Target group ARN for the ECS service (resolves only after the listener rule exists)."
  value       = aws_lb_target_group.this.arn

  depends_on = [aws_lb_listener_rule.from_cloudfront]
}

output "https_enabled" {
  description = "Whether the listener is HTTPS."
  value       = local.https
}
