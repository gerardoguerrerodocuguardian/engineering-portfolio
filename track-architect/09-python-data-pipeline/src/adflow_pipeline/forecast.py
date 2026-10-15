"""CTR baseline forecast: hour-of-day seasonal mean versus a constant, plain numpy.

This is a baseline to compare better models against, not a production forecaster.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import polars as pl

MIN_DAYS = 3


@dataclass(frozen=True)
class ForecastResult:
    status: str  # "ok" | "insufficient_data"
    days_used: int = 0
    mae_seasonal: float | None = None
    mae_constant: float | None = None
    skill: float | None = None  # 1 - mae_seasonal / mae_constant; > 0 means better than constant
    interval_halfwidth: float | None = None
    next_day: list[tuple[int, float, float, float]] = field(default_factory=list)  # hour, p, lo, hi
    note: str = ""


def _profile(clicks: np.ndarray, imps: np.ndarray, fallback: float) -> np.ndarray:
    """Pooled CTR per hour-of-day (24,), falling back where there is no traffic."""
    out = np.full(24, fallback)
    mask = imps > 0
    out[mask] = clicks[mask] / imps[mask]
    return out


def _by_hour(df: pl.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    g = df.group_by("hour_of_day").agg(pl.col("clicks").sum(), pl.col("impressions").sum())
    clicks, imps = np.zeros(24), np.zeros(24)
    for h, c, i in g.iter_rows():
        clicks[int(h)], imps[int(h)] = c, i
    return clicks, imps


def forecast_ctr(hourly: pl.DataFrame) -> ForecastResult:
    """Fit on finalized hours only; hold out the last day to score against a constant."""
    final = hourly.filter(pl.col("is_final") & (pl.col("impressions") > 0))
    days = sorted(final["day"].unique().to_list()) if not final.is_empty() else []
    if len(days) < MIN_DAYS:
        return ForecastResult("insufficient_data", len(days), note=f"need >= {MIN_DAYS} full days")
    overall = final.group_by("day", "hour_of_day").agg(
        pl.col("clicks").sum(), pl.col("impressions").sum()
    )
    train, test = (
        overall.filter(pl.col("day") < days[-1]),
        overall.filter(pl.col("day") == days[-1]),
    )
    t_clicks, t_imps = _by_hour(train)
    const = float(t_clicks.sum() / max(t_imps.sum(), 1.0))
    seasonal = _profile(t_clicks, t_imps, const)
    hours = test["hour_of_day"].to_numpy()
    actual = test["clicks"].to_numpy() / test["impressions"].to_numpy()
    err_s, err_c = actual - seasonal[hours], actual - const
    mae_s, mae_c = float(np.abs(err_s).mean()), float(np.abs(err_c).mean())
    skill = 1.0 - mae_s / mae_c if mae_c > 0 else None

    f_clicks, f_imps = _by_hour(overall)
    f_const = float(f_clicks.sum() / max(f_imps.sum(), 1.0))
    final_profile = _profile(f_clicks, f_imps, f_const)
    half = 1.96 * float(np.sqrt(np.mean(err_s**2)))  # crude normal interval from holdout RMSE
    nxt = [
        (h, float(p), max(0.0, float(p) - half), float(p) + half)
        for h, p in enumerate(final_profile)
    ]
    verdict = "no better than" if skill is None or skill <= 0 else "better than"
    return ForecastResult(
        "ok",
        len(days),
        mae_s,
        mae_c,
        skill,
        half,
        nxt,
        note=(
            f"Seasonal profile is {verdict} a constant CTR on a single-day holdout. "
            "One holdout day on synthetic data says little about real traffic; "
            "the interval assumes normal, independent errors."
        ),
    )
