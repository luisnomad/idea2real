"""Given the geometry service starts, when GET /health, then 200 with status ok and version."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_200_with_status_ok_and_version() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body


def test_health_includes_request_id_header() -> None:
    response = client.get("/health")
    assert "x-request-id" in response.headers


def test_health_echoes_provided_request_id() -> None:
    response = client.get("/health", headers={"x-request-id": "test-req-42"})
    assert response.headers["x-request-id"] == "test-req-42"
