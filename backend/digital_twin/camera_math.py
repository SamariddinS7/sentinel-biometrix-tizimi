
import numpy as np
import math
from typing import Tuple, List, Dict

class CameraMath:
    """
    Mathematical Core for 3D Camera Projection.
    Converts physical camera properties (Sensor size, Focal length) and 
    Pose (Position, Orientation) into 3D World Space Frustums.
    """

    def __init__(self, 
                 position: Tuple[float, float, float], 
                 rotation: Tuple[float, float, float], # (Pitch, Yaw, Roll) in degrees
                 sensor_width_mm: float = 4.8, 
                 focal_length_mm: float = 2.8,
                 resolution: Tuple[int, int] = (1920, 1080),
                 max_distance: float = 20.0):
        
        self.position = np.array(position, dtype=np.float32)
        self.rotation = np.radians(np.array(rotation, dtype=np.float32)) # Convert to rads
        self.max_dist = max_distance
        
        # Calculate Intrinsics
        self.aspect_ratio = resolution[0] / resolution[1]
        
        # Horizontal FOV (rad) = 2 * arctan(sensor_width / (2 * focal_length))
        self.fov_h_rad = 2 * math.atan(sensor_width_mm / (2 * focal_length_mm))
        
        # Vertical FOV (rad) derived from Aspect Ratio
        # tan(fov_v/2) = tan(fov_h/2) / aspect_ratio
        self.fov_v_rad = 2 * math.atan(math.tan(self.fov_h_rad / 2) / self.aspect_ratio)

    def get_rotation_matrix(self) -> np.ndarray:
        """
        Computes the rotation matrix R from Euler angles (Pitch, Yaw, Roll).
        Order applied: Y (Yaw) -> X (Pitch) -> Z (Roll).
        Coordinate System: Y-Up, -Z Forward.
        """
        pitch, yaw, roll = self.rotation

        # Rotation around X-axis (Pitch/Tilt)
        Rx = np.array([
            [1, 0, 0],
            [0, math.cos(pitch), -math.sin(pitch)],
            [0, math.sin(pitch), math.cos(pitch)]
        ])

        # Rotation around Y-axis (Yaw/Pan)
        Ry = np.array([
            [math.cos(yaw), 0, math.sin(yaw)],
            [0, 1, 0],
            [-math.sin(yaw), 0, math.cos(yaw)]
        ])

        # Rotation around Z-axis (Roll) - Usually 0 for surveillance
        Rz = np.array([
            [math.cos(roll), -math.sin(roll), 0],
            [math.sin(roll), math.cos(roll), 0],
            [0, 0, 1]
        ])

        # Combined Rotation
        return Ry @ Rx @ Rz

    def get_frustum_rays(self) -> List[np.ndarray]:
        """
        Returns normalized direction vectors for the 4 corners of the frustum in World Space.
        Order: Top-Left, Top-Right, Bottom-Right, Bottom-Left
        """
        # Tangents of half-angles
        tan_h = math.tan(self.fov_h_rad / 2)
        tan_v = math.tan(self.fov_v_rad / 2)

        # Local rays (Camera Space: Forward is -Z)
        # TL, TR, BR, BL
        local_rays = [
            np.array([-tan_h,  tan_v, -1.0]), # Top-Left
            np.array([ tan_h,  tan_v, -1.0]), # Top-Right
            np.array([ tan_h, -tan_v, -1.0]), # Bottom-Right
            np.array([-tan_h, -tan_v, -1.0])  # Bottom-Left
        ]

        # Rotate to World Space
        R = self.get_rotation_matrix()
        world_rays = []
        
        for ray in local_rays:
            # Normalize
            ray = ray / np.linalg.norm(ray)
            # Rotate
            rotated_ray = R @ ray
            world_rays.append(rotated_ray)

        return world_rays

    def get_frustum_geometry(self) -> Dict[str, List[float]]:
        """
        Returns vertices for a visual representation of the frustum.
        Apex + 4 Far Corners.
        """
        rays = self.get_frustum_rays()
        
        # Apex
        vertices = [float(x) for x in self.position]
        
        # Far Plane Corners
        for ray in rays:
            far_point = self.position + (ray * self.max_dist)
            vertices.extend([float(x) for x in far_point])
            
        return {
            "vertices": vertices, # [Ax,Ay,Az, TLx,TLy,TLz, ...]
            "fov_h": math.degrees(self.fov_h_rad),
            "fov_v": math.degrees(self.fov_v_rad)
        }
