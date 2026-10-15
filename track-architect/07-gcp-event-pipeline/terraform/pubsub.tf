resource "google_pubsub_topic" "ad_events" {
  name = "adflow-ad-events"

  message_retention_duration = "86400s"
}

resource "google_pubsub_topic" "ad_events_dlq" {
  name = "adflow-ad-events-dlq"
}

resource "google_pubsub_subscription" "ad_events" {
  name  = "adflow-ad-events-sub"
  topic = google_pubsub_topic.ad_events.id

  ack_deadline_seconds = 60

  # Ordering key = campaignId is set by publishers; ordering must be enabled on the subscription.
  enable_message_ordering = true

  # Exactly-once delivery narrows redelivery after a successful ack (regional, pull only), but
  # it does NOT make the pipeline exactly-once end to end. The consumer and the MERGE stay idempotent.
  enable_exactly_once_delivery = true

  retry_policy {
    minimum_backoff = "5s"
    maximum_backoff = "300s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.ad_events_dlq.id
    max_delivery_attempts = var.max_delivery_attempts
  }

  expiration_policy {
    ttl = "" # never expire
  }
}

# Inspect and replay poison messages from the DLQ.
resource "google_pubsub_subscription" "ad_events_dlq" {
  name                       = "adflow-ad-events-dlq-sub"
  topic                      = google_pubsub_topic.ad_events_dlq.id
  ack_deadline_seconds       = 60
  message_retention_duration = "604800s"
}

# The Pub/Sub service agent forwards dead letters: it needs publish on the DLQ and subscribe on the source.
data "google_project" "this" {}

locals {
  pubsub_service_agent = "serviceAccount:service-${data.google_project.this.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_topic_iam_member" "dlq_publisher" {
  topic  = google_pubsub_topic.ad_events_dlq.name
  role   = "roles/pubsub.publisher"
  member = local.pubsub_service_agent
}

resource "google_pubsub_subscription_iam_member" "dlq_subscriber" {
  subscription = google_pubsub_subscription.ad_events.name
  role         = "roles/pubsub.subscriber"
  member       = local.pubsub_service_agent
}
