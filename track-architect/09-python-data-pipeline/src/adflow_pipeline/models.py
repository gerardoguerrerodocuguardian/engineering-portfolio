"""Pydantic v2 model of the ad event contract (shared/contracts/ad-events.asyncapi.yaml)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

CONTRACT_FIELDS: tuple[str, ...] = ("eventId", "type", "campaignId", "costCents", "occurredAt")
# `ingestedAt` is a pipeline envelope field (arrival time), not part of the AsyncAPI payload.
ENVELOPE_FIELDS: tuple[str, ...] = ("ingestedAt",)
KNOWN_FIELDS: frozenset[str] = frozenset(CONTRACT_FIELDS + ENVELOPE_FIELDS)

EventType = Literal["IMPRESSION", "CLICK"]


class AdEvent(BaseModel):
    """An impression or a click. Both message types share one payload shape."""

    model_config = ConfigDict(frozen=True, populate_by_name=True, extra="ignore")

    event_id: UUID = Field(alias="eventId")
    type: EventType
    campaign_id: Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")] = (
        Field(alias="campaignId")
    )
    cost_cents: Annotated[int, Field(strict=True, ge=0)] = Field(alias="costCents")
    occurred_at: AwareDatetime = Field(alias="occurredAt")
    ingested_at: AwareDatetime | None = Field(default=None, alias="ingestedAt")

    @property
    def occurred_utc(self) -> datetime:
        """Event time as naive UTC (what the warehouse stores)."""
        return self.occurred_at.astimezone(UTC).replace(tzinfo=None)

    @property
    def ingested_utc(self) -> datetime:
        """Arrival time as naive UTC; falls back to event time when absent."""
        return (self.ingested_at or self.occurred_at).astimezone(UTC).replace(tzinfo=None)
