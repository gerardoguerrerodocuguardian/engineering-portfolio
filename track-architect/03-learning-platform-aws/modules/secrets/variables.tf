variable "name" {
  description = "Name prefix for the KMS alias and secrets."
  type        = string
}

variable "secrets" {
  description = "Secrets to create. generate=true stores a random value; generate=false creates an empty container whose value is set out-of-band."
  type = map(object({
    description = string
    generate    = optional(bool, true)
    length      = optional(number, 40)
  }))
}

variable "recovery_window_in_days" {
  description = "Deletion recovery window (0 = immediate, dev only; otherwise 7-30)."
  type        = number
  default     = 7
}

variable "tags" {
  description = "Extra tags."
  type        = map(string)
  default     = {}
}
