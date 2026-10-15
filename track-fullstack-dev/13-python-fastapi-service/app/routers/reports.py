from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response
from fastapi.responses import StreamingResponse

from app.deps import report_service
from app.schemas import CampaignReport, UsageIn
from app.security import require_scope
from app.services import ReportService, refresh_in_background

router = APIRouter(prefix="/v1/campaigns", tags=["reports"])
Svc = Annotated[ReportService, Depends(report_service)]


@router.post(
    "/{campaign_id}/usage",
    status_code=202,
    dependencies=[Depends(require_scope("usage:write"))],
)
async def record_usage(
    campaign_id: str, body: UsageIn, svc: Svc, request: Request, tasks: BackgroundTasks
) -> Response:
    """Store the event, then fold it into the aggregate after the response is sent."""
    await svc.record_usage(campaign_id, body)
    tasks.add_task(refresh_in_background, request.app.state.sessionmaker, campaign_id)
    return Response(status_code=202)


@router.get(
    "/{campaign_id}/report",
    response_model=CampaignReport,
    summary="Aggregated performance report for a campaign",
    dependencies=[Depends(require_scope("reports:read"))],
)
async def get_report(campaign_id: str, svc: Svc) -> CampaignReport:
    return await svc.report(campaign_id)


@router.get(
    "/{campaign_id}/report/stream",
    summary="Server-Sent Events stream of live aggregates",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {}}}},
    dependencies=[Depends(require_scope("reports:read"))],
)
async def stream_report(
    campaign_id: str,
    request: Request,
    svc: Svc,
    interval: Annotated[float, Query(ge=0, le=60)] = 1.0,
    max_events: Annotated[int | None, Query(ge=1, le=10_000, alias="maxEvents")] = None,
) -> StreamingResponse:
    await svc.report(campaign_id)  # 404 before the stream starts

    async def events() -> AsyncIterator[str]:
        sent = 0
        while max_events is None or sent < max_events:
            if await request.is_disconnected():
                break
            snapshot = await svc.report(campaign_id)
            data = snapshot.model_dump_json(by_alias=True)
            yield f"id: {sent}\nevent: aggregate\ndata: {data}\n\n"
            sent += 1
            await asyncio.sleep(interval)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
