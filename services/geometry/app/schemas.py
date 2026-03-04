"""Request/response schemas aligned with @idea2real/contracts geometry schemas."""

from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CamelModel(BaseModel):
    """Base model that serializes to camelCase to match TypeScript contracts."""

    model_config = ConfigDict(
        alias_generator=lambda s: "".join(
            w.capitalize() if i else w for i, w in enumerate(s.split("_"))
        ),
        populate_by_name=True,
    )


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.0.0"


class CleanupOperation(str, Enum):
    remove_doubles = "remove_doubles"
    recalc_normals = "recalc_normals"
    manifold_repair = "manifold_repair"
    voxel_remesh = "voxel_remesh"
    decimate = "decimate"
    flatten_base = "flatten_base"
    scale = "scale"


class CleanupParams(CamelModel):
    voxel_size: Optional[float] = Field(default=None, gt=0)
    target_faces: Optional[int] = Field(default=None, gt=0)
    scale_factor: Optional[float] = Field(default=None, gt=0)


class CleanupRequest(CamelModel):
    model_id: UUID
    operations: list[CleanupOperation]
    params: Optional[CleanupParams] = None

    @field_validator("operations")
    @classmethod
    def operations_not_empty(cls, v: list[CleanupOperation]) -> list[CleanupOperation]:
        if len(v) == 0:
            raise ValueError("operations must contain at least one item")
        return v


class CleanupResultResponse(CamelModel):
    """Cleanup pipeline result with mesh metadata."""

    job_id: UUID
    model_id: UUID
    output_storage_key: str
    vertex_count: int
    face_count: int
    is_manifold: bool
    is_watertight: bool


class ErrorDetail(CamelModel):
    code: str
    message: str
    request_id: Optional[str] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
