resource "google_cloud_run_v2_service" "consumer" {
  name                = "adflow-event-pipeline"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  deletion_protection = false

  template {
    service_account = google_service_account.consumer.email

    # A streaming-pull consumer receives no HTTP traffic: keep CPU allocated and at least one instance.
    scaling {
      min_instance_count = 1
      max_instance_count = 5
    }

    containers {
      image = var.image

      resources {
        cpu_idle = false
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }

      env {
        name  = "ADFLOW_SOURCE"
        value = "pubsub"
      }
      env {
        name  = "ADFLOW_SINK"
        value = "bigquery"
      }
      env {
        name  = "GCP_PROJECT"
        value = var.project_id
      }
      env {
        name  = "PUBSUB_SUBSCRIPTION"
        value = google_pubsub_subscription.ad_events.name
      }
      env {
        name  = "BQ_DATASET"
        value = google_bigquery_dataset.analytics.dataset_id
      }

      startup_probe {
        http_get {
          path = "/actuator/health"
        }
        initial_delay_seconds = 10
        failure_threshold     = 6
      }
    }
  }
}
