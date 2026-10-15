resource "google_bigquery_dataset" "analytics" {
  dataset_id                 = var.dataset_id
  location                   = "US"
  delete_contents_on_destroy = false
}

resource "google_bigquery_table" "ad_events" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "ad_events"
  deletion_protection = true

  time_partitioning {
    type                     = "DAY"
    field                    = "occurred_at"
    require_partition_filter = true
  }
  clustering = ["campaign_id"]

  schema = jsonencode([
    { name = "event_id", type = "STRING", mode = "REQUIRED" },
    { name = "type", type = "STRING", mode = "REQUIRED" },
    { name = "campaign_id", type = "STRING", mode = "REQUIRED" },
    { name = "cost_cents", type = "INT64", mode = "REQUIRED" },
    { name = "occurred_at", type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

resource "google_bigquery_table" "campaign_daily" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "campaign_daily"
  deletion_protection = true

  time_partitioning {
    type                     = "DAY"
    field                    = "day"
    require_partition_filter = true
  }
  clustering = ["campaign_id"]

  schema = jsonencode([
    { name = "campaign_id", type = "STRING", mode = "REQUIRED" },
    { name = "day", type = "DATE", mode = "REQUIRED" },
    { name = "impressions", type = "INT64", mode = "NULLABLE" },
    { name = "clicks", type = "INT64", mode = "NULLABLE" },
    { name = "cost_cents", type = "INT64", mode = "NULLABLE" },
  ])
}
