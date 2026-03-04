import uuid

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from app.schemas import CleanupRequest, ErrorResponse, HealthResponse

app = FastAPI(
    title="idea2real Geometry Service",
    version="0.0.0",
)


@app.middleware("http")
async def add_request_id(request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    response: Response = await call_next(request)
    response.headers["request-id"] = request_id
    return response


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post("/cleanup", status_code=501, response_model=ErrorResponse)
async def cleanup_stub(request: CleanupRequest) -> JSONResponse:
    return JSONResponse(
        status_code=501,
        content={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "Cleanup endpoint is not yet implemented",
            }
        },
    )
