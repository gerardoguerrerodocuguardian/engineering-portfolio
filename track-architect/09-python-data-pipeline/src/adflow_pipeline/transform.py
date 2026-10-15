"""SQL (DuckDB) for aggregation, Polars for ratios, pacing and window finality."""

from __future__ import annotations

from datetime import datetime

import duckdb
import polars as pl

HOURLY_SQL = """
SELECT
    campaign_id,
    date_trunc('hour', occurred_at)                                   AS hour_start,
    count(*) FILTER (WHERE event_type = 'IMPRESSION')                 AS impressions,
    count(*) FILTER (WHERE event_type = 'CLICK')                      AS clicks,
    CAST(sum(cost_cents) AS BIGINT)                                   AS spend_cents,
    count(*) FILTER (WHERE ingested_at - occurred_at > INTERVAL {late} HOUR) AS late_events
FROM ad_events
GROUP BY 1, 2
ORDER BY 1, 2
"""


def daily_budget_cents(campaign_id: str) -> int:
    """Synthetic per-campaign daily budget (stand-in for a campaign-config lookup)."""
    digits = "".join(ch for ch in campaign_id if ch.isdigit()) or "0"
    return 12_000 + (int(digits) * 1_700) % 9_000


def hourly_metrics(
    con: duckdb.DuckDBPyConnection, watermark: datetime | None, lateness_hours: int = 2
) -> pl.DataFrame:
    """Per campaign/hour metrics. Always recomputed from the full table, so late events
    restate earlier windows (replace, never increment). `is_final` = window end <= watermark."""
    df = con.execute(HOURLY_SQL.format(late=int(lateness_hours))).pl()
    if df.is_empty():
        return df.with_columns(
            pl.lit(None, pl.Float64).alias("ctr"),
            pl.lit(False).alias("is_final"),
            pl.lit(None, pl.Date).alias("day"),
            pl.lit(None, pl.Int8).alias("hour_of_day"),
            pl.lit(None, pl.Int64).alias("daily_budget_cents"),
            pl.lit(None, pl.Int64).alias("cum_spend_cents"),
            pl.lit(None, pl.Float64).alias("pacing_ratio"),
        )
    budgets = {c: daily_budget_cents(c) for c in df["campaign_id"].unique().to_list()}
    wm = watermark if watermark is not None else datetime.min
    return (
        df.with_columns(
            ctr=pl.when(pl.col("impressions") > 0)
            .then(pl.col("clicks") / pl.col("impressions"))
            .otherwise(None),
            is_final=(pl.col("hour_start") + pl.duration(hours=1)) <= wm,
            day=pl.col("hour_start").dt.date(),
            hour_of_day=pl.col("hour_start").dt.hour(),
            daily_budget_cents=pl.col("campaign_id").replace_strict(budgets, return_dtype=pl.Int64),
        )
        .sort("campaign_id", "hour_start")
        .with_columns(cum_spend_cents=pl.col("spend_cents").cum_sum().over("campaign_id", "day"))
        .with_columns(
            pacing_ratio=pl.col("cum_spend_cents")
            / (pl.col("daily_budget_cents") * (pl.col("hour_of_day") + 1) / 24)
        )
    )


def daily_metrics(hourly: pl.DataFrame) -> pl.DataFrame:
    """Per campaign/day roll-up of the hourly table."""
    if hourly.is_empty():
        return pl.DataFrame(
            schema={
                "campaign_id": pl.String,
                "day": pl.Date,
                "impressions": pl.Int64,
                "clicks": pl.Int64,
                "spend_cents": pl.Int64,
                "late_events": pl.Int64,
                "ctr": pl.Float64,
                "daily_budget_cents": pl.Int64,
                "budget_utilization": pl.Float64,
            }
        )
    return (
        hourly.group_by("campaign_id", "day")
        .agg(
            pl.col("impressions").sum(),
            pl.col("clicks").sum(),
            pl.col("spend_cents").sum(),
            pl.col("late_events").sum(),
            pl.col("daily_budget_cents").first(),
        )
        .with_columns(
            ctr=pl.when(pl.col("impressions") > 0)
            .then(pl.col("clicks") / pl.col("impressions"))
            .otherwise(None),
            budget_utilization=pl.col("spend_cents") / pl.col("daily_budget_cents"),
        )
        .sort("campaign_id", "day")
    )
