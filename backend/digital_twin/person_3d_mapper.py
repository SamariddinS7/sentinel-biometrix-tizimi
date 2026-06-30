
import numpy as np
from typing import Dict, Optional, Tuple
from .camera_projection import CameraProjection
from .ray_casting_engine import RayCastingEngine
from .position_smoother import PositionSmoother
from ..face_recognition.config_manager import config_manager

class Person3DMapper:
    def __init__(self, camera_id: str, optical_params: dict):
        self.camera_id = camera_id
        # Initialize Projection Model
        self.projector = CameraProjection(
            focal_length_mm=optical_params.get('focalLength', 2.8),
            sensor_width_mm=optical_params.get('sensorWidth', 4.8),
            image_dims=optical_params.get('resolution', (1920, 1080)),
            position=(optical_params.get('x', 0), optical_params.get('height', 3.0), optical_params.get('y', 0)), # Mapping config y->height? Need verification.
            # Assuming standard config: x, y (floor), height (y-up), rotation
            rotation=(
                optical_params.get('pitch', 0), 
                optical_params.get('rotation', 0), # Yaw
                0 # Roll usually 0
            )
        )
        
        # Track Smoothers: Dict[track_id, PositionSmoother]
        self.smoothers: Dict[int, PositionSmoother] = {}

    def calculate_3d_position(self, track_id: int, bbox: np.ndarray) -> Optional[dict]:
        """
        Maps a 2D bounding box to 3D world coordinates.
        Uses Bottom-Center point for Ray Casting.
        """
        conf = config_manager.position_mapping
        
        if not conf.use_ray_casting:
            return None # Fallback or heuristic if needed, but we enforce ray casting

        # 1. Select Feature Point (Bottom Center)
        # bbox: [x1, y1, x2, y2]
        x1, y1, x2, y2 = bbox
        u = (x1 + x2) / 2.0
        v = y2 # Feet position
        
        # 2. Cast Ray
        origin, direction = self.projector.get_world_ray(u, v)
        
        # 3. Intersect with Floor
        intersect_point = RayCastingEngine.intersect_floor_plane(origin, direction)
        
        if intersect_point is None:
            if conf.reject_invalid_positions:
                return None
            else:
                return {"x": 0, "y": 0, "z": 0} # Invalid fallback

        # 4. Smooth Position
        if track_id not in self.smoothers:
            self.smoothers[track_id] = PositionSmoother(
                max_speed_mps=conf.max_human_speed_mps
            )
        
        final_pos = intersect_point
        if conf.smoothing_enabled:
            final_pos = self.smoothers[track_id].process(intersect_point)

        return {
            "x": float(final_pos[0]),
            "y": float(final_pos[1]),
            "z": float(final_pos[2])
        }

    def cleanup(self, active_track_ids: list):
        """Remove smoothers for lost tracks"""
        current_ids = set(self.smoothers.keys())
        active_set = set(active_track_ids)
        to_remove = current_ids - active_set
        for tid in to_remove:
            del self.smoothers[tid]
