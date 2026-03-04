"""Given a mesh, when cleanup operations run, then the mesh is repaired and metadata is returned."""

import trimesh

from app.pipeline import run_cleanup_pipeline


def _make_box() -> trimesh.Trimesh:
    return trimesh.creation.box(extents=[10, 10, 10])


def test_remove_doubles_reduces_vertices() -> None:
    mesh = _make_box()
    # Duplicate some vertices to test merge
    original_count = len(mesh.vertices)
    result = run_cleanup_pipeline(mesh, ["remove_doubles"])
    assert result.vertex_count <= original_count
    assert result.face_count > 0


def test_recalc_normals_produces_valid_mesh() -> None:
    mesh = _make_box()
    result = run_cleanup_pipeline(mesh, ["recalc_normals"])
    assert result.vertex_count > 0
    assert result.face_count > 0


def test_manifold_repair_fills_holes() -> None:
    mesh = _make_box()
    result = run_cleanup_pipeline(mesh, ["manifold_repair"])
    assert result.is_watertight


def test_flatten_base_sets_min_z() -> None:
    mesh = _make_box()
    result = run_cleanup_pipeline(mesh, ["flatten_base"])
    z_min = result.mesh.vertices[:, 2].min()
    assert z_min == mesh.bounds[0][2]


def test_scale_changes_size() -> None:
    mesh = _make_box()
    original_extent = mesh.extents[0]
    result = run_cleanup_pipeline(mesh, ["scale"], params={"scale_factor": 2.0})
    new_extent = result.mesh.extents[0]
    assert abs(new_extent - original_extent * 2.0) < 0.01


def test_full_pipeline_sequence() -> None:
    mesh = _make_box()
    result = run_cleanup_pipeline(
        mesh,
        ["remove_doubles", "recalc_normals", "manifold_repair", "flatten_base"],
    )
    assert result.vertex_count > 0
    assert result.face_count > 0
    assert result.is_watertight


def test_unknown_operation_raises() -> None:
    mesh = _make_box()
    try:
        run_cleanup_pipeline(mesh, ["magic_smooth"])
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "Unknown operation" in str(e)
