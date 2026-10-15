-- Idempotent load of raw events. Replaying the same batch inserts nothing.
-- Params: @events (JSON array string), @min_day, @max_day (DATE) bound the partitions scanned in the target.
-- ${project}/${dataset} are substituted by the application (or by `make sql-render`).
MERGE `${project}.${dataset}.ad_events` AS t
USING (
  SELECT
    JSON_VALUE(j, '$.event_id')                           AS event_id,
    JSON_VALUE(j, '$.type')                               AS type,
    JSON_VALUE(j, '$.campaign_id')                        AS campaign_id,
    CAST(JSON_VALUE(j, '$.cost_cents') AS INT64)          AS cost_cents,
    TIMESTAMP(JSON_VALUE(j, '$.occurred_at'))             AS occurred_at
  FROM UNNEST(JSON_QUERY_ARRAY(PARSE_JSON(@events))) AS j
  -- the batch itself may contain duplicates (at-least-once delivery)
  QUALIFY ROW_NUMBER() OVER (PARTITION BY JSON_VALUE(j, '$.event_id') ORDER BY JSON_VALUE(j, '$.occurred_at')) = 1
) AS s
ON  t.event_id = s.event_id
-- partition pruning: without this predicate MERGE scans the whole target table
AND DATE(t.occurred_at) BETWEEN @min_day AND @max_day
WHEN NOT MATCHED THEN
  INSERT (event_id, type, campaign_id, cost_cents, occurred_at)
  VALUES (s.event_id, s.type, s.campaign_id, s.cost_cents, s.occurred_at);
