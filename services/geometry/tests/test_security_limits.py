"""Given upload and processing endpoints, when malformed inputs arrive, then they are rejected."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"


def test_cleanup_rejects_missing_body() -> None:
    response = client.post("/cleanup")
    assert response.status_code == 422


def test_cleanup_rejects_extra_unknown_operations() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": VALID_UUID,
            "operations": ["remove_doubles", "delete_everything"],
        },
    )
    assert response.status_code == 422


def test_cleanup_rejects_non_uuid_model_id() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": "12345",
            "operations": ["remove_doubles"],
        },
    )
    assert response.status_code == 422


def test_cleanup_rejects_zero_voxel_size() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": VALID_UUID,
            "operations": ["remove_doubles"],
            "params": {"voxelSize": 0},
        },
    )
    assert response.status_code == 422


def test_cleanup_rejects_zero_target_faces() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": VALID_UUID,
            "operations": ["decimate"],
            "params": {"targetFaces": 0},
        },
    )
    assert response.status_code == 422


def test_cleanup_rejects_zero_scale_factor() -> None:
    response = client.post(
        "/cleanup",
        json={
            "modelId": VALID_UUID,
            "operations": ["scale"],
            "params": {"scaleFactor": 0},
        },
    )
    assert response.status_code == 422


def test_error_responses_do_not_leak_internals() -> None:
    """Error responses should not contain stack traces or internal paths."""
    response = client.post(
        "/cleanup",
        json={
            "modelId": "not-valid",
            "operations": ["bad"],
        },
    )
    body = response.text
    assert "/app/" not in body and "traceback" not in body.lower()
    assert "File " not in body
