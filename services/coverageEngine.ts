
import { MapWall } from '../types';

interface OpticalParams {
    focalLength: number; // mm
    sensorWidth: number; // mm
}

interface Point { x: number; y: number }

export const coverageEngine = {
    /**
     * Calculates Horizontal FOV in degrees from physical camera parameters.
     * Formula: FOV = 2 * arctan(sensor_width / (2 * focal_length))
     */
    calculateOpticalFOV(params: OpticalParams): number {
        if (!params.focalLength || !params.sensorWidth) return 60; // Fallback
        const fovRad = 2 * Math.atan(params.sensorWidth / (2 * params.focalLength));
        return fovRad * (180 / Math.PI);
    },

    /**
     * Computes the visible polygon for a camera, CLIPPED by walls.
     * Uses raycasting algorithm to detect blind zones.
     */
    calculateVisibilityPolygon(
        origin: Point,
        rotation: number, // degrees (0-360)
        fov: number,      // degrees
        depth: number,    // max range in pixels
        walls: MapWall[]  // Obstacles
    ): Point[] {
        const poly: Point[] = [origin];
        
        // Convert to radians
        const rotationRad = (rotation * Math.PI) / 180;
        const halfFovRad = (fov * Math.PI) / 360;
        
        const startAngle = rotationRad - halfFovRad;
        const totalAngle = halfFovRad * 2;
        
        // Raycasting resolution (higher = smoother curved edges, but slower)
        const rayCount = 40; 
        const step = totalAngle / rayCount;

        for (let i = 0; i <= rayCount; i++) {
            const angle = startAngle + (i * step);
            
            // Define Ray
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            
            const rayEnd = {
                x: origin.x + dx * depth,
                y: origin.y + dy * depth
            };

            // Find closest intersection
            let closestPoint = rayEnd;
            let minDist = depth * depth; // Squared distance comparison is faster

            // Check against all walls
            for (const wall of walls) {
                const intersection = this.getIntersection(
                    origin, 
                    rayEnd, 
                    { x: wall.x1, y: wall.y1 }, 
                    { x: wall.x2, y: wall.y2 }
                );

                if (intersection) {
                    const distSq = (intersection.x - origin.x)**2 + (intersection.y - origin.y)**2;
                    if (distSq < minDist) {
                        minDist = distSq;
                        closestPoint = intersection;
                    }
                }
            }

            poly.push(closestPoint);
        }

        return poly;
    },

    /**
     * Standard Line Segment Intersection (Ray vs Wall Segment)
     */
    getIntersection(rayStart: Point, rayEnd: Point, wallStart: Point, wallEnd: Point): Point | null {
        const x1 = wallStart.x;
        const y1 = wallStart.y;
        const x2 = wallEnd.x;
        const y2 = wallEnd.y;

        const x3 = rayStart.x;
        const y3 = rayStart.y;
        const x4 = rayEnd.x;
        const y4 = rayEnd.y;

        const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (den === 0) return null; // Parallel

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1)
            };
        }
        return null;
    },

    /**
     * Legacy method for simple circular sectors (fallback)
     */
    calculateFovPolygon(x: number, y: number, rotation: number, fov: number, depth: number): { x: number; y: number }[] {
        // Fallback to non-clipped version if no walls provided
        // But better to redirect to the main logic with empty walls
        return this.calculateVisibilityPolygon({x,y}, rotation, fov, depth, []);
    }
};
