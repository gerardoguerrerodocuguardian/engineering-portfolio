from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from app.main import create_app
from tests.conftest import SETTINGS

CONTRACT = Path(__file__).resolve().parents[3] / "shared/contracts/campaign-api.openapi.yaml"
REPORT_PATH = "/v1/campaigns/{id}/report"


def test_generated_openapi_contains_contract_report_path() -> None:
    contract: dict[str, Any] = yaml.safe_load(CONTRACT.read_text())
    assert REPORT_PATH in contract["paths"]
    # The contract uses {id}; FastAPI derives the name from the parameter ({campaign_id}).
    generated = {
        p.replace("{campaign_id}", "{id}") for p in create_app(SETTINGS).openapi()["paths"]
    }
    assert REPORT_PATH in generated


def test_report_schema_matches_contract_required_fields() -> None:
    contract: dict[str, Any] = yaml.safe_load(CONTRACT.read_text())
    expected = contract["components"]["schemas"]["CampaignReport"]
    schema = create_app(SETTINGS).openapi()["components"]["schemas"]["CampaignReport"]
    assert set(expected["required"]) <= set(schema["required"])
    types = {"string": "string", "integer": "integer", "number": "number"}
    for name, spec in expected["properties"].items():
        assert schema["properties"][name]["type"] == types[spec["type"]]


def test_openapi_declares_bearer_and_sse() -> None:
    doc = create_app(SETTINGS).openapi()
    assert "text/event-stream" in str(doc["paths"]["/v1/campaigns/{campaign_id}/report/stream"])
    assert "HTTPBearer" in doc["components"]["securitySchemes"]
