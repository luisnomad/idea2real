"""Given the geometry service, when POST /cleanup, then cleanup runs and returns result."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"


def test_cleanup_returns_200_with_result() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": VALID_UUID,
            "operations": ["remove_doubles"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "vertexCount" in body
    assert "faceCount" in body
    assert "isManifold" in body
    assert "isWatertight" in body


def test_cleanup_includes_request_id_header() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": VALID_UUID,
            "operations": ["remove_doubles"],
        },
    )
    assert response.status_code == 200
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
    assert "x-request-id" in response.headers


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
            "operations": ["remove_doubles"],
            "params": {"voxelSize": -1.0},
        },
    )
    assert response.status_code == 422


def test_cleanup_accepts_optional_params() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": VALID_UUID,
            "operations": ["scale"],
            "params": {"scaleFactor": 2.0},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["vertexCount"] > 0
