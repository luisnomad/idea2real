"""Given a cleaned mesh, when STL export runs, then valid STL bytes are produced."""

import trimesh

from app.export import export_stl


def test_export_stl_returns_bytes() -> None:
    mesh = trimesh.creation.box(extents=[10, 10, 10])
    stl_bytes = export_stl(mesh)
    assert isinstance(stl_bytes, bytes)
    assert len(stl_bytes) > 0


def test_export_stl_produces_valid_stl() -> None:
    mesh = trimesh.creation.box(extents=[10, 10, 10])
    stl_bytes = export_stl(mesh)
    # Binary STL header is 80 bytes + 4 bytes face count
    assert len(stl_bytes) > 84


def test_export_stl_to_file(tmp_path: object) -> None:
    import pathlib

    mesh = trimesh.creation.box(extents=[10, 10, 10])
    out = pathlib.Path(str(tmp_path)) / "test.stl"
    stl_bytes = export_stl(mesh, output_path=out)
    assert out.exists()
    assert out.read_bytes() == stl_bytes
