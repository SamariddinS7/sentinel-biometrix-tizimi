
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Grid, GizmoHelper, GizmoViewport, TransformControls, Line, Box } from '@react-three/drei';
import * as THREE from 'three';
import { digitalTwinService } from '../services/digitalTwinService';
import { Entity3D, Zone3D, Camera3D, Wall3D, Vector3, SecurityAlert } from '../types';
import { Layers, Radio, Info, Settings, Eye, Ruler, Activity, Play, Pause, SkipBack, Clock, AlertOctagon, ShieldAlert, RefreshCw, Building, Server, Monitor, Hexagon } from 'lucide-react';
import { format } from 'date-fns';
import { PersonInfoModal, PersonDetails } from './PersonInfoModal';
import { AlertBanner } from './AlertBanner';
import { useTheme } from '../theme/ThemeProvider';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// ... (Keep existing Helper Functions intersectRayBox, intersectPlaneY, computeFrustumGeometry unchanged)
// [Re-insert previous helper functions here if this was a full file replace, but for diff efficiency I assume standard update pattern. 
// However, since I must provide full content for file, I will include the helper functions again.]

const getFloorId = (y: number) => y >= 3.5 ? 'FLOOR-02' : 'FLOOR-01';

const getFloorYRange = (y: number) => {
    if (y >= 3.5) return { min: 4, max: 8 }; // Floor 2
    return { min: 0, max: 4 }; // Floor 1
};

const intersectRayBox = (origin: THREE.Vector3, dir: THREE.Vector3, boxMin: THREE.Vector3, boxMax: THREE.Vector3) => {
    let tmin = (boxMin.x - origin.x) / dir.x;
    let tmax = (boxMax.x - origin.x) / dir.x;

    if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

    let tymin = (boxMin.y - origin.y) / dir.y;
    let tymax = (boxMax.y - origin.y) / dir.y;

    if (tymin > tymax) [tymin, tymax] = [tymax, tymin];

    if ((tmin > tymax) || (tymin > tmax)) return Infinity;

    if (tymin > tmin) tmin = tymin;
    if (tymax < tmax) tmax = tymax;

    let tzmin = (boxMin.z - origin.z) / dir.z;
    let tzmax = (boxMax.z - origin.z) / dir.z;

    if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];

    if ((tmin > tzmax) || (tzmin > tmax)) return Infinity;

    if (tzmin > tmin) tmin = tzmin;
    if (tzmax < tmax) tmax = tzmax;

    if (tmax < 0) return Infinity;
    return tmin > 0 ? tmin : Infinity;
};

const intersectPlaneY = (origin: THREE.Vector3, dir: THREE.Vector3, y: number) => {
    if (Math.abs(dir.y) < 1e-6) return Infinity;
    const t = (y - origin.y) / dir.y;
    return t > 0 ? t : Infinity;
};

const computeFrustumGeometry = (cam: Camera3D, walls: Wall3D[]) => {
    const floorRange = getFloorYRange(cam.position.y);
    const origin = new THREE.Vector3(cam.position.x, cam.position.y, cam.position.z);
    
    const euler = new THREE.Euler(cam.rotation.x, cam.rotation.y, cam.rotation.z, 'XYZ');
    const rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(euler);

    const relevantWalls = walls.filter(w => {
        const wy = w.position.y;
        return (wy + w.size.y/2) > floorRange.min && (wy - w.size.y/2) < floorRange.max;
    });

    const segmentsW = 20; 
    const segmentsH = 10;
    const hFovRad = THREE.MathUtils.degToRad(cam.fov);
    const vFovRad = hFovRad / cam.aspectRatio; 

    const vertices: number[] = [];
    const indices: number[] = [];
    
    vertices.push(0, 0, 0); 

    const depth = cam.depth;

    for (let j = 0; j <= segmentsH; j++) {
        const vRatio = j / segmentsH;
        const yAngle = (vRatio - 0.5) * vFovRad; 
        
        for (let i = 0; i <= segmentsW; i++) {
            const uRatio = i / segmentsW;
            const xAngle = (uRatio - 0.5) * hFovRad; 

            const localDir = new THREE.Vector3(Math.tan(xAngle), Math.tan(-yAngle), 1).normalize();
            const worldDir = localDir.clone().applyMatrix4(rotationMatrix).normalize();

            let minDist = depth;
            const dFloor = intersectPlaneY(origin, worldDir, floorRange.min);
            const dCeil = intersectPlaneY(origin, worldDir, floorRange.max);
            
            if (dFloor < minDist) minDist = dFloor;
            if (dCeil < minDist) minDist = dCeil;

            for (const wall of relevantWalls) {
                const halfSize = new THREE.Vector3(wall.size.x / 2, wall.size.y / 2, wall.size.z / 2);
                const wPos = new THREE.Vector3(wall.position.x, wall.position.y, wall.position.z);
                const boxMin = wPos.clone().sub(halfSize);
                const boxMax = wPos.clone().add(halfSize);
                
                const dWall = intersectRayBox(origin, worldDir, boxMin, boxMax);
                if (dWall < minDist) minDist = dWall;
            }

            const localHit = localDir.clone().multiplyScalar(minDist);
            vertices.push(localHit.x, localHit.y, localHit.z);
        }
    }

    const stride = segmentsW + 1;
    for (let j = 0; j < segmentsH; j++) {
        for (let i = 0; i < segmentsW; i++) {
            const a = 1 + j * stride + i;
            const b = 1 + j * stride + (i + 1);
            const c = 1 + (j + 1) * stride + i;
            const d = 1 + (j + 1) * stride + (i + 1);
            indices.push(a, c, b);
            indices.push(b, c, d);
        }
    }
    
    // Stitch edges
    for (let i = 0; i < segmentsW; i++) {
        const a = 1 + i;
        const b = 1 + (i + 1);
        indices.push(0, b, a); 
    }
    const lastRowStart = 1 + segmentsH * stride;
    for (let i = 0; i < segmentsW; i++) {
        const a = lastRowStart + i;
        const b = lastRowStart + (i + 1);
        indices.push(0, a, b);
    }
    for (let j = 0; j < segmentsH; j++) {
        const a = 1 + j * stride;
        const b = 1 + (j + 1) * stride;
        indices.push(0, a, b);
    }
    for (let j = 0; j < segmentsH; j++) {
        const a = 1 + j * stride + segmentsW;
        const b = 1 + (j + 1) * stride + segmentsW;
        indices.push(0, b, a);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
};

// --- Updated 3D Assets (Theme Aware) ---

const ServerRack: React.FC<{ position: [number, number, number], rotation: [number, number, number], color: string }> = ({ position, rotation, color }) => (
  <group position={position} rotation={rotation}>
    <mesh position={[0, 1, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.8, 2, 0.8]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
    </mesh>
    <mesh position={[0, 1.8, 0.41]}>
       <planeGeometry args={[0.6, 0.1]} />
       <meshBasicMaterial color="#22c55e" />
    </mesh>
    <mesh position={[0, 1.6, 0.41]}>
       <planeGeometry args={[0.6, 0.05]} />
       <meshBasicMaterial color="#3b82f6" />
    </mesh>
  </group>
);

const OfficeDesk: React.FC<{ position: [number, number, number], rotation: [number, number, number], color: string }> = ({ position, rotation, color }) => (
  <group position={position} rotation={rotation}>
    <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.6, 0.05, 0.8]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
    {/* Legs */}
    <mesh position={[-0.7, 0.35, -0.35]}> <boxGeometry args={[0.05, 0.7, 0.05]} /> <meshStandardMaterial color="#64748b" /> </mesh>
    <mesh position={[0.7, 0.35, -0.35]}> <boxGeometry args={[0.05, 0.7, 0.05]} /> <meshStandardMaterial color="#64748b" /> </mesh>
    <mesh position={[-0.7, 0.35, 0.35]}> <boxGeometry args={[0.05, 0.7, 0.05]} /> <meshStandardMaterial color="#64748b" /> </mesh>
    <mesh position={[0.7, 0.35, 0.35]}> <boxGeometry args={[0.05, 0.7, 0.05]} /> <meshStandardMaterial color="#64748b" /> </mesh>
  </group>
);

const ReceptionDesk: React.FC<{ position: [number, number, number], color: string }> = ({ position, color }) => (
    <group position={position}>
        <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[3, 1.1, 1]} />
            <meshStandardMaterial color={color} />
        </mesh>
    </group>
);

const PineTree3D: React.FC<{ position: [number, number, number] }> = ({ position }) => (
    <group position={position}>
        {/* Trunk */}
        <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.12, 0.8, 8]} />
            <meshStandardMaterial color="#78350f" roughness={0.9} />
        </mesh>
        {/* Leaves - Cone 1 */}
        <mesh position={[0, 1.0, 0]} castShadow>
            <coneGeometry args={[0.6, 1.0, 8]} />
            <meshStandardMaterial color="#14532d" roughness={0.7} />
        </mesh>
        {/* Leaves - Cone 2 */}
        <mesh position={[0, 1.6, 0]} castShadow>
            <coneGeometry args={[0.4, 0.8, 8]} />
            <meshStandardMaterial color="#166534" roughness={0.7} />
        </mesh>
    </group>
);

const AutumnTree3D: React.FC<{ position: [number, number, number] }> = ({ position }) => (
    <group position={position}>
        {/* Trunk */}
        <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.15, 1.0, 8]} />
            <meshStandardMaterial color="#543310" roughness={0.9} />
        </mesh>
        {/* Canopy - Sphere 1 */}
        <mesh position={[0, 1.4, 0]} castShadow>
            <sphereGeometry args={[0.7, 8, 8]} />
            <meshStandardMaterial color="#ea580c" roughness={0.8} />
        </mesh>
        {/* Canopy - Sphere 2 */}
        <mesh position={[0.2, 1.6, 0.2]} castShadow>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshStandardMaterial color="#f97316" roughness={0.8} />
        </mesh>
    </group>
);

const Car3D: React.FC<{ position: [number, number, number], rotation: [number, number, number] }> = ({ position, rotation }) => (
    <group position={position} rotation={rotation}>
        {/* Chassis / Body */}
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.4, 3.2]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Cabin */}
        <mesh position={[0, 0.65, -0.2]} castShadow>
            <boxGeometry args={[1.3, 0.45, 1.6]} />
            <meshStandardMaterial color="#ffffff" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Windshield / Windows */}
        <mesh position={[0, 0.65, 0.65]}>
            <boxGeometry args={[1.2, 0.35, 0.1]} />
            <meshStandardMaterial color="#0f172a" transparent opacity={0.6} />
        </mesh>
        {/* Wheels */}
        <mesh position={[-0.8, 0.15, 1.0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.2, 12]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
        <mesh position={[0.8, 0.15, 1.0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.2, 12]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
        <mesh position={[-0.8, 0.15, -1.0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.2, 12]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
        <mesh position={[0.8, 0.15, -1.0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.2, 12]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
    </group>
);

const Bed3D: React.FC<{ position: [number, number, number], rotation: [number, number, number] }> = ({ position, rotation }) => (
    <group position={position} rotation={rotation}>
        {/* Bed frame */}
        <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 0.3, 2.0]} />
            <meshStandardMaterial color="#78350f" roughness={0.8} />
        </mesh>
        {/* Mattress */}
        <mesh position={[0, 0.35, 0.05]} castShadow>
            <boxGeometry args={[1.5, 0.2, 1.9]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.9} />
        </mesh>
        {/* Blanket */}
        <mesh position={[0, 0.37, -0.2]} castShadow>
            <boxGeometry args={[1.51, 0.21, 1.4]} />
            <meshStandardMaterial color="#0284c7" roughness={0.8} />
        </mesh>
        {/* Pillows */}
        <mesh position={[-0.4, 0.48, 0.7]} castShadow>
            <boxGeometry args={[0.5, 0.1, 0.35]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.9} />
        </mesh>
        <mesh position={[0.4, 0.48, 0.7]} castShadow>
            <boxGeometry args={[0.5, 0.1, 0.35]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.9} />
        </mesh>
    </group>
);

const Sofa3D: React.FC<{ position: [number, number, number], rotation: [number, number, number] }> = ({ position, rotation }) => (
    <group position={position} rotation={rotation}>
        {/* Base */}
        <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.4, 0.3, 0.9]} />
            <meshStandardMaterial color="#475569" roughness={0.8} />
        </mesh>
        {/* Backrest */}
        <mesh position={[0, 0.55, -0.35]} castShadow>
            <boxGeometry args={[2.4, 0.5, 0.2]} />
            <meshStandardMaterial color="#475569" roughness={0.8} />
        </mesh>
        {/* Armrest Left */}
        <mesh position={[-1.1, 0.4, 0]} castShadow>
            <boxGeometry args={[0.2, 0.4, 0.9]} />
            <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
        {/* Armrest Right */}
        <mesh position={[1.1, 0.4, 0]} castShadow>
            <boxGeometry args={[0.2, 0.4, 0.9]} />
            <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
    </group>
);

const ZoneVolume: React.FC<{ zone: Zone3D, hasAlert: boolean, visible: boolean }> = ({ zone, hasAlert, visible }) => {
    if (!visible) return null;
    return (
        <group position={[zone.position.x, zone.position.y, zone.position.z]}>
            <mesh>
                <boxGeometry args={[zone.dimensions.x, zone.dimensions.y, zone.dimensions.z]} />
                <meshStandardMaterial 
                    color={hasAlert ? '#ef4444' : zone.color} 
                    transparent 
                    opacity={hasAlert ? 0.4 : 0.15} 
                    depthWrite={false}
                />
            </mesh>
            <Html position={[0, zone.dimensions.y/2, 0]} center distanceFactor={15}>
                <div className={`text-[8px] font-bold px-1 rounded backdrop-blur-sm ${hasAlert ? 'bg-red-600 text-white animate-pulse' : 'bg-black/50 text-white'}`}>
                    {zone.name}
                </div>
            </Html>
        </group>
    );
};

const SecurityCamera: React.FC<{ 
    cam: Camera3D, 
    walls: Wall3D[], 
    isSelected: boolean, 
    onSelect: () => void, 
    onChange: (cam: Camera3D) => void,
    visible: boolean,
    color: string
}> = ({ cam, walls, isSelected, onSelect, visible, color }) => {
    const frustumGeo = useMemo(() => computeFrustumGeometry(cam, walls), [cam, walls]);
    
    if (!visible) return null;

    return (
        <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
            <mesh position={[cam.position.x, cam.position.y, cam.position.z]} rotation={[cam.rotation.x, cam.rotation.y, cam.rotation.z]}>
                <boxGeometry args={[0.4, 0.3, 0.5]} />
                <meshStandardMaterial color={isSelected ? "#fbbf24" : color} />
            </mesh>
            
            <mesh geometry={frustumGeo} position={[cam.position.x, cam.position.y, cam.position.z]} rotation={[cam.rotation.x, cam.rotation.y, cam.rotation.z]}>
                <meshBasicMaterial 
                    color={cam.coverageColor} 
                    transparent 
                    opacity={isSelected ? 0.3 : 0.1} 
                    side={THREE.DoubleSide} 
                    depthWrite={false}
                />
            </mesh>
            {isSelected && (
                 <lineSegments geometry={new THREE.EdgesGeometry(frustumGeo)} position={[cam.position.x, cam.position.y, cam.position.z]} rotation={[cam.rotation.x, cam.rotation.y, cam.rotation.z]}>
                    <lineBasicMaterial color="#fbbf24" transparent opacity={0.5} />
                </lineSegments>
            )}
        </group>
    );
};

const PersonEntity: React.FC<{ 
    entity: Entity3D, 
    showHistory: boolean, 
    onSelect: (e: Entity3D) => void,
    visible: boolean 
}> = ({ entity, showHistory, onSelect, visible }) => {
    if (!visible) return null;
    
    return (
        <group position={[entity.position.x, entity.position.y, entity.position.z]} onClick={(e) => { e.stopPropagation(); onSelect(entity); }}>
            <mesh position={[0, 0.9, 0]}>
                <capsuleGeometry args={[0.3, 1.0, 4, 8]} />
                <meshStandardMaterial color={entity.isViolating ? "#ef4444" : "#10b981"} />
            </mesh>
            <Html position={[0, 2.2, 0]} center>
                <div className="flex flex-col items-center">
                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap shadow-sm ${entity.isViolating ? 'bg-red-600' : 'bg-emerald-600'}`}>
                        {entity.label}
                    </div>
                </div>
            </Html>
            {showHistory && entity.trajectory && (() => {
                const validPoints = entity.trajectory
                    .map(p => {
                        const px = typeof p.x === 'number' ? p.x : 0;
                        const py = typeof p.y === 'number' ? p.y : 0;
                        const pz = typeof p.z === 'number' ? p.z : 0;
                        return [px, py + 0.1, pz];
                    })
                    .filter(pt => pt && !isNaN(pt[0]) && !isNaN(pt[1]) && !isNaN(pt[2]));
                if (validPoints.length < 2) return null;
                return (
                    <Line 
                        points={validPoints as any}
                        color={entity.isViolating ? "red" : "emerald"}
                        lineWidth={1}
                        dashed
                        opacity={0.5}
                    />
                );
            })()}
        </group>
    );
};

const FacilityLevel: React.FC<{ 
    levelId: string, 
    yOffset: number, 
    walls: Wall3D[], 
    zones: Zone3D[], 
    activeAlerts: Set<string>,
    visibility: 'VISIBLE' | 'GHOST' | 'HIDDEN',
    onSelect: () => void,
    floorSize?: { x: number, z: number },
    imageUrl?: string
}> = ({ levelId, yOffset, walls, zones, activeAlerts, visibility, onSelect, floorSize, imageUrl }) => {
    if (visibility === 'HIDDEN') return null;
    
    // Access theme context for dynamic material colors
    const { colors, mode } = useTheme();
    
    const isGhost = visibility === 'GHOST';
    const opacityMult = isGhost ? 0.2 : 1.0;

    const sizeX = floorSize ? floorSize.x : 30;
    const sizeZ = floorSize ? floorSize.z : 30;

    const [texture, setTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
        if (!imageUrl || levelId !== 'FLOOR-01') {
            setTexture(null);
            return;
        }
        const loader = new THREE.TextureLoader();
        loader.load(
            imageUrl,
            (loadedTexture) => {
                loadedTexture.colorSpace = THREE.SRGBColorSpace;
                loadedTexture.minFilter = THREE.LinearFilter;
                loadedTexture.magFilter = THREE.LinearFilter;
                setTexture(loadedTexture);
            },
            undefined,
            (err) => {
                console.error("Failed to load 3D floor blueprint texture:", err);
            }
        );
    }, [imageUrl, levelId]);

    const levelWalls = walls.filter(w => {
        const wy = w.position.y;
        return (wy >= yOffset) && (wy < yOffset + 4);
    });
    const levelZones = zones.filter(z => z.floorId === levelId);

    // Dynamic props depending on theme (Light mode furniture needs to be visible)
    const furnitureColor = mode === 'dark' ? '#1e293b' : '#94a3b8';
    const wallColorDefault = mode === 'dark' ? '#1e293b' : '#cbd5e1';
    const floorColor = mode === 'dark' ? (isGhost ? "#1e293b" : "#0f172a") : (isGhost ? "#e2e8f0" : "#f1f5f9");

    const props = useMemo(() => {
        const items: React.ReactNode[] = [];
        levelZones.forEach(zone => {
            const zName = zone.name.toLowerCase();
            if (zName.includes('yashil maydon') || zName.includes('garden') || zName.includes('lawn')) {
                // Courtyard garden lawn assets
                if (zone.id === 'Z-LAWN1') {
                    // Central orange autumn tree (Uzbek hovli landscape signature!)
                    items.push(<AutumnTree3D key="autumn-tree" position={[zone.position.x, yOffset, zone.position.z]} />);
                    // Surrounding beautiful evergreen pine trees
                    items.push(<PineTree3D key="pine-1" position={[zone.position.x - 2.5, yOffset, zone.position.z - 1.5]} />);
                    items.push(<PineTree3D key="pine-2" position={[zone.position.x + 2.5, yOffset, zone.position.z + 1.5]} />);
                    items.push(<PineTree3D key="pine-3" position={[zone.position.x - 1.2, yOffset, zone.position.z + 2.0]} />);
                } else {
                    // Lower garden
                    items.push(<PineTree3D key="pine-lower-1" position={[zone.position.x, yOffset, zone.position.z]} />);
                    items.push(<PineTree3D key="pine-lower-2" position={[zone.position.x - 1.0, yOffset, zone.position.z - 1.5]} />);
                    items.push(<PineTree3D key="pine-lower-3" position={[zone.position.x + 1.0, yOffset, zone.position.z + 1.5]} />);
                }
            }
            else if (zName.includes('avtoturargoh') || zName.includes('garage')) {
                // Parking/Garage - Place a beautiful sedan car facing the street gate
                items.push(<Car3D key="garage-car" position={[zone.position.x, yOffset, zone.position.z]} rotation={[0, Math.PI / 2, 0]} />);
            }
            else if (zName.includes('mehmonxona') || zName.includes('living room') || zName.includes('salon')) {
                // Living Room / Guest Salon - place a nice luxury sofa and a coffee table
                items.push(<Sofa3D key="salon-sofa" position={[zone.position.x, yOffset, zone.position.z - 0.8]} rotation={[0, 0, 0]} />);
                items.push(<OfficeDesk key="salon-table" position={[zone.position.x, yOffset, zone.position.z + 1.0]} rotation={[0, 0, 0]} color={furnitureColor} />);
            }
            else if (zName.includes('yotoqxona') || zName.includes('bolalar') || zName.includes('bedroom') || zName.includes('room')) {
                // Bedrooms - place comfortable master beds
                if (zone.id === 'Z-R4') {
                    // Children room - two separate single beds
                    items.push(<Bed3D key="child-bed-1" position={[zone.position.x - 0.8, yOffset, zone.position.z]} rotation={[0, 0, 0]} />);
                    items.push(<Bed3D key="child-bed-2" position={[zone.position.x + 0.8, yOffset, zone.position.z]} rotation={[0, 0, 0]} />);
                } else {
                    // Double master bed
                    items.push(<Bed3D key={`bed-${zone.id}`} position={[zone.position.x, yOffset, zone.position.z]} rotation={[0, 0, 0]} />);
                }
            }
            else if (zName.includes('oshxona') || zName.includes('kitchen')) {
                // Kitchen - place a kitchen counter (reception style) and small breakfast table
                items.push(<ReceptionDesk key="kitchen-counter" position={[zone.position.x - 1.0, yOffset, zone.position.z]} color={furnitureColor} />);
                items.push(<OfficeDesk key="kitchen-table" position={[zone.position.x + 1.2, yOffset, zone.position.z]} rotation={[0, 0, 0]} color={furnitureColor} />);
            }
            else if (zName.includes('yuvinish') || zName.includes('bathroom')) {
                // Bathroom - place a small cabinet
                items.push(<ReceptionDesk key="bath-cabinet" position={[zone.position.x, yOffset, zone.position.z]} color={furnitureColor} />);
            }
            else if (zone.name.includes('Server')) {
                const startX = zone.position.x - zone.dimensions.x/2 + 1;
                const startZ = zone.position.z - zone.dimensions.z/2 + 1;
                for(let x=0; x < zone.dimensions.x - 1; x+=1.5) {
                    for(let z=0; z < zone.dimensions.z - 1; z+=2) {
                        items.push(<ServerRack key={`rack-${x}-${z}`} position={[startX + x, yOffset, startZ + z]} rotation={[0, 0, 0]} color={furnitureColor} />);
                    }
                }
            }
            else if (zone.name.includes('Open Workspace') || zone.name.includes('Office')) {
                const startX = zone.position.x - zone.dimensions.x/2 + 2;
                const startZ = zone.position.z - zone.dimensions.z/2 + 2;
                for(let x=0; x < zone.dimensions.x - 2; x+=3) {
                    for(let z=0; z < zone.dimensions.z - 2; z+=2.5) {
                        items.push(<OfficeDesk key={`desk-${x}-${z}`} position={[startX + x, yOffset, startZ + z]} rotation={[0, 0, 0]} color={furnitureColor} />);
                    }
                }
            }
            else if (zone.name.includes('Reception')) {
                items.push(<ReceptionDesk key="rec-desk" position={[zone.position.x, yOffset, zone.position.z]} color={furnitureColor} />);
            }
        });
        return items;
    }, [levelZones, yOffset, furnitureColor]);

    return (
        <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
            <mesh position={[0, yOffset - 0.1, 0]} receiveShadow>
                <boxGeometry args={[sizeX, 0.2, sizeZ]} />
                <meshStandardMaterial 
                    color={floorColor} 
                    transparent={isGhost} 
                    opacity={isGhost ? 0.3 : 1}
                    roughness={0.8}
                />
            </mesh>

            {/* Blueprint Overlay Plane */}
            {texture && !isGhost && levelId === 'FLOOR-01' && (
                <mesh position={[0, yOffset + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                    <planeGeometry args={[sizeX, sizeZ]} />
                    <meshBasicMaterial 
                        map={texture} 
                        transparent={true} 
                        opacity={0.85}
                    />
                </mesh>
            )}
            
            {!isGhost && <Grid position={[0, yOffset + 0.01, 0]} args={[sizeX, sizeZ]} cellColor={colors.sceneGrid} sectionColor={mode === 'dark' ? '#475569' : '#94a3b8'} sectionSize={5} cellSize={1} fadeDistance={40} />}

            {levelWalls.map(wall => (
                <mesh 
                    key={wall.id}
                    position={[wall.position.x, wall.position.y, wall.position.z]} 
                    rotation={(wall as any).rotation || [0, 0, 0]}
                    castShadow 
                    receiveShadow
                >
                    <boxGeometry args={[wall.size.x, wall.size.y, wall.size.z]} />
                    <meshStandardMaterial 
                        color={wall.color || wallColorDefault} 
                        transparent={true} 
                        opacity={(wall.opacity ?? 0.8) * opacityMult} 
                        roughness={0.5} 
                    />
                    {!isGhost && (
                        <lineSegments>
                            <edgesGeometry args={[new THREE.BoxGeometry(wall.size.x, wall.size.y, wall.size.z)]} />
                            <lineBasicMaterial color={mode === 'dark' ? "#334155" : "#cbd5e1"} transparent opacity={0.3} />
                        </lineSegments>
                    )}
                </mesh>
            ))}

            {!isGhost && levelZones.map(zone => (
                <ZoneVolume key={zone.id} zone={zone} hasAlert={activeAlerts.has(zone.id)} visible={true} />
            ))}

            <group visible={!isGhost}>
                {props}
            </group>
        </group>
    );
};

// --- Main Component ---

interface DigitalTwinViewProps {
    activeCameraId?: string | null;
    onCameraSelect?: (id: string | null) => void;
    externalCameras?: Camera3D[];
    externalEntities?: Entity3D[];
}

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({ 
    activeCameraId, 
    onCameraSelect,
    externalCameras,
    externalEntities,
}) => {
    const { colors, mode } = useTheme();
    
    // Internal state for simulation mode
    const [simEntities, setSimEntities] = useState<Entity3D[]>([]);
    const [simAlerts, setSimAlerts] = useState<SecurityAlert[]>([]);
    const [simConfig, setSimConfig] = useState(digitalTwinService.getSceneConfig());
    
    // UI State
    const [showZones, setShowZones] = useState(true);
    const [showFrustums, setShowFrustums] = useState(true);
    const [internalSelectedCameraId, setInternalSelectedCameraId] = useState<string | null>(null);
    const [isLive, setIsLive] = useState(true);
    
    const [activeLevel, setActiveLevel] = useState<'ALL' | 'FLOOR-01' | 'FLOOR-02'>('ALL');
    const [selectedPerson, setSelectedPerson] = useState<PersonDetails | null>(null);

    const isExternalMode = !!externalCameras;
    const controlsRef = useRef<any>(null);
    
    useEffect(() => {
        if (!isExternalMode) {
            const unsubEntities = digitalTwinService.subscribe((data, alertData, liveStatus) => {
                setSimEntities(data);
                setSimAlerts(alertData);
                if (liveStatus !== undefined) setIsLive(liveStatus);
            });
            const unsubConfig = digitalTwinService.subscribeToConfig(setSimConfig);
            return () => { unsubEntities(); unsubConfig(); };
        }
    }, [isExternalMode]);

    const entities = isExternalMode ? (externalEntities || []) : simEntities;
    const cameras = isExternalMode ? (externalCameras || []) : simConfig.cameras;
    const walls = simConfig.walls; 
    
    const visibleEntities = useMemo(() => entities.filter(e => activeLevel === 'ALL' || getFloorId(e.position.y) === activeLevel), [entities, activeLevel]);
    const visibleCameras = useMemo(() => cameras.filter(c => activeLevel === 'ALL' || getFloorId(c.position.y) === activeLevel), [cameras, activeLevel]);

    const activeZoneIds = useMemo(() => {
        const ids = new Set<string>();
        simAlerts.forEach(a => { if (a.zoneId) ids.add(a.zoneId); });
        return ids;
    }, [simAlerts]);

    const selectedCameraId = activeCameraId !== undefined ? activeCameraId : internalSelectedCameraId;

    const handleCameraSelect = (id: string | null) => {
        if (onCameraSelect) {
            onCameraSelect(id);
        } else {
            setInternalSelectedCameraId(id);
        }
    };

    const handleEntitySelect = (entity: Entity3D) => {
        setSelectedPerson({
            id: entity.id,
            name: entity.label,
            role: entity.role,
            status: entity.isViolating ? 'VIOLATION' : entity.status,
            lastSeen: format(entity.firstSeen, 'HH:mm:ss'),
            location: entity.currentZoneId || 'Unknown Zone',
            avatarUrl: undefined 
        });
    };

    const handleLevelChange = (level: 'ALL' | 'FLOOR-01' | 'FLOOR-02') => {
        setActiveLevel(level);
        if (controlsRef.current) {
            const yTarget = level === 'FLOOR-02' ? 4 : 0;
            controlsRef.current.target.set(0, yTarget, 0);
        }
    };

    const floor1Visibility = activeLevel === 'ALL' || activeLevel === 'FLOOR-01' ? 'VISIBLE' : activeLevel === 'FLOOR-02' ? 'GHOST' : 'HIDDEN';
    const floor2Visibility = activeLevel === 'ALL' || activeLevel === 'FLOOR-02' ? 'VISIBLE' : 'HIDDEN';

    return (
        <div className="h-full flex flex-col bg-app-primary relative overflow-hidden">
            <PersonInfoModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
            
            {/* 3D Canvas */}
            <div className="flex-1 bg-app-primary rounded-lg shadow-lg border border-border overflow-hidden m-4" onClick={() => handleCameraSelect(null)}>
                <Canvas shadows camera={{ position: [20, 20, 20], fov: 45 }}>
                    <color attach="background" args={[colors.sceneBg]} />
                    {/* Dynamic Fog for theme blending */}
                    <fog attach="fog" args={[colors.sceneMist, 20, 90]} />

                    <OrbitControls 
                        ref={controlsRef}
                        makeDefault 
                        minPolarAngle={0} 
                        maxPolarAngle={Math.PI / 2.1} 
                        maxDistance={80}
                        minDistance={5}
                        enabled={true} 
                    />
                    
                    <ambientLight intensity={mode === 'dark' ? 0.2 : 0.5} />
                    <directionalLight position={[10, 20, 10]} intensity={mode === 'dark' ? 1.5 : 1.0} castShadow shadow-mapSize={[2048, 2048]}>
                        <orthographicCamera attach="shadow-camera" args={[-30, 30, 30, -30]} />
                    </directionalLight>
                    <hemisphereLight intensity={0.3} color="#ffffff" groundColor={colors.sceneBg} />
                    
                    <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
                        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor={colors.textPrimary} />
                    </GizmoHelper>

                    {!isExternalMode && (
                        <>
                            <FacilityLevel 
                                levelId="FLOOR-01" 
                                yOffset={0} 
                                walls={simConfig.walls} 
                                zones={simConfig.zones}
                                activeAlerts={activeZoneIds}
                                visibility={floor1Visibility}
                                onSelect={() => handleLevelChange('FLOOR-01')}
                                floorSize={(simConfig as any).floorSize}
                                imageUrl={(simConfig as any).imageUrl}
                            />
                            <FacilityLevel 
                                levelId="FLOOR-02" 
                                yOffset={4} 
                                walls={simConfig.walls} 
                                zones={simConfig.zones}
                                activeAlerts={activeZoneIds}
                                visibility={floor2Visibility}
                                onSelect={() => handleLevelChange('FLOOR-02')}
                                floorSize={(simConfig as any).floorSize}
                                imageUrl={(simConfig as any).imageUrl}
                            />
                        </>
                    )}

                    {showFrustums && visibleCameras.map(cam => (
                        <SecurityCamera 
                            key={cam.id} 
                            cam={cam}
                            walls={walls} 
                            isSelected={cam.id === selectedCameraId}
                            onSelect={() => handleCameraSelect(cam.id)}
                            onChange={() => {}}
                            visible={true}
                            color={mode === 'dark' ? '#334155' : '#64748b'}
                        />
                    ))}

                    {visibleEntities.map(entity => (
                        <PersonEntity 
                            key={entity.id} 
                            entity={entity} 
                            showHistory={!isExternalMode}
                            onSelect={handleEntitySelect}
                            visible={true}
                        />
                    ))}

                </Canvas>
            </div>
            
            {/* Level Controls */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                 {['FLOOR-02', 'FLOOR-01', 'ALL'].map(level => (
                     <button
                        key={level}
                        onClick={() => handleLevelChange(level as any)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${activeLevel === level ? 'bg-brand-primary border-brand-primary text-white shadow-lg' : 'bg-app-panel/80 border-border text-text-muted hover:text-text-primary'}`}
                     >
                        {level === 'ALL' ? 'Full Facility' : level}
                     </button>
                 ))}
            </div>
        </div>
    );
};
