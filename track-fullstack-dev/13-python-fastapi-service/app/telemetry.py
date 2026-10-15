"""OpenTelemetry-ready ASGI middleware (stub).

It already does the parts that do not need an SDK: W3C `traceparent` extraction, a request id,
timing and an access log line. To go further, replace `_start_span` with
`opentelemetry.trace.get_tracer(...).start_as_current_span(...)`; nothing else changes.
"""

from __future__ import annotations

import logging
import re
import time
import uuid

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.logging_conf import request_id_var, trace_id_var

log = logging.getLogger("adflow.access")
_TRACEPARENT = re.compile(r"^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$")


class TelemetryMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {k.decode(): v.decode() for k, v in scope["headers"]}
        request_id = headers.get("x-request-id") or uuid.uuid4().hex
        match = _TRACEPARENT.match(headers.get("traceparent", ""))
        request_id_var.set(request_id)
        trace_id_var.set(match.group(1) if match else "-")
        started = time.perf_counter()
        status = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                MutableHeaders(scope=message)["x-request-id"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            log.info(
                "request",
                extra={
                    "method": scope["method"],
                    "path": scope["path"],
                    "status": status,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
