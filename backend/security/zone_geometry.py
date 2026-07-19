
from dataclasses import dataclass
import numpy as np

@dataclass
class Vector3:
    x: float
    y: float
    z: float

class ZoneVolume:
    """
    Represents a mathematical 3D volume for security enforcement.
    Currently implements Axis-Aligned Bounding Box (AABB).
    Can be extended to convex hulls or meshes.
    """
    def __init__(self, position: dict, dimensions: dict):
        """
        :param position: Center {x, y, z}
        :param dimensions: Size {x, y, z} (Width, Height, Depth)
        """
        cx, cy, cz = position['x'], position['y'], position['z']
        w, h, d = dimensions['x'], dimensions['y'], dimensions['z']
        
        # Calculate Min/Max Bounds
        self.min_x = cx - (w / 2)
        self.max_x = cx + (w / 2)
        self.min_y = cy - (h / 2)
        self.max_y = cy + (h / 2)
        self.min_z = cz - (d / 2)
        self.max_z = cz + (d / 2)

    def contains(self, point: dict) -> bool:
        """
        Strict 3D Point-in-Volume Test.
        """
        x, y, z = point['x'], point['y'], point['z']
        
        return (
            self.min_x <= x <= self.max_x and
            self.min_y <= y <= self.max_y and
            self.min_z <= z <= self.max_z
        )

    def __repr__(self):
        return f"ZoneVol[({self.min_x:.1f},{self.min_y:.1f},{self.min_z:.1f}) -> ({self.max_x:.1f},{self.max_y:.1f},{self.max_z:.1f})]"
