variable "name_prefix" {
  description = "Prefix for role names."
  type        = string
}

variable "create_provider" {
  description = "Create the account-wide GitHub OIDC provider (only one per account; set false if it already exists)."
  type        = bool
  default     = true
}

variable "github_repository" {
  description = "owner/repo allowed to assume the roles, e.g. example-org/adflow-learning-platform."
  type        = string
}

variable "plan_subjects" {
  description = "OIDC sub claims allowed to assume the read-only plan role."
  type        = list(string)
  default     = ["pull_request"]
}

variable "apply_subjects" {
  description = "OIDC sub claims allowed to assume the apply role (restrict to a protected environment or branch)."
  type        = list(string)
  default     = ["environment:prod"]
}

variable "state_bucket_arn" {
  description = "ARN of the Terraform state bucket."
  type        = string
}

variable "lock_table_arn" {
  description = "ARN of the Terraform lock table."
  type        = string
}

variable "apply_policy_json" {
  description = "Scoped IAM policy JSON for the apply role. Keep it to the services this stack manages; do not attach AdministratorAccess."
  type        = string
  default     = null
}

variable "tags" {
  description = "Extra tags."
  type        = map(string)
  default     = {}
}
