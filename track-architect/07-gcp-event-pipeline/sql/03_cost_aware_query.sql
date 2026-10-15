-- Cost-aware reporting query: click-through rate and spend per campaign for the last 7 days.
-- BigQuery on-demand pricing bills bytes scanned in the *referenced columns*:
--   * the partition filter on `day` prunes partitions (partition_filter is enforced by Terraform
--     with require_partition_filter = true, so an unfiltered scan fails instead of costing money);
--   * the campaign_id filter prunes clustered blocks;
--   * we select only the columns we need (never SELECT *).
-- Check before running:  bq query --dry_run --use_legacy_sql=false < sql/03_cost_aware_query.sql
SELECT
  campaign_id,
  SUM(impressions)                                  AS impressions,
  SUM(clicks)                                       AS clicks,
  SAFE_DIVIDE(SUM(clicks), SUM(impressions))        AS ctr,
  SUM(cost_cents) / 100                             AS spend
FROM `${project}.${dataset}.campaign_daily`
WHERE day BETWEEN DATE_SUB(CURRENT_DATE('UTC'), INTERVAL 7 DAY) AND CURRENT_DATE('UTC')
  AND campaign_id IN ('cmp-1001', 'cmp-1002')
GROUP BY campaign_id
ORDER BY spend DESC;
