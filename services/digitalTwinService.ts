
import { Camera3D, Entity3D, Vector3, Zone3D, Wall3D, SecurityAlert } from '../types';
import { mockCameras, mockUsers } from './mockData';
import * as THREE from 'three';
import { mapService } from './mapService';

// --- CONSTANTS ---
const UPDATE_RATE_MS = 30; // ~30 FPS for smoother physics
const HISTORY_BUFFER_SIZE = 600;
const FLOOR_HEIGHT = 4;

// Identity Resolution Config
const IDENTITY_MERGE_DISTANCE = 3.0; // Meters
const IDENTITY_TIMEOUT = 5000; // MS to keep ID alive without detection

// --- STATIC BUILDING MODEL (Ground Truth) ---
const FACILITY_ZONES: Zone3D[] = [
    // -- FLOOR 1 --
    { 
        id: 'Z3D-SERVER', 
        name: 'Restricted Server Room', 
        type: 'RESTRICTED', 
        position: { x: -8, y: 1.5, z: -8 }, 
        dimensions: { x: 6, y: 3, z: 6 }, 
        color: '#f43f5e',
        floorId: 'FLOOR-01'
    },
    { 
        id: 'Z3D-LOBBY', 
        name: 'Main Lobby Area', 
        type: 'TRANSIT', 
        position: { x: 0, y: 1.5, z: 2 }, 
        dimensions: { x: 12, y: 3, z: 10 }, 
        color: '#3b82f6',
        floorId: 'FLOOR-01'
    },
    { 
        id: 'Z3D-RECEPTION', 
        name: 'Reception Desk', 
        type: 'SAFE', 
        position: { x: 4, y: 1, z: 6 }, 
        dimensions: { x: 3, y: 1.2, z: 1 }, 
        color: '#10b981',
        floorId: 'FLOOR-01'
    },
    // -- FLOOR 2 --
    { 
        id: 'Z3D-EXEC', 
        name: 'Executive Suite', 
        type: 'RESTRICTED', 
        position: { x: 5, y: 1.5 + FLOOR_HEIGHT, z: -5 }, 
        dimensions: { x: 8, y: 3, z: 8 }, 
        color: '#8b5cf6',
        floorId: 'FLOOR-02'
    },
    { 
        id: 'Z3D-OPEN-OFFICE', 
        name: 'Open Workspace', 
        type: 'TRANSIT', 
        position: { x: -5, y: 1.5 + FLOOR_HEIGHT, z: 5 }, 
        dimensions: { x: 8, y: 3, z: 8 }, 
        color: '#0ea5e9',
        floorId: 'FLOOR-02'
    }
];

const FACILITY_WALLS: Wall3D[] = [
    // Floor 1 Walls
    { id: 'W-N', position: {x: 0, y: 2, z: -10}, size: {x: 20, y: 4, z: 0.5} },
    { id: 'W-S', position: {x: 0, y: 2, z: 10}, size: {x: 20, y: 4, z: 0.5} },
    { id: 'W-W', position: {x: -10, y: 2, z: 0}, size: {x: 0.5, y: 4, z: 20} },
    { id: 'W-E', position: {x: 10, y: 2, z: 0}, size: {x: 0.5, y: 4, z: 20} },
    { id: 'W-SR-1', position: {x: -5, y: 2, z: -8}, size: {x: 0.2, y: 4, z: 4.5} },
    { id: 'W-SR-2', position: {x: -8, y: 2, z: -5}, size: {x: 4.5, y: 4, z: 0.2} },
    { id: 'W-DESK', position: {x: 4, y: 0.5, z: 6}, size: {x: 3, y: 1, z: 1}, opacity: 1.0, color: '#475569' },
    
    // Floor 2 Slab
    { id: 'W-SLAB-2', position: {x: 0, y: 4, z: 0}, size: {x: 20, y: 0.2, z: 20}, opacity: 0.9, color: '#1e293b' },

    // Floor 2 Walls (Transparent for visibility)
    { id: 'W-N-2', position: {x: 0, y: 2 + FLOOR_HEIGHT, z: -10}, size: {x: 20, y: 4, z: 0.5}, opacity: 0.3, color: '#94a3b8' },
    { id: 'W-S-2', position: {x: 0, y: 2 + FLOOR_HEIGHT, z: 10}, size: {x: 20, y: 4, z: 0.5}, opacity: 0.3, color: '#94a3b8' },
    { id: 'W-W-2', position: {x: -10, y: 2 + FLOOR_HEIGHT, z: 0}, size: {x: 0.5, y: 4, z: 20}, opacity: 0.3, color: '#94a3b8' },
    { id: 'W-E-2', position: {x: 10, y: 2 + FLOOR_HEIGHT, z: 0}, size: {x: 0.5, y: 4, z: 20}, opacity: 0.3, color: '#94a3b8' },
    { id: 'W-PART-2', position: {x: 0, y: 2 + FLOOR_HEIGHT, z: 0}, size: {x: 20, y: 4, z: 0.2}, opacity: 0.4, color: '#64748b' }
];

// --- CAMERA CALIBRATION ---
let CALIBRATED_CAMERAS: Camera3D[] = mockCameras.map((c, idx) => {
    if (idx === 0) { // Main Entrance
        return { ...c, position: { x: 0, y: 5, z: 9 }, rotation: { x: -0.6, y: 0, z: 0 }, fov: 60, aspectRatio: 1.77, depth: 15, coverageColor: '#06b6d4' };
    } else if (idx === 1) { // Parking (Moved to F2 for demo)
        return { ...c, position: { x: 9, y: 8, z: 9 }, rotation: { x: -0.5, y: 0.7, z: 0 }, fov: 60, aspectRatio: 1.77, depth: 15, coverageColor: '#8b5cf6' };
    } else if (idx === 2) { // Server Room
        return { ...c, position: { x: -9, y: 3.5, z: -9 }, rotation: { x: -0.6, y: -0.8, z: 0 }, fov: 70, aspectRatio: 1.77, depth: 8, coverageColor: '#f43f5e' };
    }
    return { ...c, position: { x: 0, y: 4, z: 0 }, rotation: { x: -1.5, y: 0, z: 0 }, fov: 60, aspectRatio: 1.77, depth: 10, coverageColor: '#94a3b8' };
});

// --- SIMULATION TYPES ---

interface WorldAgent {
    id: string; // Ground truth ID
    user: any;
    position: Vector3;
    velocity: Vector3; // Physics: Velocity Vector
    waypoints: Vector3[];
    currentWaypointIdx: number;
    maxSpeed: number;
    maxForce: number; // For smooth steering
    pauseTime: number;
    floorId: string;
}

interface CameraDetection {
    trackId: string; 
    personId: string;
    label: string;
    role: string;
    position: Vector3;
    cameraId: string;
    confidence: number;
}

// --- HISTORY BUFFER (DVR) ---
interface HistorySnapshot {
    timestamp: number;
    entities: Entity3D[];
    alerts: SecurityAlert[];
}

class DigitalTwinService {
    private entities: Entity3D[] = []; // These are now GLOBAL identities
    private alerts: SecurityAlert[] = [];
    private history: HistorySnapshot[] = [];
    
    private listeners: ((entities: Entity3D[], alerts: SecurityAlert[], isLive: boolean, timestamp: number) => void)[] = [];
    private configListeners: ((config: any) => void)[] = [];
    private intervalId: any = null;
    
    private mode: 'LIVE' | 'PLAYBACK' = 'LIVE';
    private entityZoneMap = new Map<string, string>(); 
    
    // --- 3D World Simulation State ---
    private worldAgents: WorldAgent[] = [];
    
    // --- Identity Resolution State ---
    private globalIdentities: Map<string, Entity3D> = new Map();

    constructor() {
        this.initWorldAgents();
        this.startLoop();
    }

    // --- Public API ---

    getSceneConfig() {
        const mapData = mapService.getMap();
        if (!mapData) {
            return {
                floorSize: { x: 30, z: 30 },
                zones: FACILITY_ZONES,
                walls: FACILITY_WALLS,
                cameras: CALIBRATED_CAMERAS,
            };
        }

        const scale = mapData.scale || 20;
        const wMeters = mapData.width / scale;
        const hMeters = mapData.height / scale;

        // Compile custom 3D walls
        const walls3D = (mapData.walls || []).map((w, index) => {
            const x1_3d = (w.x1 / scale) - (wMeters / 2);
            const z1_3d = (w.y1 / scale) - (hMeters / 2);
            const x2_3d = (w.x2 / scale) - (wMeters / 2);
            const z2_3d = (w.y2 / scale) - (hMeters / 2);

            const x_center = (x1_3d + x2_3d) / 2;
            const z_center = (z1_3d + z2_3d) / 2;
            const y_center = (w.height || 3.0) / 2;

            const dx = x2_3d - x1_3d;
            const dz = z2_3d - z1_3d;
            const length = Math.sqrt(dx * dx + dz * dz);
            const angle = Math.atan2(dz, dx);

            return {
                id: w.id || `wall-3d-${index}`,
                position: { x: x_center, y: y_center, z: z_center },
                size: { x: length, y: w.height || 3.0, z: 0.15 }, // standard wall thickness
                rotation: [0, -angle, 0] as [number, number, number],
                opacity: 0.8,
                color: '#1e293b'
            };
        });

        // Compile custom 3D zones
        const zones3D = (mapData.zones || []).map((z, index) => {
            if (!z.points || z.points.length === 0) return null;
            const minX = Math.min(...z.points.map(p => p.x));
            const maxX = Math.max(...z.points.map(p => p.y)); // Note: handle both x and y correctly
            const minY = Math.min(...z.points.map(p => p.y));
            const maxY = Math.max(...z.points.map(p => p.y));
            const minXPoints = Math.min(...z.points.map(p => p.x));
            const maxXPoints = Math.max(...z.points.map(p => p.x));

            const x_center_2d = (minXPoints + maxXPoints) / 2;
            const y_center_2d = (minY + maxY) / 2;

            const x_center_3d = (x_center_2d / scale) - (wMeters / 2);
            const z_center_3d = (y_center_2d / scale) - (hMeters / 2);
            const y_center_3d = 3.0 / 2;

            const dimX = (maxXPoints - minXPoints) / scale;
            const dimZ = (maxY - minY) / scale;

            return {
                id: z.id || `zone-3d-${index}`,
                name: z.name,
                type: (z.type || 'restricted').toUpperCase(),
                position: { x: x_center_3d, y: y_center_3d, z: z_center_3d },
                dimensions: { x: dimX, y: 3.0, z: dimZ },
                color: z.color || '#3b82f6',
                floorId: 'FLOOR-01'
            };
        }).filter(Boolean) as any[];

        // Compile custom 3D cameras
        const cameras3D = (mapData.cameras || []).map((cam, index) => {
            const x3d = (cam.x / scale) - (wMeters / 2);
            const y3d = cam.height || 2.8;
            const z3d = (cam.y / scale) - (hMeters / 2);

            const pitchRad = ((cam.pitch || -15) * Math.PI) / 180;
            const yawRad = -((cam.rotation || 0) * Math.PI) / 180;

            const baseCam = mockCameras.find(c => c.id === cam.cameraId) || mockCameras[0];

            return {
                ...baseCam,
                id: cam.cameraId,
                name: baseCam?.name || `Camera ${index + 1}`,
                position: { x: x3d, y: y3d, z: z3d },
                rotation: { x: pitchRad, y: yawRad, z: 0 },
                fov: 60,
                aspectRatio: 1.77,
                depth: 12,
                coverageColor: '#06b6d4'
            };
        });

        if (cameras3D.length > 0) {
            CALIBRATED_CAMERAS = cameras3D;
        }

        return {
            floorSize: { x: wMeters, z: hMeters },
            zones: zones3D.length > 0 ? zones3D : FACILITY_ZONES,
            walls: walls3D.length > 0 ? walls3D : FACILITY_WALLS,
            cameras: CALIBRATED_CAMERAS,
            imageUrl: mapData.imageUrl
        };
    }

    updateCamera(id: string, updates: Partial<Camera3D>) {
        CALIBRATED_CAMERAS = CALIBRATED_CAMERAS.map(cam => 
            cam.id === id ? { ...cam, ...updates } : cam
        );
        this.notifyConfig();
    }

    subscribe(callback: (entities: Entity3D[], alerts: SecurityAlert[], isLive: boolean, timestamp: number) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    subscribeToConfig(callback: (config: any) => void) {
        this.configListeners.push(callback);
        return () => {
            this.configListeners = this.configListeners.filter(cb => cb !== callback);
        };
    }

    getHistoryRange() {
        if (this.history.length === 0) return { start: Date.now(), end: Date.now() };
        return {
            start: this.history[0].timestamp,
            end: this.history[this.history.length - 1].timestamp
        };
    }

    seek(timestamp: number) {
        if (this.history.length === 0) return;
        this.mode = 'PLAYBACK';
        const snapshot = this.history.reduce((prev, curr) => 
            Math.abs(curr.timestamp - timestamp) < Math.abs(prev.timestamp - timestamp) ? curr : prev
        );
        this.listeners.forEach(cb => cb(snapshot.entities, snapshot.alerts, false, snapshot.timestamp));
    }

    pause() {
        this.mode = 'PLAYBACK';
        if (this.history.length > 0) {
            const last = this.history[this.history.length - 1];
            this.listeners.forEach(cb => cb(last.entities, last.alerts, false, last.timestamp));
        }
    }

    resumeLive() {
        this.mode = 'LIVE';
        this.notify();
    }

    // --- INTERNAL SIMULATION LOGIC ---

    private initWorldAgents() {
        // Agent 1: Sarah (Security) - Patrols Floor 1
        this.worldAgents.push({
            id: mockUsers[0].id,
            user: mockUsers[0],
            position: { x: 2, y: 0, z: 8 }, 
            velocity: { x: 0, y: 0, z: 0 },
            floorId: 'FLOOR-01',
            waypoints: [
                { x: 0, y: 0, z: 0 },
                { x: -5, y: 0, z: -5 },
                { x: -8, y: 0, z: -8 },
                { x: -5, y: 0, z: -5 },
                { x: 0, y: 0, z: 0 },
                { x: 2, y: 0, z: 8 }
            ],
            currentWaypointIdx: 0,
            maxSpeed: 2.0, // m/s
            maxForce: 0.1, // turn smoothing
            pauseTime: 0
        });

        // Agent 2: John (Intruder) - Loiters near Server Room
        this.worldAgents.push({
            id: mockUsers[1].id,
            user: mockUsers[1],
            position: { x: -6, y: 0, z: -6 },
            velocity: { x: 0, y: 0, z: 0 },
            floorId: 'FLOOR-01',
            waypoints: [
                { x: -7, y: 0, z: -5 },
                { x: -5, y: 0, z: -6 },
                { x: -6, y: 0, z: -7 }
            ],
            currentWaypointIdx: 0,
            maxSpeed: 1.2,
            maxForce: 0.05,
            pauseTime: 0
        });

        // Agent 3: Shaw (Ops) - Floor 2 Office
        this.worldAgents.push({
            id: mockUsers[3].id,
            user: mockUsers[3],
            position: { x: -2, y: 4, z: 2 },
            velocity: { x: 0, y: 0, z: 0 },
            floorId: 'FLOOR-02',
            waypoints: [
                { x: -5, y: 4, z: 5 },
                { x: 5, y: 4, z: -5 },
                { x: 0, y: 4, z: 0 }
            ],
            currentWaypointIdx: 0,
            maxSpeed: 1.5,
            maxForce: 0.08,
            pauseTime: 0
        });
    }

    private startLoop() {
        this.intervalId = setInterval(() => {
            // 1. Move Agents in 3D World (Physics)
            this.updateWorldAgents();
            
            // 2. Simulate Camera Detections
            const detections = this.simulateCameraDetections();
            
            // 3. Resolve Identities
            this.resolveIdentities(detections);
            
            // 4. Update Zone Logic
            this.updateSecurityLogic();
            
            // 5. History & UI
            this.recordHistory();
            if (this.mode === 'LIVE') {
                this.notify();
            }
        }, UPDATE_RATE_MS);
    }

    // --- PHYSICS ENGINE: STEERING BEHAVIORS ---
    private updateWorldAgents() {
        const dt = UPDATE_RATE_MS / 1000; // seconds
        const mapData = mapService.getMap();
        const scale = mapData ? (mapData.scale || 20) : 20;
        const wMeters = mapData ? (mapData.width / scale) : 30;
        const hMeters = mapData ? (mapData.height / scale) : 30;
        const halfW = (wMeters / 2) - 1.5;
        const halfH = (hMeters / 2) - 1.5;

        this.worldAgents.forEach(agent => {
            // Clamp current position within bounds first
            if (agent.position.x < -halfW) agent.position.x = -halfW;
            if (agent.position.x > halfW) agent.position.x = halfW;
            if (agent.position.z < -halfH) agent.position.z = -halfH;
            if (agent.position.z > halfH) agent.position.z = halfH;

            if (agent.pauseTime > 0) {
                agent.pauseTime -= UPDATE_RATE_MS;
                // Friction / Deceleration when paused
                agent.velocity.x *= 0.9;
                agent.velocity.z *= 0.9;
                
                agent.position.x += agent.velocity.x * dt;
                agent.position.z += agent.velocity.z * dt;
                return;
            }

            // Route waypoints clamping to map boundaries
            const origTarget = agent.waypoints[agent.currentWaypointIdx];
            const targetX = Math.max(-halfW, Math.min(halfW, origTarget.x));
            const targetZ = Math.max(-halfH, Math.min(halfH, origTarget.z));
            
            // Calculate distance to target
            const dx = targetX - agent.position.x;
            const dz = targetZ - agent.position.z;
            const dist = Math.sqrt(dx*dx + dz*dz);

            // Check arrival
            if (dist < 0.5) {
                agent.currentWaypointIdx = (agent.currentWaypointIdx + 1) % agent.waypoints.length;
                agent.pauseTime = Math.random() * 2000 + 1000; // Pause 1-3s
                return;
            }

            // SEEK Behavior
            // Desired velocity vector (normalized * maxSpeed)
            const desiredX = (dx / dist) * agent.maxSpeed;
            const desiredZ = (dz / dist) * agent.maxSpeed;

            // Steering force = Desired - Current Velocity
            let steerX = desiredX - agent.velocity.x;
            let steerZ = desiredZ - agent.velocity.z;

            // Limit steering force (Inertia/Smoothness)
            const steerMag = Math.sqrt(steerX*steerX + steerZ*steerZ);
            if (steerMag > agent.maxForce) {
                steerX = (steerX / steerMag) * agent.maxForce;
                steerZ = (steerZ / steerMag) * agent.maxForce;
            }

            // Apply steering to velocity
            agent.velocity.x += steerX;
            agent.velocity.z += steerZ;

            // Cap velocity at maxSpeed (safety check)
            const speed = Math.sqrt(agent.velocity.x**2 + agent.velocity.z**2);
            if (speed > agent.maxSpeed) {
                agent.velocity.x = (agent.velocity.x / speed) * agent.maxSpeed;
                agent.velocity.z = (agent.velocity.z / speed) * agent.maxSpeed;
            }

            // Update Position
            agent.position.x += agent.velocity.x * dt;
            agent.position.z += agent.velocity.z * dt;

            // Final safety clamp
            if (agent.position.x < -halfW) agent.position.x = -halfW;
            if (agent.position.x > halfW) agent.position.x = halfW;
            if (agent.position.z < -halfH) agent.position.z = -halfH;
            if (agent.position.z > halfH) agent.position.z = halfH;
        });
    }

    private simulateCameraDetections(): CameraDetection[] {
        const detections: CameraDetection[] = [];

        this.worldAgents.forEach(agent => {
            CALIBRATED_CAMERAS.forEach(cam => {
                // Simplified 3D Frustum Check
                // 1. Check Floor
                const floorDiff = Math.abs(cam.position.y - (agent.floorId === 'FLOOR-02' ? 4 : 0) - 2); 
                if (floorDiff > 4) return; // Wrong floor

                // 2. Check Distance
                const dx = agent.position.x - cam.position.x;
                const dz = agent.position.z - cam.position.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                
                if (dist < cam.depth) {
                    // 3. Check Angle (Dot Product)
                    const euler = new THREE.Euler(cam.rotation.x, cam.rotation.y, cam.rotation.z);
                    const camDir = new THREE.Vector3(0, 0, -1).applyEuler(euler).normalize();
                    const agentDir = new THREE.Vector3(dx, 0, dz).normalize();
                    
                    const angle = camDir.angleTo(agentDir);
                    const fovRad = (cam.fov * Math.PI) / 180;

                    if (angle < fovRad / 1.5) { 
                        detections.push({
                            trackId: `TRK-${cam.id}-${agent.id}`,
                            personId: agent.id, 
                            label: agent.user.fullName,
                            role: agent.user.role,
                            position: { ...agent.position },
                            cameraId: cam.id,
                            confidence: 0.95
                        });
                    }
                }
            });
        });

        return detections;
    }

    private resolveIdentities(detections: CameraDetection[]) {
        const NOW = Date.now();
        const activeGlobalIds = new Set<string>();

        // 1. Update existing identities
        detections.forEach(det => {
            let matchedGlobalId: string | null = null;

            // Attempt 1: True ID Match (Simulation shortcut)
            for (const [gid, identity] of this.globalIdentities) {
                if (identity.id.startsWith(det.personId)) {
                    matchedGlobalId = gid;
                    break; 
                }
            }

            // Attempt 2: Spatial Continuity (Kalman-ish)
            if (!matchedGlobalId) {
                let bestDist = IDENTITY_MERGE_DISTANCE;
                for (const [gid, identity] of this.globalIdentities) {
                    if (NOW - identity.lastUpdate > IDENTITY_TIMEOUT) continue;

                    const d = Math.sqrt(
                        Math.pow(det.position.x - identity.position.x, 2) + 
                        Math.pow(det.position.z - identity.position.z, 2)
                    );

                    if (d < bestDist) {
                        bestDist = d;
                        matchedGlobalId = gid;
                    }
                }
            }

            if (matchedGlobalId) {
                const identity = this.globalIdentities.get(matchedGlobalId)!;
                
                // Lerp Position for Smoothness
                identity.position.x = identity.position.x * 0.7 + det.position.x * 0.3;
                identity.position.z = identity.position.z * 0.7 + det.position.z * 0.3;
                identity.position.y = det.position.y;
                
                // Infer Velocity from position change
                const dt = (NOW - identity.lastUpdate) / 1000;
                if (dt > 0) {
                    identity.velocity = {
                        x: (det.position.x - identity.position.x) / dt,
                        y: 0,
                        z: (det.position.z - identity.position.z) / dt
                    };
                }

                identity.lastUpdate = NOW;
                identity.status = 'ACTIVE';
                
                identity.trajectory.push({ ...identity.position });
                if (identity.trajectory.length > 200) identity.trajectory.shift();

                activeGlobalIds.add(matchedGlobalId);

            } else {
                const newGid = `${det.personId}-GLOBAL-${NOW}`;
                this.globalIdentities.set(newGid, {
                    id: newGid,
                    type: 'PERSON',
                    label: det.label,
                    role: det.role,
                    status: 'ACTIVE',
                    position: { ...det.position },
                    velocity: { x: 0, y: 0, z: 0 },
                    lastUpdate: NOW,
                    firstSeen: NOW,
                    duration: 0,
                    trajectory: [{ ...det.position }],
                    trackedBy: det.cameraId
                });
                activeGlobalIds.add(newGid);
            }
        });

        // 2. Prune Stale
        for (const [gid, identity] of this.globalIdentities) {
            if (!activeGlobalIds.has(gid)) {
                if (NOW - identity.lastUpdate > IDENTITY_TIMEOUT) {
                    this.globalIdentities.delete(gid);
                } else {
                    identity.status = 'LOST';
                }
            }
        }

        this.entities = Array.from(this.globalIdentities.values());
    }

    private updateSecurityLogic() {
        const activeAlerts: SecurityAlert[] = [];
        
        this.entities.forEach(entity => {
            const currentZone = FACILITY_ZONES.find(zone => {
                const minX = zone.position.x - (zone.dimensions.x / 2);
                const maxX = zone.position.x + (zone.dimensions.x / 2);
                const minY = zone.position.y - (zone.dimensions.y / 2); 
                const maxY = zone.position.y + (zone.dimensions.y / 2);
                const minZ = zone.position.z - (zone.dimensions.z / 2);
                const maxZ = zone.position.z + (zone.dimensions.z / 2);
                
                return (
                    entity.position.x >= minX && entity.position.x <= maxX &&
                    entity.position.y >= minY && entity.position.y <= maxY &&
                    entity.position.z >= minZ && entity.position.z <= maxZ
                );
            });

            const lastZoneId = this.entityZoneMap.get(entity.id);
            const currentZoneId = currentZone ? currentZone.id : undefined;

            if (currentZoneId !== lastZoneId) {
                if (currentZoneId) {
                    this.entityZoneMap.set(entity.id, currentZoneId);
                    if (currentZone && currentZone.type === 'RESTRICTED' && entity.role !== 'ADMIN') {
                        activeAlerts.push({
                            id: `ALT-${entity.id}-${Date.now()}`,
                            severity: 'CRITICAL',
                            message: `Unauthorized Entry: ${entity.label} entered ${currentZone.name}`,
                            type: 'UNAUTHORIZED_ACCESS',
                            timestamp: Date.now(),
                            entityId: entity.id,
                            zoneId: currentZone.id
                        });
                    }
                } else {
                    this.entityZoneMap.delete(entity.id);
                }
            }

            entity.currentZoneId = currentZoneId;
            entity.isViolating = false;

            if (currentZone && currentZone.type === 'RESTRICTED' && entity.role !== 'ADMIN') {
                entity.isViolating = true;
                activeAlerts.push({
                    id: `ALT-PERSIST-${entity.id}`,
                    severity: 'CRITICAL',
                    message: `Security Violation: ${entity.label} inside ${currentZone.name}`,
                    type: 'UNAUTHORIZED_ACCESS',
                    timestamp: Date.now(),
                    entityId: entity.id,
                    zoneId: currentZone.id
                });
            }
        });

        this.alerts = activeAlerts;
    }

    private recordHistory() {
        const snapshot: HistorySnapshot = {
            timestamp: Date.now(),
            entities: JSON.parse(JSON.stringify(this.entities)),
            alerts: JSON.parse(JSON.stringify(this.alerts))
        };
        this.history.push(snapshot);
        if (this.history.length > HISTORY_BUFFER_SIZE) {
            this.history.shift();
        }
    }

    private notify() {
        const now = Date.now();
        this.listeners.forEach(cb => cb([...this.entities], [...this.alerts], true, now));
    }

    private notifyConfig() {
        const config = this.getSceneConfig();
        this.configListeners.forEach(cb => cb(config));
    }
}

export const digitalTwinService = new DigitalTwinService();
