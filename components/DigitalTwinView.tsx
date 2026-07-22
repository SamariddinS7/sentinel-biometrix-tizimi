import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Camera, Eye, AlertTriangle, Activity, Box } from 'lucide-react';
import { Entity3D, Camera3D } from '../types';
import { mapService } from '../services/mapService';
import { useTheme } from '../theme/ThemeProvider';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DigitalTwinViewProps {
  activeCameraId?: string | null;
  onCameraSelect?: (id: string | null) => void;
  externalEntities?: Entity3D[];
}

// ─── Entity Marker ────────────────────────────────────────────────────────────

const EntityMarker: React.FC<{ entity: Entity3D; isSelected: boolean; onClick: () => void }> = ({
  entity,
  isSelected,
  onClick,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.position.y = 0.5 + Math.sin(Date.now() * 0.002) * 0.05;
      if (isSelected) meshRef.current.rotation.y += delta;
    }
  });

  const color =
    entity.isViolating
      ? '#ef4444'
      : entity.status === 'LOST'
      ? '#f59e0b'
      : entity.type === 'ROBOT'
      ? '#8b5cf6'
      : '#22d3ee';

  return (
    <group position={[entity.position.x, entity.position.y, entity.position.z]}>
      {/* Body capsule */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
      >
        <capsuleGeometry args={[0.2, 0.8, 4, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected || hovered ? 0.6 : 0.2}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>

      {/* Glow ring on floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
        <ringGeometry args={[0.22, 0.35, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Violation spike */}
      {entity.isViolating && (
        <mesh position={[0, 1.4, 0]}>
          <coneGeometry args={[0.12, 0.3, 3]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1} />
        </mesh>
      )}

      {/* Label */}
      {(hovered || isSelected) && (
        <Html distanceFactor={8} position={[0, 1.8, 0]} center>
          <div
            style={{
              background: 'rgba(10,18,30,0.92)',
              color: '#e2e8f0',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 11,
              whiteSpace: 'nowrap',
              border: `1px solid ${color}`,
              pointerEvents: 'none',
            }}
          >
            <strong>{entity.label || entity.id}</strong>
            {entity.role && <span style={{ color: '#94a3b8', marginLeft: 6 }}>{entity.role}</span>}
          </div>
        </Html>
      )}
    </group>
  );
};

// ─── Camera Frustum ───────────────────────────────────────────────────────────

const CameraFrustum: React.FC<{
  cam: Camera3D;
  isActive: boolean;
  onClick: () => void;
}> = ({ cam, isActive, onClick }) => {
  const color = isActive ? '#facc15' : '#22d3ee';

  // Simple cone for FOV visualisation
  const halfFov = ((cam.fov ?? 60) * Math.PI) / 180 / 2;
  const depth = cam.depth ?? 8;
  const baseRadius = Math.tan(halfFov) * depth;

  return (
    <group
      position={[cam.position.x, cam.position.y + 0.5, cam.position.z]}
      rotation={[cam.rotation.x, cam.rotation.y, cam.rotation.z]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Camera body */}
      <mesh>
        <boxGeometry args={[0.3, 0.2, 0.4]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 0.7 : 0.3}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* FOV cone */}
      <mesh position={[0, 0, -depth / 2]}>
        <coneGeometry args={[baseRadius, depth, 12, 1, true]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isActive ? 0.12 : 0.05}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// ─── Floor Grid ───────────────────────────────────────────────────────────────

const SceneFloor: React.FC = () => (
  <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#0a1220" roughness={0.9} metalness={0.1} />
    </mesh>
    <Grid
      args={[60, 60]}
      cellSize={1}
      cellThickness={0.4}
      sectionSize={5}
      sectionThickness={0.8}
      cellColor="#1e3a5f"
      sectionColor="#2563eb"
      fadeDistance={40}
      infiniteGrid
    />
  </>
);

// ─── Derive default cameras from mapService ────────────────────────────────────

function buildDefaultCameras(): Camera3D[] {
  try {
    const map = mapService.getMap();
    if (!map?.cameras?.length) return [];

    return map.cameras.map((p, i) => ({
      id: p.cameraId,
      name: `CAM-${String(i + 1).padStart(2, '0')}`,
      status: 'online' as const,
      streamUrl: '',
      position: { x: (p.x / 25) - 20, y: 2.5, z: (p.y / 25) - 15 },
      rotation: {
        x: 0,
        y: -(p.rotation ?? 0) * (Math.PI / 180),
        z: 0,
      },
      fov: 60,
      aspectRatio: 16 / 9,
      depth: 8,
      coverageColor: '#22d3ee',
    })) as unknown as Camera3D[];
  } catch {
    return [];
  }
}

// ─── Scene ────────────────────────────────────────────────────────────────────

const Scene: React.FC<{
  cameras: Camera3D[];
  entities: Entity3D[];
  activeCameraId: string | null;
  onCameraSelect: (id: string | null) => void;
}> = ({ cameras, entities, activeCameraId, onCameraSelect }) => {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
      <pointLight position={[0, 8, 0]} intensity={0.5} color="#3b82f6" />

      <SceneFloor />

      {cameras.map((cam) => (
        <CameraFrustum
          key={cam.id}
          cam={cam}
          isActive={cam.id === activeCameraId}
          onClick={() => onCameraSelect(cam.id === activeCameraId ? null : cam.id)}
        />
      ))}

      {entities.map((ent) => (
        <EntityMarker
          key={ent.id}
          entity={ent}
          isSelected={ent.id === selectedEntityId}
          onClick={() => setSelectedEntityId(ent.id === selectedEntityId ? null : ent.id)}
        />
      ))}

      <OrbitControls
        makeDefault
        minDistance={3}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2 - 0.05}
        enablePan
        enableZoom
        enableRotate
      />
    </>
  );
};

// ─── HUD overlay ──────────────────────────────────────────────────────────────

const HUD: React.FC<{
  entities: Entity3D[];
  cameras: Camera3D[];
  activeCameraId: string | null;
}> = ({ entities, cameras, activeCameraId }) => {
  const violations = entities.filter((e) => e.isViolating).length;
  const activeCamera = cameras.find((c) => c.id === activeCameraId);

  return (
    <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none z-10">
      {/* Status pills */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-app-panel/90 border border-border text-xs px-2 py-1 rounded-full text-text-secondary backdrop-blur-sm">
          <Activity size={10} className="text-green-400" />
          <span>{entities.length} entities</span>
        </div>
        <div className="flex items-center gap-1.5 bg-app-panel/90 border border-border text-xs px-2 py-1 rounded-full text-text-secondary backdrop-blur-sm">
          <Camera size={10} className="text-cyan-400" />
          <span>{cameras.length} cameras</span>
        </div>
        {violations > 0 && (
          <div className="flex items-center gap-1.5 bg-red-950/80 border border-red-700 text-xs px-2 py-1 rounded-full text-red-400 backdrop-blur-sm animate-pulse">
            <AlertTriangle size={10} />
            <span>{violations} violation{violations > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Active camera info */}
      {activeCamera && (
        <div className="bg-app-panel/90 border border-yellow-500/50 text-xs px-2 py-1.5 rounded-lg text-text-secondary backdrop-blur-sm flex items-center gap-1.5">
          <Eye size={10} className="text-yellow-400" />
          <span className="text-yellow-300 font-medium">{activeCamera.name}</span>
          <span className="text-text-secondary/60">selected</span>
        </div>
      )}
    </div>
  );
};

// ─── DigitalTwinView (export) ─────────────────────────────────────────────────

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({
  activeCameraId = null,
  onCameraSelect = () => {},
  externalEntities = [],
}) => {
  const [cameras] = useState<Camera3D[]>(() => buildDefaultCameras());

  return (
    <div className="relative w-full h-full min-h-[400px] bg-app-primary rounded-xl overflow-hidden border border-border">
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 12, 18], fov: 55, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#060d18' }}
      >
        <Scene
          cameras={cameras}
          entities={externalEntities}
          activeCameraId={activeCameraId}
          onCameraSelect={onCameraSelect}
        />
      </Canvas>

      {/* Heads-Up Display */}
      <HUD entities={externalEntities} cameras={cameras} activeCameraId={activeCameraId} />

      {/* Corner badge */}
      <div className="absolute bottom-3 right-3 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-app-panel/80 border border-border text-xs px-2 py-1 rounded-full text-text-secondary/60 backdrop-blur-sm">
          <Box size={9} />
          <span>3D Digital Twin</span>
        </div>
      </div>
    </div>
  );
};

export default DigitalTwinView;
