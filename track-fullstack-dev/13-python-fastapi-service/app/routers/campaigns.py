from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.deps import campaign_service
from app.schemas import Campaign, CampaignPage, CampaignStatus, CreateCampaign
from app.security import require_scope
from app.services import CampaignService

router = APIRouter(prefix="/v1/campaigns", tags=["campaigns"])
Svc = Annotated[CampaignService, Depends(campaign_service)]


@router.post(
    "",
    status_code=201,
    response_model=Campaign,
    dependencies=[Depends(require_scope("campaigns:write"))],
)
async def create_campaign(body: CreateCampaign, svc: Svc) -> Campaign:
    return await svc.create(body)


@router.get(
    "", response_model=CampaignPage, dependencies=[Depends(require_scope("campaigns:read"))]
)
async def list_campaigns(
    svc: Svc,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, alias="pageSize")] = 20,
    status: CampaignStatus | None = None,
) -> CampaignPage:
    return await svc.page(page, page_size, status.value if status else None)


@router.get(
    "/{campaign_id}",
    response_model=Campaign,
    dependencies=[Depends(require_scope("campaigns:read"))],
)
async def get_campaign(campaign_id: str, svc: Svc) -> Campaign:
    return await svc.get(campaign_id)
