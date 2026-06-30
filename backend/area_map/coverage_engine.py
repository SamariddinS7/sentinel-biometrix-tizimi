
import math
from typing import List, Dict, Tuple

class CoverageEngine:
    """
    Computes coverage polygons (Circular Sectors) for visual rendering
    and backend zone inclusion checks.
    """
    
    @staticmethod
    def calculate_fov_polygon(
        x: float, y: float, 
        rotation: float, 
        fov: float, 
        depth: float, 
        segments: int = 10
    ) -> List[Tuple[float, float]]:
        """
        Generates a list of points representing the camera cone.
        rotation: degrees
        fov: degrees
        depth: radius
        """
        
        # Start at camera position
        poly = [(x, y)]
        
        start_angle = rotation - (fov / 2)
        end_angle = rotation + (fov / 2)
        
        step = fov / segments
        
        for i in range(segments + 1):
            angle_deg = start_angle + (i * step)
            angle_rad = math.radians(angle_deg)
            
            px = x + (depth * math.cos(angle_rad))
            py = y + (depth * math.sin(angle_rad))
            
            poly.append((px, py))
            
        return poly

    @staticmethod
    def is_point_in_polygon(point: Tuple[float, float], polygon: List[Tuple[float, float]]) -> bool:
        """
        Ray casting algorithm for point-in-polygon check.
        """
        x, y = point
        n = len(polygon)
        inside = False
        
        p1x, p1y = polygon[0]
        for i in range(n + 1):
            p2x, p2y = polygon[i % n]
            
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
            
        return inside
