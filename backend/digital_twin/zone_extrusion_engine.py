
import numpy as np
import logging
from typing import List, Dict, Any
from shapely.geometry import Polygon, MultiPolygon, box
from shapely.ops import unary_union, triangulate
from .models import ZoneDefinition, WallSegment

logger = logging.getLogger("ZoneExtrusionEngine")

class ZoneExtrusionEngine:
    """
    Converts 2D Zone Definitions into 3D Volumetric Meshes.
    Performs CSG (Constructive Solid Geometry) to clip zones against physical walls.
    """

    @staticmethod
    def extrude_zones(zones: List[ZoneDefinition], walls: List[WallSegment]) -> Dict[str, Dict[str, Any]]:
        """
        Generates 3D mesh data for zones, subtracting wall footprints.
        Returns: { zone_id: { vertices: [], indices: [], normals: [] } }
        """
        
        # 1. Build Wall Exclusion Mask (Union of all wall footprints)
        wall_polys = []
        for wall in walls:
            # Create a thickened line polygon for the wall
            p1 = np.array(wall.p1)
            p2 = np.array(wall.p2)
            
            # Vector math for thickness
            direction = p2 - p1
            length = np.linalg.norm(direction)
            if length < 0.01: continue
            
            unit_dir = direction / length
            # Perpendicular vector (rotate 90 deg)
            normal = np.array([-unit_dir[1], unit_dir[0]])
            
            half_thick = wall.thickness / 2.0
            
            # 4 Corners
            c1 = p1 + normal * half_thick
            c2 = p2 + normal * half_thick
            c3 = p2 - normal * half_thick
            c4 = p1 - normal * half_thick
            
            wall_polys.append(Polygon([c1, c2, c3, c4]))

        walls_mask = unary_union(wall_polys) if wall_polys else Polygon()

        results = {}

        for zone in zones:
            try:
                # 2. Create base zone polygon
                if len(zone.points) < 3:
                    continue
                
                base_poly = Polygon(zone.points)
                if not base_poly.is_valid:
                    base_poly = base_poly.buffer(0) # Fix self-intersections

                # 3. Clip against walls (Boolean Difference)
                # Zone Volume = Zone Area - Wall Area
                clipped_shape = base_poly.difference(walls_mask)

                if clipped_shape.is_empty:
                    continue

                # 4. Generate Mesh
                mesh = ZoneExtrusionEngine._generate_mesh_from_shape(
                    clipped_shape, 
                    zone.height, 
                    zone.height_offset
                )
                
                results[zone.id] = mesh

            except Exception as e:
                logger.error(f"Failed to extrude zone {zone.id}: {e}")
                results[zone.id] = {"vertices": [], "indices": []}

        return results

    @staticmethod
    def _generate_mesh_from_shape(shape, height: float, y_offset: float) -> Dict[str, list]:
        """
        Converts a Shapely geometry (Polygon or MultiPolygon) into 3D vertices/indices.
        """
        if isinstance(shape, MultiPolygon):
            polys = list(shape.geoms)
        else:
            polys = [shape]

        vertices = []
        indices = []
        current_idx = 0

        for poly in polys:
            # A. Triangulate Top and Bottom Caps
            # Shapely's Delaunay triangulation
            # We filter triangles to ensure they are inside the polygon (handles holes)
            raw_triangles = triangulate(poly)
            valid_triangles = [t for t in raw_triangles if poly.contains(t.centroid)]

            for tri in valid_triangles:
                # Triangle coords (x, z)
                xx, zz = tri.exterior.coords.xy
                # Only take first 3 points (shapely closes the ring with 4th point)
                p0, p1, p2 = zip(xx[:3], zz[:3])

                # --- Bottom Cap (y = y_offset) ---
                # Winding order: 0, 2, 1 for bottom (facing down)
                b_v0 = [p0[0], y_offset, p0[1]]
                b_v1 = [p1[0], y_offset, p1[1]]
                b_v2 = [p2[0], y_offset, p2[1]]
                
                vertices.extend(b_v0 + b_v2 + b_v1)
                indices.extend([current_idx, current_idx+1, current_idx+2])
                current_idx += 3

                # --- Top Cap (y = y_offset + height) ---
                # Winding order: 0, 1, 2 for top (facing up)
                t_v0 = [p0[0], y_offset + height, p0[1]]
                t_v1 = [p1[0], y_offset + height, p1[1]]
                t_v2 = [p2[0], y_offset + height, p2[1]]

                vertices.extend(t_v0 + t_v1 + t_v2)
                indices.extend([current_idx, current_idx+1, current_idx+2])
                current_idx += 3

            # B. Generate Side Walls (Extrude Edges)
            # Both exterior and interior rings (holes)
            boundaries = [poly.exterior] + list(poly.interiors)
            
            for ring in boundaries:
                coords = list(ring.coords)
                for i in range(len(coords) - 1):
                    c_curr = coords[i]
                    c_next = coords[i+1]

                    # Define 4 corners of the quad
                    # BL (Bottom Left), BR (Bottom Right), TR (Top Right), TL (Top Left)
                    bl = [c_curr[0], y_offset, c_curr[1]]
                    br = [c_next[0], y_offset, c_next[1]]
                    tr = [c_next[0], y_offset + height, c_next[1]]
                    tl = [c_curr[0], y_offset + height, c_curr[1]]

                    # Two triangles for the quad
                    # Triangle 1: BL, TR, TL
                    # Triangle 2: BL, BR, TR
                    
                    vertices.extend(bl + tr + tl)
                    indices.extend([current_idx, current_idx+1, current_idx+2])
                    current_idx += 3
                    
                    vertices.extend(bl + br + tr)
                    indices.extend([current_idx, current_idx+1, current_idx+2])
                    current_idx += 3

        return {
            "vertices": vertices,
            "indices": indices
        }
