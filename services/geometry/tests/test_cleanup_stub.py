"""Given the geometry service starts, when POST /cleanup, then 501 with stub response."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"


def test_cleanup_returns_501_not_implemented() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": VALID_UUID,
            "operations": ["remove_doubles"],
        },
    )
    assert response.status_code == 501
    body = response.json()
    assert body["error"]["code"] == "NOT_IMPLEMENTED"
    assert "not yet implemented" in body["error"]["message"].lower()


def test_cleanup_includes_request_id_header() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": VALID_UUID,
            "operations": ["voxel_remesh", "decimate"],
        },
    )
    assert "x-request-id" in response.headers


def test_cleanup_rejects_empty_operations() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": VALID_UUID,
            "operations": [],
        },
    )
    assert response.status_code == 422


def test_cleanup_rejects_invalid_operation() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": VALID_UUID,
            "operations": ["magic_smooth"],
        },
    )
    assert response.status_code == 422


def test_cleanup_rejects_invalid_uuid() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": "not-a-uuid",
            "operations": ["remove_doubles"],
        },
    )
    assert response.status_code == 422


def test_cleanup_rejects_negative_voxel_size() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": VALID_UUID,
            "operations": ["voxel_remesh"],
            "params": {"voxelSize": -1.0},
        },
    )
    assert response.status_code == 422


def test_cleanup_accepts_optional_params() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": VALID_UUID,
            "operations": ["voxel_remesh"],
            "params": {"voxelSize": 5.0},
        },
    )
    assert response.status_code == 501
