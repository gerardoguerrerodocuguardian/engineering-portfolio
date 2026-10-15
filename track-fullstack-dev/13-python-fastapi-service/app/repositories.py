"""Persistence layer: the only module that builds SQL / touches ORM rows."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.aggregation import Totals
from app.models import CampaignRow, ReportAggregateRow, UsageEventRow


class CampaignRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(
        self, name: str, daily_budget_cents: int, max_bid_cents: int, keywords: list[str]
    ) -> CampaignRow:
        row = CampaignRow(
            id=str(uuid.uuid4()),
            name=name,
            status="DRAFT",
            daily_budget_cents=daily_budget_cents,
            max_bid_cents=max_bid_cents,
            keywords=keywords,
        )
        self.session.add(row)
        await self.session.commit()
        return row

    async def get(self, campaign_id: str) -> CampaignRow | None:
        return await self.session.get(CampaignRow, campaign_id)

    async def list(self, offset: int, limit: int, status: str | None) -> list[CampaignRow]:
        stmt = select(CampaignRow).order_by(CampaignRow.created_at, CampaignRow.id)
        if status:
            stmt = stmt.where(CampaignRow.status == status)
        result = await self.session.scalars(stmt.offset(offset).limit(limit))
        return list(result)

    async def count(self, status: str | None) -> int:
        stmt = select(func.count()).select_from(CampaignRow)
        if status:
            stmt = stmt.where(CampaignRow.status == status)
        return int(await self.session.scalar(stmt) or 0)


class UsageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, campaign_id: str, usage: Totals) -> None:
        self.session.add(
            UsageEventRow(
                campaign_id=campaign_id,
                impressions=usage.impressions,
                clicks=usage.clicks,
                spend_cents=usage.spend_cents,
            )
        )
        await self.session.commit()

    async def since(self, campaign_id: str, after_id: int) -> list[tuple[int, Totals]]:
        stmt = (
            select(UsageEventRow)
            .where(UsageEventRow.campaign_id == campaign_id, UsageEventRow.id > after_id)
            .order_by(UsageEventRow.id)
        )
        rows = await self.session.scalars(stmt)
        return [(r.id, Totals(r.impressions, r.clicks, r.spend_cents)) for r in rows]


class AggregateRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, campaign_id: str) -> tuple[Totals, int]:
        row = await self.session.get(ReportAggregateRow, campaign_id)
        if row is None:
            return Totals(), 0
        return Totals(row.impressions, row.clicks, row.spend_cents), row.last_event_id

    async def save(self, campaign_id: str, totals: Totals, last_event_id: int) -> None:
        row = await self.session.get(ReportAggregateRow, campaign_id)
        if row is None:
            row = ReportAggregateRow(campaign_id=campaign_id)
            self.session.add(row)
        row.impressions = totals.impressions
        row.clicks = totals.clicks
        row.spend_cents = totals.spend_cents
        row.last_event_id = last_event_id
        row.updated_at = datetime.now(UTC)
        await self.session.commit()
