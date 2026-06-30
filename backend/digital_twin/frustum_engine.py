
import numpy as np
from typing import List, Dict
from .models import CameraSpecs, WallSegment, Vector3
from .camera_math import CameraMath

class FrustumEngine:
    """
    Computes precise coverage volumes.
    Uses Raycasting against Wall Geometry to clip the camera frustum.
    """

    @staticmethod
    def compute_coverage(camera: CameraSpecs, walls: List[WallSegment]) -> Dict[str, any]:
        """
        Generates a 3D volume mesh representing the camera's visible area,
        clipped by physical obstructions (walls).
        """
        # 1. Initialize Math Engine
        cam_math = CameraMath(
            position=(camera.position.x, camera.position.y, camera.position.z),
            rotation=(camera.rotation.x, camera.rotation.y, camera.rotation.z), # Pitch, Yaw, Roll
            sensor_width_mm=camera.sensor_width_mm,
            focal_length_mm=camera.focal_length_mm,
            max_distance=camera.max_distance_m
        )

        # 2. Get Frustum Corner Rays (World Space)
        corner_rays = cam_math.get_frustum_rays()
        origin = cam_math.position

        # 3. Raycast & Clip
        # We need to find the shortest collision distance for each ray against all walls
        clipped_points = []
        
        # Add center ray for better shape
        R = cam_math.get_rotation_matrix()
        center_ray = R @ np.array([0, 0, -1])
        rays_to_cast = corner_rays + [center_ray]

        for ray_dir in rays_to_cast:
            min_dist = camera.max_distance_m
            
            # Simple AABB Intersection for each wall
            # In a real engine, we'd use a BVH or Octree for speed
            for wall in walls:
                # Convert Wall Line Segment + Height to AABB
                # Wall: p1(x,z) -> p2(x,z), height h
                wx1, wz1 = wall.p1
                wx2, wz2 = wall.p2
                
                # AABB Min/Max
                # Add slight thickness for the line segment math
                box_min = np.array([min(wx1, wx2) - 0.1, 0, min(wz1, wz2) - 0.1])
                box_max = np.array([max(wx1, wx2) + 0.1, wall.height, max(wz1, wz2) + 0.1])
                
                dist = FrustumEngine._ray_aabb_intersection(origin, ray_dir, box_min, box_max)
                if dist > 0 and dist < min_dist:
                    min_dist = dist
            
            # Compute final point
            hit_point = origin + (ray_dir * min_dist)
            clipped_points.append(Vector3(x=hit_point[0], y=hit_point[1], z=hit_point[2]))

        # 4. Construct Mesh Data (Simple Pyramid Topology for now)
        # Vertices: Apex (0) + 5 Points (TL, TR, BR, BL, Center)
        # Note: center ray was added last
        apex = Vector3(x=origin[0], y=origin[1], z=origin[2])
        
        return {
            "camera_id": camera.id,
            "apex": apex,
            "corners": clipped_points, # TL, TR, BR, BL, Center
            "fov_h": math.degrees(cam_math.fov_h_rad)
        }

    @staticmethod
    def _ray_aabb_intersection(origin: np.ndarray, dir: np.ndarray, box_min: np.ndarray, box_max: np.ndarray) -> float:
        """
        Slab method for Ray-AABB intersection. Returns distance or -1 if no hit.
        """
        t1 = (box_min[0] - origin[0]) / (dir[0] if dir[0] != 0 else 1e-6)
        t2 = (box_max[0] - origin[0]) / (dir[0] if dir[0] != 0 else 1e-6)
        
        t3 = (box_min[1] - origin[1]) / (dir[1] if dir[1] != 0 else 1e-6)
        t4 = (box_max[1] - origin[1]) / (dir[1] if dir[1] != 0 else 1e-6)
        
        t5 = (box_min[2] - origin[2]) / (dir[2] if dir[2] != 0 else 1e-6)
        t6 = (box_max[2] - origin[2]) / (dir[2] if dir[2] != 0 else 1e-6)

        tmin = max(max(min(t1, t2), min(t3, t4)), min(t5, t6))
        tmax = min(min(max(t1, t2), max(t3, t4)), max(t5, t6))

        if tmax < 0 or tmin > tmax:
            return -1.0
            
        return tmin if tmin > 0 else tmax
