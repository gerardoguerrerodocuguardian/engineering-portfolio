"""Service layer: business rules; talks to repositories, returns API schemas."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.aggregation import Totals, aggregate
from app.errors import NotFoundError
from app.repositories import AggregateRepository, CampaignRepository, UsageRepository
from app.schemas import Campaign, CampaignPage, CampaignReport, CreateCampaign, UsageIn


class CampaignService:
    def __init__(self, session: AsyncSession) -> None:
        self.campaigns = CampaignRepository(session)

    async def create(self, body: CreateCampaign) -> Campaign:
        row = await self.campaigns.add(
            body.name, body.daily_budget_cents, body.max_bid_cents, body.keywords
        )
        return Campaign.model_validate(row)

    async def get(self, campaign_id: str) -> Campaign:
        row = await self.campaigns.get(campaign_id)
        if row is None:
            raise NotFoundError(f"Campaign {campaign_id} not found")
        return Campaign.model_validate(row)

    async def page(self, page: int, page_size: int, status: str | None) -> CampaignPage:
        rows = await self.campaigns.list((page - 1) * page_size, page_size, status)
        return CampaignPage(
            items=[Campaign.model_validate(r) for r in rows],
            page=page,
            page_size=page_size,
            total=await self.campaigns.count(status),
        )


class ReportService:
    def __init__(self, session: AsyncSession) -> None:
        self.campaigns = CampaignRepository(session)
        self.usage = UsageRepository(session)
        self.aggregates = AggregateRepository(session)

    async def _require(self, campaign_id: str) -> None:
        if await self.campaigns.get(campaign_id) is None:
            raise NotFoundError(f"Campaign {campaign_id} not found")

    async def record_usage(self, campaign_id: str, body: UsageIn) -> None:
        await self._require(campaign_id)
        await self.usage.add(campaign_id, Totals(body.impressions, body.clicks, body.spend_cents))

    async def refresh(self, campaign_id: str) -> CampaignReport:
        """Fold events newer than the watermark into the stored totals (idempotent)."""
        current, watermark = await self.aggregates.get(campaign_id)
        new_events = await self.usage.since(campaign_id, watermark)
        if new_events:
            current = current.merge(aggregate(t for _, t in new_events))
            await self.aggregates.save(campaign_id, current, new_events[-1][0])
        return _to_report(campaign_id, current)

    async def report(self, campaign_id: str) -> CampaignReport:
        await self._require(campaign_id)
        totals, _ = await self.aggregates.get(campaign_id)
        return _to_report(campaign_id, totals)


def _to_report(campaign_id: str, t: Totals) -> CampaignReport:
    return CampaignReport(
        campaign_id=campaign_id,
        impressions=t.impressions,
        clicks=t.clicks,
        spend_cents=t.spend_cents,
        ctr=t.ctr,
    )


async def refresh_in_background(maker: async_sessionmaker[AsyncSession], campaign_id: str) -> None:
    """Background task entry point: owns its session (the request session is already closed)."""
    async with maker() as session:
        await ReportService(session).refresh(campaign_id)
