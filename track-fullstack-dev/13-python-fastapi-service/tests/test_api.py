from __future__ import annotations

import json

import jwt
from httpx import AsyncClient

from tests.conftest import SETTINGS, auth, make_campaign, token


async def test_create_and_get_campaign(client: AsyncClient) -> None:
    cid = await make_campaign(client)
    r = await client.get(f"/v1/campaigns/{cid}")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "DRAFT"
    assert body["dailyBudgetCents"] == 10_000
    assert body["keywords"] == ["shoes"]


async def test_pagination_and_status_filter(client: AsyncClient) -> None:
    for i in range(5):
        await make_campaign(client, f"Campaign {i}")
    r = await client.get("/v1/campaigns", params={"page": 2, "pageSize": 2})
    body = r.json()
    assert (body["page"], body["pageSize"], body["total"]) == (2, 2, 5)
    assert len(body["items"]) == 2
    last = (await client.get("/v1/campaigns", params={"page": 3, "pageSize": 2})).json()
    assert len(last["items"]) == 1
    none = (await client.get("/v1/campaigns", params={"status": "ACTIVE"})).json()
    assert none == {"items": [], "page": 1, "pageSize": 20, "total": 0}


async def test_page_size_validated_as_problem(client: AsyncClient) -> None:
    r = await client.get("/v1/campaigns", params={"pageSize": 1000})
    assert r.status_code == 422
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.json()["errors"][0]["loc"][-1] == "pageSize"


async def test_unknown_campaign_is_problem_404(client: AsyncClient) -> None:
    r = await client.get("/v1/campaigns/nope")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.json()["instance"] == "/v1/campaigns/nope"
    assert (await client.get("/v1/campaigns/nope/report")).status_code == 404
    assert (await client.get("/v1/campaigns/nope/report/stream")).status_code == 404
    post = await client.post(
        "/v1/campaigns/nope/usage", json={"impressions": 1, "clicks": 0, "spendCents": 0}
    )
    assert post.status_code == 404


async def test_validation_error_creating_campaign(client: AsyncClient) -> None:
    r = await client.post("/v1/campaigns", json={"name": "x", "dailyBudgetCents": -1})
    assert r.status_code == 422
    assert r.json()["title"] == "Validation failed"


async def test_usage_is_aggregated_in_background(client: AsyncClient) -> None:
    cid = await make_campaign(client)
    for imp, clk, spend in [(1000, 50, 400), (500, 25, 200)]:
        r = await client.post(
            f"/v1/campaigns/{cid}/usage",
            json={"impressions": imp, "clicks": clk, "spendCents": spend},
        )
        assert r.status_code == 202
    report = (await client.get(f"/v1/campaigns/{cid}/report")).json()
    assert report == {
        "campaignId": cid,
        "impressions": 1500,
        "clicks": 75,
        "spendCents": 600,
        "ctr": 0.05,
    }


async def test_empty_report_has_zero_ctr(client: AsyncClient) -> None:
    cid = await make_campaign(client)
    report = (await client.get(f"/v1/campaigns/{cid}/report")).json()
    assert report["impressions"] == 0
    assert report["ctr"] == 0.0


async def test_usage_rejects_clicks_over_impressions(client: AsyncClient) -> None:
    cid = await make_campaign(client)
    r = await client.post(
        f"/v1/campaigns/{cid}/usage", json={"impressions": 1, "clicks": 2, "spendCents": 0}
    )
    assert r.status_code == 422


async def test_sse_streams_aggregates(client: AsyncClient) -> None:
    cid = await make_campaign(client)
    await client.post(
        f"/v1/campaigns/{cid}/usage", json={"impressions": 10, "clicks": 1, "spendCents": 7}
    )
    r = await client.get(
        f"/v1/campaigns/{cid}/report/stream", params={"maxEvents": 2, "interval": 0}
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    frames = [f for f in r.text.split("\n\n") if f]
    assert len(frames) == 2
    data = json.loads(frames[0].split("data: ", 1)[1])
    assert data["impressions"] == 10
    assert "event: aggregate" in frames[0]


async def test_health_and_request_id_header(client: AsyncClient) -> None:
    r = await client.get(
        "/healthz",
        headers={"x-request-id": "abc", "traceparent": f"00-{'a' * 32}-{'b' * 16}-01"},
    )
    assert r.json() == {"status": "UP"}
    assert r.headers["x-request-id"] == "abc"
    assert "x-request-id" in (await client.get("/healthz")).headers


# --- auth -----------------------------------------------------------------------------------


async def test_missing_token_is_401_problem(client: AsyncClient) -> None:
    r = await client.get("/v1/campaigns", headers={"Authorization": ""})
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == "Bearer"
    assert r.headers["content-type"].startswith("application/problem+json")


async def test_garbage_and_expired_tokens_are_401(client: AsyncClient) -> None:
    for bad in ("garbage", token(ttl_s=-10)):
        r = await client.get("/v1/campaigns", headers={"Authorization": f"Bearer {bad}"})
        assert r.status_code == 401


async def test_wrong_issuer_or_signature_is_401(client: AsyncClient) -> None:
    forged = jwt.encode(
        {"sub": "x", "iss": "evil", "exp": 4102444800, "scope": "campaigns:read"},
        SETTINGS.jwt_secret,
        algorithm="HS256",
    )
    r = await client.get("/v1/campaigns", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


async def test_missing_scope_is_403(client: AsyncClient) -> None:
    read_only = auth(["campaigns:read"])
    r = await client.post(
        "/v1/campaigns",
        headers=read_only,
        json={"name": "Nope", "dailyBudgetCents": 1, "maxBidCents": 1},
    )
    assert r.status_code == 403
    assert "campaigns:write" in r.json()["detail"]
    assert (await client.get("/v1/campaigns/x/report", headers=read_only)).status_code == 403


async def test_unhandled_error_is_500_problem(client: AsyncClient) -> None:
    app = client._transport.app  # type: ignore[attr-defined]

    async def boom() -> None:
        raise RuntimeError("kaboom")

    app.add_api_route("/boom", boom)

    r = await client.get("/boom")
    assert r.status_code == 500
    assert r.json()["detail"] == "Unexpected error"
    assert "kaboom" not in r.text


async def test_http_exception_is_problem(client: AsyncClient) -> None:
    r = await client.get("/no-such-route")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/problem+json")
