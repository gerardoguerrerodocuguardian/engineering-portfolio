"""Dependency-injection wiring for services."""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.services import CampaignService, ReportService


def campaign_service(session: AsyncSession = Depends(get_session)) -> CampaignService:  # noqa: B008
    return CampaignService(session)


def report_service(session: AsyncSession = Depends(get_session)) -> ReportService:  # noqa: B008
    return ReportService(session)
