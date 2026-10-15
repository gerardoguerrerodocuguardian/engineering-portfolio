variable "name" {
  description = "User pool name prefix."
  type        = string
}

variable "callback_urls" {
  description = "Allowed OAuth redirect URIs for the SPA (https, or http://localhost in dev)."
  type        = list(string)
}

variable "logout_urls" {
  description = "Allowed sign-out URLs."
  type        = list(string)
}

variable "domain_prefix" {
  description = "Hosted UI domain prefix (globally unique per region). null = no hosted domain."
  type        = string
  default     = null
}

variable "allow_self_signup" {
  description = "true = learners self-register; false = admin-created users only."
  type        = bool
  default     = true
}

variable "mfa_configuration" {
  description = "OFF, OPTIONAL or ON (TOTP software tokens only; SMS is deliberately not used)."
  type        = string
  default     = "OPTIONAL"

  validation {
    condition     = contains(["OFF", "OPTIONAL", "ON"], var.mfa_configuration)
    error_message = "mfa_configuration must be OFF, OPTIONAL or ON."
  }
}

variable "groups" {
  description = "Cognito groups (appear in the cognito:groups claim), e.g. learner, instructor, admin."
  type        = list(string)
  default     = ["learner", "instructor", "admin"]
}

variable "deletion_protection" {
  description = "Protect the pool from deletion."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Extra tags."
  type        = map(string)
  default     = {}
}
