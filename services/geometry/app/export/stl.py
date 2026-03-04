"""STL export from trimesh."""

from pathlib import Path

import trimesh


def export_stl(mesh: trimesh.Trimesh, output_path: str | Path | None = None) -> bytes:
    """Export mesh to binary STL format.

    If output_path is provided, writes to file and returns the bytes.
    Otherwise, returns the STL bytes directly.
    """
    stl_bytes = trimesh.exchange.stl.export_stl(mesh)

    if output_path is not None:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(stl_bytes)

    return stl_bytes
