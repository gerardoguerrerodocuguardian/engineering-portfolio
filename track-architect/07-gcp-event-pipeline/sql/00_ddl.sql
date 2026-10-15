-- Reference DDL (Terraform is the source of truth; this is for local BigQuery-compatible sandboxes).
CREATE TABLE IF NOT EXISTS `${project}.${dataset}.ad_events` (
  event_id STRING NOT NULL, type STRING NOT NULL, campaign_id STRING NOT NULL,
  cost_cents INT64 NOT NULL, occurred_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(occurred_at)
CLUSTER BY campaign_id
OPTIONS (require_partition_filter = TRUE);

CREATE TABLE IF NOT EXISTS `${project}.${dataset}.campaign_daily` (
  campaign_id STRING NOT NULL, day DATE NOT NULL,
  impressions INT64, clicks INT64, cost_cents INT64
)
PARTITION BY day
CLUSTER BY campaign_id
OPTIONS (require_partition_filter = TRUE);
