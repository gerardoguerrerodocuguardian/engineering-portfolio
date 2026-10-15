variable "project_id" {
  description = "GCP project id (placeholder, never commit a real one)"
  type        = string
  default     = "example-project-id"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "image" {
  description = "Container image in Artifact Registry"
  type        = string
  default     = "us-central1-docker.pkg.dev/example-project-id/adflow/event-pipeline:latest"
}

variable "github_repository" {
  description = "owner/repo allowed to deploy through Workload Identity Federation"
  type        = string
  default     = "example-owner/example-repo"
}

variable "dataset_id" {
  type    = string
  default = "adflow_analytics"
}

variable "max_delivery_attempts" {
  description = "Deliveries before a message is moved to the dead-letter topic (5-100)"
  type        = number
  default     = 5
}
