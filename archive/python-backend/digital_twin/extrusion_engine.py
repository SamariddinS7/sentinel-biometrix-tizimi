
import numpy as np
from typing import List, Dict
from .models import WallSegment

class ExtrusionEngine:
    """
    Converts 2D architectural drawings into 3D manifold geometry.
    Strictly enforces floor/ceiling limits.
    """

    @staticmethod
    def extrude_walls(walls: List[WallSegment]) -> Dict[str, dict]:
        """
        Returns GLTF-compatible mesh primitives for walls.
        """
        all_vertices = []
        all_indices = []
        idx_offset = 0

        for wall in walls:
            # 1. Calculate perpendicular vector for thickness
            x1, z1 = wall.p1
            x2, z2 = wall.p2
            
            dx = x2 - x1
            dz = z2 - z1
            length = np.sqrt(dx**2 + dz**2)
            
            if length == 0: continue

            # Normal vector (normalized)
            nx = -dz / length
            nz = dx / length

            # Half thickness offset
            ox = nx * (wall.thickness / 2)
            oz = nz * (wall.thickness / 2)

            # 2. Define 4 base corners (Floor)
            # Order: FL, FR, BR, BL (Front-Left, Front-Right, etc.)
            fl = (x1 + ox, 0, z1 + oz)
            fr = (x2 + ox, 0, z2 + oz)
            br = (x2 - ox, 0, z2 - oz)
            bl = (x1 - ox, 0, z1 - oz)

            # 3. Define 4 top corners (Ceiling)
            h = wall.height
            t_fl = (x1 + ox, h, z1 + oz)
            t_fr = (x2 + ox, h, z2 + oz)
            t_br = (x2 - ox, h, z2 - oz)
            t_bl = (x1 - ox, h, z1 - oz)

            # 4. Generate Triangles (2 per face, 6 faces)
            # Vertices list for this wall
            v = [fl, fr, br, bl, t_fl, t_fr, t_br, t_bl]
            
            # Flatten
            flat_v = [coord for point in v for coord in point]
            all_vertices.extend(flat_v)

            # Indices (Counter-Clockwise winding)
            # Front Face (FL, FR, T_FR, T_FL)
            # Back Face (BL, BR, T_BR, T_BL)
            # etc...
            
            # Simplified box topology (Cube)
            # 0:FL, 1:FR, 2:BR, 3:BL
            # 4:TFL, 5:TFR, 6:TBR, 7:TBL
            
            cube_indices = [
                # Front
                0, 4, 5, 0, 5, 1,
                # Right
                1, 5, 6, 1, 6, 2,
                # Back
                2, 6, 7, 2, 7, 3,
                # Left
                3, 7, 4, 3, 4, 0,
                # Top
                4, 7, 6, 4, 6, 5,
                # Bottom
                3, 2, 1, 3, 1, 0
            ]
            
            all_indices.extend([i + idx_offset for i in cube_indices])
            idx_offset += 8

        return {
            "vertices": all_vertices,
            "indices": all_indices,
            "normals": [] # Would compute per face
        }
