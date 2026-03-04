import io
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, File, Request, Response, UploadFile
from fastapi.responses import StreamingResponse

from app.schemas import (
    CleanupParams,
    CleanupRequest,
    CleanupResultResponse,
    ErrorDetail,
    ErrorResponse,
    HealthResponse,
)

RequestResponseEndpoint = Callable[[Request], Awaitable[Response]]

app = FastAPI(
    title="idea2real Geometry Service",
    version="0.0.0",
)


@app.middleware("http")
async def add_request_id(request: Request, call_next: RequestResponseEndpoint) -> Response:
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    response: Response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", version=app.version)


@app.post("/cleanup", response_model=CleanupResultResponse)
async def cleanup(request: CleanupRequest) -> CleanupResultResponse:
    """Run cleanup pipeline on a mesh.

    For P1 MVP, this operates on a test mesh. In production, it will
    fetch the mesh from storage using model_id.
    """
    import trimesh

    from app.pipeline import run_cleanup_pipeline

    # For P1: create a simple test mesh (cube) as placeholder.
    # In production: fetch mesh bytes from object storage using request.model_id.
    mesh = trimesh.creation.box(extents=[10, 10, 10])

    params_dict = {}
    if request.params:
        if request.params.voxel_size is not None:
            params_dict["voxel_size"] = request.params.voxel_size
        if request.params.target_faces is not None:
            params_dict["target_faces"] = request.params.target_faces
        if request.params.scale_factor is not None:
            params_dict["scale_factor"] = request.params.scale_factor

    result = run_cleanup_pipeline(
        mesh=mesh,
        operations=[op.value for op in request.operations],
        params=params_dict if params_dict else None,
    )

    job_id = uuid.uuid4()
    output_key = f"cleaned/{request.model_id}/{job_id}.glb"

    return CleanupResultResponse(
        job_id=job_id,
        model_id=request.model_id,
        output_storage_key=output_key,
        vertex_count=result.vertex_count,
        face_count=result.face_count,
        is_manifold=result.is_manifold,
        is_watertight=result.is_watertight,
    )


@app.post("/cleanup/file")
async def cleanup_file(
    file: UploadFile = File(...),
    operations: str = "remove_doubles,recalc_normals",
) -> CleanupResultResponse:
    """Upload a mesh file, run cleanup, return metadata."""
    import trimesh

    from app.pipeline import run_cleanup_pipeline

    contents = await file.read()
    mesh = trimesh.load(io.BytesIO(contents), file_type=_guess_format(file.filename or ""))

    if not isinstance(mesh, trimesh.Trimesh):
        # Handle Scene objects by concatenating meshes
        if isinstance(mesh, trimesh.Scene):
            mesh = trimesh.util.concatenate(list(mesh.geometry.values()))
        else:
            raise ValueError("Uploaded file is not a valid mesh")

    op_list = [op.strip() for op in operations.split(",") if op.strip()]
    result = run_cleanup_pipeline(mesh=mesh, operations=op_list)

    job_id = uuid.uuid4()
    model_id = uuid.uuid4()

    return CleanupResultResponse(
        job_id=job_id,
        model_id=model_id,
        output_storage_key=f"cleaned/{model_id}/{job_id}.glb",
        vertex_count=result.vertex_count,
        face_count=result.face_count,
        is_manifold=result.is_manifold,
        is_watertight=result.is_watertight,
    )


@app.post("/export/stl")
async def export_stl(
    file: UploadFile = File(...),
    operations: str = "remove_doubles,recalc_normals",
) -> StreamingResponse:
    """Upload mesh, run cleanup, return STL binary."""
    import trimesh

    from app.export import export_stl as do_export
    from app.pipeline import run_cleanup_pipeline

    contents = await file.read()
    mesh = trimesh.load(io.BytesIO(contents), file_type=_guess_format(file.filename or ""))

    if not isinstance(mesh, trimesh.Trimesh):
        if isinstance(mesh, trimesh.Scene):
            mesh = trimesh.util.concatenate(list(mesh.geometry.values()))
        else:
            raise ValueError("Uploaded file is not a valid mesh")

    op_list = [op.strip() for op in operations.split(",") if op.strip()]
    result = run_cleanup_pipeline(mesh=mesh, operations=op_list)

    stl_bytes = do_export(result.mesh)

    return StreamingResponse(
        io.BytesIO(stl_bytes),
        media_type="model/stl",
        headers={"Content-Disposition": "attachment; filename=export.stl"},
    )


def _guess_format(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return {"glb": "glb", "gltf": "gltf", "stl": "stl", "obj": "obj", "ply": "ply"}.get(
        ext, "glb"
    )
