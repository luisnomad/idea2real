import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response

from app.schemas import CleanupRequest, ErrorDetail, ErrorResponse, HealthResponse

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


@app.post("/cleanup", status_code=501, response_model=ErrorResponse)
async def cleanup_stub(request: CleanupRequest) -> ErrorResponse:
    return ErrorResponse(
        error=ErrorDetail(
            code="NOT_IMPLEMENTED",
            message="Cleanup endpoint is not yet implemented",
        )
    )
