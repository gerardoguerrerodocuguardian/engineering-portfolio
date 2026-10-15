"""Pure aggregation math (no I/O). Totals form a commutative monoid under `merge`."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass


@dataclass(frozen=True)
class Totals:
    impressions: int = 0
    clicks: int = 0
    spend_cents: int = 0

    def merge(self, other: Totals) -> Totals:
        return Totals(
            self.impressions + other.impressions,
            self.clicks + other.clicks,
            self.spend_cents + other.spend_cents,
        )

    @property
    def ctr(self) -> float:
        """Click-through rate = clicks / impressions; 0.0 when there are no impressions."""
        return self.clicks / self.impressions if self.impressions else 0.0


def aggregate(events: Iterable[Totals]) -> Totals:
    total = Totals()
    for event in events:
        total = total.merge(event)
    return total
