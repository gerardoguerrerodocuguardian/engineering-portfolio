"""Pydantic v2 API schemas, camelCase on the wire to match the shared OpenAPI contract."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class CampaignStatus(StrEnum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    EXHAUSTED = "EXHAUSTED"


class CreateCampaign(Camel):
    name: str = Field(min_length=3, max_length=120)
    daily_budget_cents: int = Field(ge=0)
    max_bid_cents: int = Field(ge=1)
    keywords: list[str] = Field(default_factory=list)


class Campaign(Camel):
    id: str
    name: str
    status: CampaignStatus
    daily_budget_cents: int
    max_bid_cents: int
    keywords: list[str]
    created_at: datetime


class CampaignPage(Camel):
    items: list[Campaign]
    page: int
    page_size: int
    total: int


class UsageIn(Camel):
    impressions: int = Field(ge=0)
    clicks: int = Field(ge=0)
    spend_cents: int = Field(ge=0)

    @model_validator(mode="after")
    def _clicks_le_impressions(self) -> Self:
        if self.clicks > self.impressions:
            raise ValueError("clicks cannot exceed impressions")
        return self


class CampaignReport(Camel):
    campaign_id: str
    impressions: int
    clicks: int
    spend_cents: int
    ctr: float = Field(description="clicks / impressions")
