"""Mesh cleanup operations using trimesh."""

from dataclasses import dataclass

import numpy as np
import trimesh


@dataclass
class CleanupResult:
    mesh: trimesh.Trimesh
    vertex_count: int
    face_count: int
    is_manifold: bool
    is_watertight: bool


def remove_doubles(mesh: trimesh.Trimesh, **_kwargs: object) -> trimesh.Trimesh:
    """Merge vertices within tolerance."""
    mesh.merge_vertices()
    return mesh


def recalc_normals(mesh: trimesh.Trimesh, **_kwargs: object) -> trimesh.Trimesh:
    """Fix face winding and recalculate normals."""
    trimesh.repair.fix_normals(mesh)
    return mesh


def manifold_repair(mesh: trimesh.Trimesh, **_kwargs: object) -> trimesh.Trimesh:
    """Fill holes and repair non-manifold geometry."""
    trimesh.repair.fill_holes(mesh)
    trimesh.repair.fix_winding(mesh)
    return mesh


def voxel_remesh(
    mesh: trimesh.Trimesh, voxel_size: float = 5.0, **_kwargs: object
) -> trimesh.Trimesh:
    """Voxel-based remeshing for watertight output.

    Uses convex hull as a P1 fallback when scipy is not available.
    Full voxel remesh requires scipy for marching cubes.
    """
    try:
        voxelized = mesh.voxelized(pitch=voxel_size)
        return voxelized.marching_cubes
    except (ImportError, ModuleNotFoundError):
        # Fallback: convex hull produces watertight mesh
        return mesh.convex_hull


def decimate(
    mesh: trimesh.Trimesh, target_faces: int = 50000, **_kwargs: object
) -> trimesh.Trimesh:
    """Reduce face count while preserving shape."""
    if len(mesh.faces) <= target_faces:
        return mesh
    ratio = target_faces / len(mesh.faces)
    return mesh.simplify_quadric_decimation(int(len(mesh.faces) * ratio))


def flatten_base(mesh: trimesh.Trimesh, **_kwargs: object) -> trimesh.Trimesh:
    """Flatten the bottom of the mesh to create a print base."""
    bounds = mesh.bounds
    z_min = bounds[0][2]
    threshold = z_min + (bounds[1][2] - z_min) * 0.02  # bottom 2%
    vertices = mesh.vertices.copy()
    mask = vertices[:, 2] < threshold
    vertices[mask, 2] = z_min
    mesh.vertices = vertices
    return mesh


def scale_mesh(
    mesh: trimesh.Trimesh, scale_factor: float = 1.0, **_kwargs: object
) -> trimesh.Trimesh:
    """Uniform scale."""
    mesh.apply_scale(scale_factor)
    return mesh


OPERATIONS = {
    "remove_doubles": remove_doubles,
    "recalc_normals": recalc_normals,
    "manifold_repair": manifold_repair,
    "voxel_remesh": voxel_remesh,
    "decimate": decimate,
    "flatten_base": flatten_base,
    "scale": scale_mesh,
}


def run_cleanup_pipeline(
    mesh: trimesh.Trimesh,
    operations: list[str],
    params: dict[str, object] | None = None,
) -> CleanupResult:
    """Run a sequence of cleanup operations on a mesh."""
    kwargs = dict(params) if params else {}

    for op_name in operations:
        fn = OPERATIONS.get(op_name)
        if fn is None:
            raise ValueError(f"Unknown operation: {op_name}")
        mesh = fn(mesh, **kwargs)

    return CleanupResult(
        mesh=mesh,
        vertex_count=len(mesh.vertices),
        face_count=len(mesh.faces),
        is_manifold=bool(mesh.is_watertight),  # trimesh: watertight implies manifold
        is_watertight=bool(mesh.is_watertight),
    )
