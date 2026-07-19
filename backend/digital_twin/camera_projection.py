
import numpy as np
import math

class CameraProjection:
    def __init__(self, focal_length_mm: float, sensor_width_mm: float, image_dims: tuple, position: tuple, rotation: tuple):
        """
        :param focal_length_mm: Physical focal length (e.g., 2.8, 4.0)
        :param sensor_width_mm: Sensor width (e.g., 4.8 for 1/3")
        :param image_dims: (width, height) in pixels
        :param position: (x, y, z) world coordinates
        :param rotation: (pitch, yaw, roll) in degrees
        """
        self.focal_length = focal_length_mm
        self.sensor_width = sensor_width_mm
        self.width_px, self.height_px = image_dims
        self.position = np.array(position, dtype=np.float32)
        self.rotation = np.array(rotation, dtype=np.float32) # degrees

        self.intrinsic_matrix = self._compute_intrinsic_matrix()
        self.extrinsic_matrix = self._compute_extrinsic_matrix()

    def _compute_intrinsic_matrix(self):
        # fx = (f_mm / sensor_width_mm) * width_px
        fx = (self.focal_length / self.sensor_width) * self.width_px
        # Assuming square pixels, fy = fx * (h/w ratio correction if sensor aspect != img aspect, but usually square pixels assumed)
        # We'll calculate fy independently assuming 4:3 sensor aspect usually matches or use sensor height if available
        # Simplified: Use square pixel assumption
        fy = fx 
        cx = self.width_px / 2.0
        cy = self.height_px / 2.0
        
        return np.array([
            [fx, 0, cx],
            [0, fy, cy],
            [0, 0, 1]
        ], dtype=np.float32)

    def _compute_extrinsic_matrix(self):
        # Rotation Matrix from Euler Angles (Pitch, Yaw, Roll)
        # Order: Y (Yaw) -> X (Pitch) -> Z (Roll) is common for cams
        # Coordinates: X (Right), Y (Up), Z (Forward/Depth) - OpenGL style
        
        pitch, yaw, roll = np.radians(self.rotation)
        
        Rx = np.array([
            [1, 0, 0],
            [0, math.cos(pitch), -math.sin(pitch)],
            [0, math.sin(pitch), math.cos(pitch)]
        ])
        
        Ry = np.array([
            [math.cos(yaw), 0, math.sin(yaw)],
            [0, 1, 0],
            [-math.sin(yaw), 0, math.cos(yaw)]
        ])
        
        Rz = np.array([
            [math.cos(roll), -math.sin(roll), 0],
            [math.sin(roll), math.cos(roll), 0],
            [0, 0, 1]
        ])
        
        # R = Ry @ Rx @ Rz (Order depends on system, assuming Standard Cam)
        R = Ry @ Rx @ Rz
        
        # Extrinsic = [R | t]
        # But we mostly need Camera-to-World for Ray Casting (Inverse View)
        # So we store Rotation and Position directly
        return R

    def get_world_ray(self, u: float, v: float):
        """
        Returns ray origin and normalized direction vector in World Space.
        """
        # 1. Pixel to Normalized Device Coordinates (Camera Space)
        K_inv = np.linalg.inv(self.intrinsic_matrix)
        pixel_homog = np.array([u, v, 1.0])
        ray_cam = K_inv @ pixel_homog
        
        # 2. Camera to World Space
        # Ray Direction in World = R * Ray_Cam
        # Note: Standard camera looks down -Z or +Z depending on convention.
        # We assume standard CV convention: +Z forward, +Y down, +X right.
        # But for 3D world (Y-up), we need coordinate conversion.
        # Let's assume Camera Rotation handles the alignment.
        
        ray_world = self.extrinsic_matrix @ ray_cam
        ray_world = ray_world / np.linalg.norm(ray_world)
        
        return self.position, ray_world
