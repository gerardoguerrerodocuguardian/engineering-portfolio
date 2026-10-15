variable "name" {
  description = "Service / cluster name prefix."
  type        = string
}

variable "vpc_id" {
  description = "VPC id."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnets for tasks (no public IPs)."
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "ALB security group; tasks accept traffic only from it."
  type        = string
}

variable "target_group_arn" {
  description = "ALB target group to register tasks with (must already be attached to a listener rule)."
  type        = string
}

variable "image" {
  description = "Container image URI including tag (prefer immutable tags or digests)."
  type        = string
}

variable "container_port" {
  description = "Container port."
  type        = number
  default     = 8080
}

variable "cpu" {
  description = "Task CPU units (256, 512, 1024, ...)."
  type        = number
  default     = 256
}

variable "memory" {
  description = "Task memory in MiB."
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Initial task count (autoscaling owns it afterwards)."
  type        = number
  default     = 2
}

variable "min_capacity" {
  description = "Autoscaling minimum tasks."
  type        = number
  default     = 2
}

variable "max_capacity" {
  description = "Autoscaling maximum tasks."
  type        = number
  default     = 6
}

variable "cpu_target_percent" {
  description = "Target average CPU utilization for scaling."
  type        = number
  default     = 60
}

variable "memory_target_percent" {
  description = "Target average memory utilization for scaling."
  type        = number
  default     = 75
}

variable "environment" {
  description = "Plain environment variables (non-sensitive)."
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Container secrets: env var name => Secrets Manager valueFrom (arn or arn:json-key::)."
  type        = map(string)
  default     = {}
}

variable "secret_arns" {
  description = "Base ARNs of the secrets above; the execution role may read only these."
  type        = list(string)
  default     = []
}

variable "secret_kms_key_arns" {
  description = "KMS keys that encrypt those secrets (execution role gets kms:Decrypt on them only)."
  type        = list(string)
  default     = []
}

variable "attach_task_policy" {
  description = "Attach task_policy_json to the task role. A plain bool because the policy JSON is usually unknown until apply, and count cannot depend on that."
  type        = bool
  default     = false
}

variable "task_policy_json" {
  description = "Least-privilege IAM policy JSON for the application (task role). Only used when attach_task_policy = true."
  type        = string
  default     = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
}

variable "extra_egress" {
  description = "Extra egress rules besides HTTPS (e.g. PostgreSQL to the data subnets)."
  type = list(object({
    port        = number
    cidr_blocks = list(string)
    description = string
  }))
  default = []
}

variable "read_only_root_filesystem" {
  description = "Mount the container root filesystem read-only."
  type        = bool
  default     = true
}

variable "health_check_grace_seconds" {
  description = "Seconds ECS ignores ALB health checks after task start."
  type        = number
  default     = 60
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention."
  type        = number
  default     = 30
}

variable "enable_container_insights" {
  description = "Enable ECS Container Insights (extra CloudWatch cost)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Extra tags."
  type        = map(string)
  default     = {}
}
