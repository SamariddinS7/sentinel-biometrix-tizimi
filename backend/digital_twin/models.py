
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Tuple

class Vector3(BaseModel):
    x: float
    y: float
    z: float

class FloorPlanInput(BaseModel):
    image_data: Optional[str] = None # Base64
    scale_px_per_meter: float = Field(..., gt=0)
    width_px: int
    height_px: int

class WallSegment(BaseModel):
    id: str
    p1: Tuple[float, float] # 2D Floor coords (x, z)
    p2: Tuple[float, float]
    thickness: float = 0.2
    height: float = 3.2

class ZoneDefinition(BaseModel):
    id: str
    name: str
    type: str # RESTRICTED, PUBLIC, etc.
    floor_id: str
    points: List[Tuple[float, float]]
    height_offset: float = 0.0
    height: float = 3.0

class CameraSpecs(BaseModel):
    id: str
    position: Vector3
    rotation: Vector3 # Euler degrees
    focal_length_mm: float = 2.8
    sensor_width_mm: float = 4.8
    max_distance_m: float = 20.0
    resolution: Tuple[int, int] = (1920, 1080)

class CoverageResult(BaseModel):
    camera_id: str
    visible_volume_mesh: List[Vector3] # Vertices
    blind_spots: List[Vector3]
    coverage_percentage: float
