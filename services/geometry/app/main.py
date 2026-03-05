import io
import os
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.schemas import (
    CleanupRequest,
    CleanupResultResponse,
    ErrorResponse,
    HealthResponse,
)

RequestResponseEndpoint = Callable[[Request], Awaitable[Response]]

app = FastAPI(
    title="idea2real Geometry Service",
    version="0.0.0",
)

MAX_UPLOAD_BYTES = int(os.getenv("GEOMETRY_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
UPLOAD_CHUNK_BYTES = 64 * 1024
ALLOWED_MESH_TYPES = {"glb", "gltf", "stl", "obj", "ply"}


def _request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if isinstance(request_id, str) and request_id:
        return request_id
    return str(uuid.uuid4())


def _error_response(
    request: Request, *, code: str, message: str, status_code: int
) -> JSONResponse:
    rid = _request_id(request)
    payload = ErrorResponse.model_validate(
        {"error": {"code": code, "message": message, "requestId": rid}}
    )
    response = JSONResponse(status_code=status_code, content=payload.model_dump(by_alias=True))
    response.headers["x-request-id"] = rid
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, dict) else {}
    code = detail.get("code", "BAD_REQUEST")
    message = detail.get("message", str(exc.detail) if exc.detail else "Request failed")
    return _error_response(request, code=code, message=message, status_code=exc.status_code)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, _exc: Exception) -> JSONResponse:
    return _error_response(
        request,
        code="INTERNAL_ERROR",
        message="An unexpected error occurred",
        status_code=500,
    )


def _get_upload_file_type(filename: str | None) -> str:
    if not filename:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_FILE_NAME", "message": "Uploaded file name is required"},
        )
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_MESH_TYPES:
        raise HTTPException(
            status_code=415,
            detail={
                "code": "UNSUPPORTED_FILE_TYPE",
                "message": f"Allowed mesh formats: {', '.join(sorted(ALLOWED_MESH_TYPES))}",
            },
        )
    return ext


async def _read_upload_with_limit(file: UploadFile) -> bytes:
    total = 0
    chunks: list[bytes] = []

    while True:
        chunk = await file.read(UPLOAD_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail={
                    "code": "PAYLOAD_TOO_LARGE",
                    "message": f"Uploaded file exceeds {MAX_UPLOAD_BYTES} bytes",
                },
            )
        chunks.append(chunk)

    if total == 0:
        raise HTTPException(
            status_code=400,
            detail={"code": "EMPTY_FILE", "message": "Uploaded file is empty"},
        )

    return b"".join(chunks)


def _load_uploaded_mesh(contents: bytes, file_type: str):
    import trimesh

    try:
        mesh = trimesh.load(io.BytesIO(contents), file_type=file_type)
    except Exception as exc:  # pragma: no cover - exact parser exceptions vary by format
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_MESH", "message": "Uploaded file is not a valid mesh"},
        ) from exc

    if isinstance(mesh, trimesh.Scene):
        geometries = list(mesh.geometry.values())
        if not geometries:
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_MESH", "message": "Uploaded file contains no mesh data"},
            )
        mesh = trimesh.util.concatenate(geometries)

    if not isinstance(mesh, trimesh.Trimesh):
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_MESH", "message": "Uploaded file is not a valid mesh"},
        )
    return mesh


def _parse_operations(operations: str) -> list[str]:
    op_list = [op.strip() for op in operations.split(",") if op.strip()]
    if not op_list:
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_OPERATIONS", "message": "At least one operation is required"},
        )
    return op_list


@app.middleware("http")
async def add_request_id(request: Request, call_next: RequestResponseEndpoint) -> Response:
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    request.state.request_id = request_id
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
    from app.pipeline import run_cleanup_pipeline

    file_type = _get_upload_file_type(file.filename)
    contents = await _read_upload_with_limit(file)
    mesh = _load_uploaded_mesh(contents, file_type)
    op_list = _parse_operations(operations)
    try:
        result = run_cleanup_pipeline(mesh=mesh, operations=op_list)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_OPERATIONS", "message": str(exc)},
        ) from exc

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
    from app.export import export_stl as do_export
    from app.pipeline import run_cleanup_pipeline

    file_type = _get_upload_file_type(file.filename)
    contents = await _read_upload_with_limit(file)
    mesh = _load_uploaded_mesh(contents, file_type)
    op_list = _parse_operations(operations)
    try:
        result = run_cleanup_pipeline(mesh=mesh, operations=op_list)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_OPERATIONS", "message": str(exc)},
        ) from exc

    stl_bytes = do_export(result.mesh)

    return StreamingResponse(
        io.BytesIO(stl_bytes),
        media_type="model/stl",
        headers={"Content-Disposition": "attachment; filename=export.stl"},
    )
