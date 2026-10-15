# Runtime identity of the consumer: only what it needs, scoped to single resources.
resource "google_service_account" "consumer" {
  account_id   = "adflow-pipeline-consumer"
  display_name = "AdFlow event pipeline consumer (Cloud Run)"
}

resource "google_pubsub_subscription_iam_member" "consumer_subscriber" {
  subscription = google_pubsub_subscription.ad_events.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:${google_service_account.consumer.email}"
}

# Dataset-scoped (not project-wide) data access.
resource "google_bigquery_dataset_iam_member" "consumer_editor" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.consumer.email}"
}

# Running query jobs (MERGE) needs jobUser at project level; it grants no data access by itself.
resource "google_project_iam_member" "consumer_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.consumer.email}"
}

# Deployer identity used by GitHub Actions (via Workload Identity Federation, no keys).
resource "google_service_account" "deployer" {
  account_id   = "adflow-pipeline-deployer"
  display_name = "AdFlow event pipeline CI deployer"
}

resource "google_project_iam_member" "deployer_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_service_account_iam_member" "deployer_acts_as_consumer" {
  service_account_id = google_service_account.consumer.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_project_iam_member" "deployer_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}
