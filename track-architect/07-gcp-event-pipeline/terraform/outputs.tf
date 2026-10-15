output "topic" {
  value = google_pubsub_topic.ad_events.id
}

output "workload_identity_provider" {
  description = "Value for google-github-actions/auth workload_identity_provider"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_account" {
  value = google_service_account.deployer.email
}
