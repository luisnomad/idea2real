"""Upload endpoints should fail safely for malformed or abusive inputs."""

from fastapi.testclient import TestClient
import trimesh

from app.main import MAX_UPLOAD_BYTES, app

client = TestClient(app)


def _valid_stl_bytes() -> bytes:
    mesh = trimesh.creation.box(extents=[10, 10, 10])
    stl_bytes = mesh.export(file_type="stl")
    assert isinstance(stl_bytes, bytes)
    return stl_bytes


def test_cleanup_file_rejects_unsupported_extension() -> None:
    response = client.post(
        "/cleanup/file",
        files={"file": ("payload.exe", b"not-mesh", "application/octet-stream")},
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"
    assert "x-request-id" in response.headers


def test_cleanup_file_rejects_oversized_upload() -> None:
    response = client.post(
        "/cleanup/file",
        files={"file": ("large.stl", b"x" * (MAX_UPLOAD_BYTES + 1), "model/stl")},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"
    assert "x-request-id" in response.headers


def test_upload_endpoints_reject_malformed_mesh_without_internal_leaks() -> None:
    for path in ("/cleanup/file", "/export/stl"):
        response = client.post(
            path,
            files={"file": ("bad.stl", b"not-a-valid-stl", "model/stl")},
        )
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "INVALID_MESH"
        text = response.text.lower()
        assert "traceback" not in text
        assert "/app/" not in text


def test_cleanup_file_rejects_unknown_operation_with_422() -> None:
    response = client.post(
        "/cleanup/file?operations=remove_doubles,unknown_op",
        files={"file": ("cube.stl", _valid_stl_bytes(), "model/stl")},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_OPERATIONS"
