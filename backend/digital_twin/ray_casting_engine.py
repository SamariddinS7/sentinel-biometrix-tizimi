
import numpy as np
from typing import Optional, Tuple

class RayCastingEngine:
    """
    Computes intersection of viewing rays with 3D geometry.
    Primarily targeting the Floor Plane (y=0).
    """
    
    @staticmethod
    def intersect_floor_plane(ray_origin: np.ndarray, ray_dir: np.ndarray, floor_y: float = 0.0) -> Optional[np.ndarray]:
        """
        Intersects ray P = O + tD with plane Y = floor_y.
        Equation: (O_y + t * D_y) = floor_y
        t = (floor_y - O_y) / D_y
        """
        
        # Check if ray is parallel to plane
        if abs(ray_dir[1]) < 1e-6:
            return None
            
        t = (floor_y - ray_origin[1]) / ray_dir[1]
        
        # Check if intersection is behind camera
        if t < 0:
            return None
            
        # Calculate intersection point
        intersection = ray_origin + (t * ray_dir)
        
        return intersection

    @staticmethod
    def validate_intersection(point: np.ndarray, bounds: dict = None) -> bool:
        """
        Checks if the point lies within valid floor boundaries.
        """
        if bounds:
            x, y, z = point
            if not (bounds['x_min'] <= x <= bounds['x_max']): return False
            if not (bounds['z_min'] <= z <= bounds['z_max']): return False
            
        return True
