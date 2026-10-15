variable "name" {
  description = "Table name."
  type        = string
}

variable "hash_key" {
  description = "Partition key attribute name."
  type        = string
}

variable "range_key" {
  description = "Sort key attribute name (optional)."
  type        = string
  default     = null
}

variable "attributes" {
  description = "Attribute definitions for every key (table and index keys). type: S, N or B."
  type = list(object({
    name = string
    type = string
  }))
}

variable "global_secondary_indexes" {
  description = "Global secondary indexes."
  type = list(object({
    name            = string
    hash_key        = string
    range_key       = optional(string)
    projection_type = optional(string, "ALL")
  }))
  default = []
}

variable "ttl_attribute" {
  description = "Attribute holding expiry epoch seconds (null disables TTL)."
  type        = string
  default     = null
}

variable "kms_key_arn" {
  description = "Customer-managed KMS key. null uses the AWS-managed aws/dynamodb key (still encrypted at rest)."
  type        = string
  default     = null
}

variable "deletion_protection" {
  description = "Enable deletion protection."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Extra tags."
  type        = map(string)
  default     = {}
}
