from pathlib import Path

import pytest

from archkit import contracts as k
from archkit.config import ConfigError

from .conftest import write

SPEC = """
openapi: 3.0.3
paths:
  /v1/items:
    get: {}
    post: {}
    parameters: []
  /v1/items/{id}:
    get: {}
    x-note: 1
  /bad: null
"""

CTRL = """
@Controller('v1/items')
export class C {
  @Get()
  a() {}
  @Post()
  b() {}
  @Get(':id')
  c() {}
  @Delete(':id')
  d() {}
}
"""


def test_normalize() -> None:
    assert k.normalize_path("v1/items/{id}/") == "/v1/items/{}"
    assert k.normalize_path("/a/:id/b") == "/a/{}/b"
    assert k.normalize_path("") == "/"


def test_openapi_and_nest(tmp_path: Path) -> None:
    spec = k.load_openapi(write(tmp_path, "spec.yaml", SPEC))
    assert spec == {("GET", "/v1/items"), ("POST", "/v1/items"), ("GET", "/v1/items/{}")}
    write(tmp_path, "src/c.controller.ts", CTRL)
    write(tmp_path, "src/other.ts", "@Get('zzz')")
    write(tmp_path, "src/h.controller.ts", "@Controller()\nclass H { @Get('health') h() {} }")
    impl = k.load_nest_routes(tmp_path / "src")
    assert ("DELETE", "/v1/items/{}") in impl and ("GET", "/health") in impl
    rep = k.compare(spec, impl, {("GET", "/health")})
    assert rep.missing == [] and rep.extra == [("DELETE", "/v1/items/{}")]
    assert rep.ok(strict=False) and not rep.ok(strict=True)


def test_drift_detected() -> None:
    rep = k.compare({("GET", "/a"), ("GET", "/b")}, {("GET", "/a")}, set())
    assert rep.missing == [("GET", "/b")] and not rep.ok(False)


def test_route_list(tmp_path: Path) -> None:
    f = write(tmp_path, "r.txt", "# c\nget /a/{x}  # trailing\n\nPOST /b\n")
    assert k.load_route_list(f) == {("GET", "/a/{}"), ("POST", "/b")}
    with pytest.raises(ConfigError):
        k.load_route_list(write(tmp_path, "bad.txt", "FETCH /a"))
    with pytest.raises(ConfigError):
        k.load_route_list(tmp_path / "none")


def test_errors(tmp_path: Path) -> None:
    with pytest.raises(ConfigError):
        k.load_openapi(tmp_path / "none")
    with pytest.raises(ConfigError):
        k.load_openapi(write(tmp_path, "a.yaml", "a: ["))
    with pytest.raises(ConfigError):
        k.load_openapi(write(tmp_path, "b.yaml", "x: 1"))
    with pytest.raises(ConfigError):
        k.load_nest_routes(tmp_path / "none")
    with pytest.raises(ConfigError):
        k.parse_ignore(["onlyone"])
    assert k.parse_ignore(["get /x/:id"]) == {("GET", "/x/{}")}
