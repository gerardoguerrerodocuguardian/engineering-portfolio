-- Idempotent aggregate refresh: recompute (replace) totals for the touched campaigns/days from the
-- distinct raw events. Running it twice, or after a replay, yields identical rows (never "+=").
-- Params: @campaigns ARRAY<STRING>, @min_day, @max_day DATE.
MERGE `${project}.${dataset}.campaign_daily` AS t
USING (
  SELECT
    campaign_id,
    DATE(occurred_at)                  AS day,
    COUNTIF(type = 'IMPRESSION')       AS impressions,
    COUNTIF(type = 'CLICK')            AS clicks,
    SUM(cost_cents)                    AS cost_cents
  FROM `${project}.${dataset}.ad_events`
  WHERE DATE(occurred_at) BETWEEN @min_day AND @max_day   -- partition filter
    AND campaign_id IN UNNEST(@campaigns)                 -- cluster filter
  GROUP BY campaign_id, day
) AS s
ON  t.campaign_id = s.campaign_id
AND t.day = s.day
AND t.day BETWEEN @min_day AND @max_day                   -- prune the target as well
WHEN MATCHED THEN
  UPDATE SET impressions = s.impressions, clicks = s.clicks, cost_cents = s.cost_cents
WHEN NOT MATCHED THEN
  INSERT (campaign_id, day, impressions, clicks, cost_cents)
  VALUES (s.campaign_id, s.day, s.impressions, s.clicks, s.cost_cents);
