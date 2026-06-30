
import numpy as np
import logging
import math
from typing import Tuple

logger = logging.getLogger("CoordinateMapper")

class CoordinateMapper:
    """
    Transforms 2D Camera Bounding Boxes into 2D Floor Plan Coordinates.
    Uses a simplified perspective model based on camera height and tilt.
    """
    
    @staticmethod
    def map_to_floor_plan(
        bbox: np.ndarray, 
        frame_dims: Tuple[int, int], 
        cam_placement: dict
    ) -> Tuple[float, float]:
        """
        bbox: [x1, y1, x2, y2]
        frame_dims: (height, width)
        cam_placement: { x, y, rotation, fov, depth }
        """
        if bbox is None: return None
        
        # 1. Extract inputs
        x1, y1, x2, y2 = bbox
        img_h, img_w = frame_dims
        cam_x = cam_placement['x']
        cam_y = cam_placement['y']
        cam_rot_deg = cam_placement['rotation']
        cam_depth = cam_placement['depth'] # Max range in pixels/meters
        fov_deg = cam_placement['fov']

        # 2. Calculate Bearing (Horizontal Angle)
        # Center of bbox X relative to image center
        bbox_cx = (x1 + x2) / 2
        img_cx = img_w / 2
        
        # Normalized deviation (-0.5 to 0.5)
        rel_x = (bbox_cx - img_cx) / img_w
        
        # Angle relative to camera optical axis
        # Linear approximation for standard lenses
        bearing_deg = rel_x * fov_deg
        
        # 3. Calculate Distance
        # Simple heuristic: Lower in the image = closer (if looking down)
        # OR Larger height = closer
        # Let's use Inverse Height heuristic (assuming standing humans)
        bbox_h = y2 - y1
        rel_h = bbox_h / img_h
        
        # Avoid division by zero
        if rel_h < 0.01: rel_h = 0.01
        
        # Distance factor (0.0 to 1.0)
        # This is a crude approximation. Real systems use Homography.
        # Function: distance decays as bbox gets smaller
        # Normalized Distance = constant / rel_height
        # Let's verify: height 1.0 (full screen) -> dist 0 (close)
        # height 0.0 -> dist max
        
        # A simple linear projection for top-down logic provided in prompt:
        # "Place camera icon... FOV... max distance"
        # We assume the camera covers a sector. 
        # We map the bbox bottom (feet) to the depth.
        
        rel_y_bottom = y2 / img_h # 0.0 (top) to 1.0 (bottom)
        # If camera is top-down, feet location (y) maps to distance
        # But if camera is angled, size matters more.
        
        # Let's use a hybrid:
        estimated_dist_factor = 1.0 - rel_y_bottom # 0 at bottom, 1 at top? No.
        # Usually bottom of image is closest.
        # So distance increases as y decreases (goes up image).
        # range: 0 (at bottom) to 1.0 (at top)
        
        # BUT, standard surveillance cameras look down-ish.
        # Bottom of image = Close. Top of image = Far.
        # dist_ratio 0.0 = Closest (at cam), 1.0 = Farthest (at range)
        
        dist_ratio = (1.0 - (y2 / img_h)) # Simple linear floor mapping
        
        # Clamp
        dist_ratio = max(0.0, min(1.0, dist_ratio))
        
        real_distance = dist_ratio * cam_depth
        
        # 4. Polar to Cartesian
        # Global Angle = Camera Rotation + Bearing
        # Note: Canvas rotation usually: 0 = East, 90 = South (CW)
        # Adjust for standard math (CCW) if needed, but let's stick to CSS/Canvas standard (CW)
        
        global_angle_deg = cam_rot_deg + bearing_deg
        global_angle_rad = math.radians(global_angle_deg)
        
        map_x = cam_x + (real_distance * math.cos(global_angle_rad))
        map_y = cam_y + (real_distance * math.sin(global_angle_rad))
        
        return float(map_x), float(map_y)

coordinate_mapper = CoordinateMapper()
