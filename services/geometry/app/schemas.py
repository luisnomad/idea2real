"""Request/response schemas aligned with @idea2real/contracts geometry schemas."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, field_validator


class HealthResponse(BaseModel):
    status: str = "ok"


class CleanupOperation(str, Enum):
    remove_doubles = "remove_doubles"
    recalc_normals = "recalc_normals"
    manifold_repair = "manifold_repair"
    voxel_remesh = "voxel_remesh"
    decimate = "decimate"
    flatten_base = "flatten_base"
    scale = "scale"


class CleanupParams(BaseModel):
    voxel_size: Optional[float] = None
    target_faces: Optional[int] = None
    scale_factor: Optional[float] = None


class CleanupRequest(BaseModel):
    model_id: str
    operations: list[CleanupOperation]
    params: Optional[CleanupParams] = None

    @field_validator("operations")
    @classmethod
    def operations_not_empty(cls, v: list[CleanupOperation]) -> list[CleanupOperation]:
        if len(v) == 0:
            raise ValueError("operations must contain at least one item")
        return v


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: Optional[str] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
