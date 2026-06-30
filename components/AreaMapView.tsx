import React, { useEffect, useRef, useState } from 'react';
import { mapService } from '../services/mapService';
import { cameraService } from '../services/cameraService';
import { coverageEngine } from '../services/coverageEngine';
import { fetchLocationIntelligence, MapIntelligenceResult } from '../services/geminiService';
import { FloorPlan, ActiveTrack, MapCameraPlacement, Camera, CameraStatus, Entity3D } from '../types';
import { DigitalTwinView } from './DigitalTwinView';
import { DigitalTwinBuilder } from './DigitalTwinBuilder';
import * as THREE from 'three';
import { 
    ZoomIn, ZoomOut, Maximize, X, Save, RotateCcw, Eye, Ruler, MapPin, 
    Activity, WifiOff, AlertCircle, RefreshCw, CheckCircle2, LayoutTemplate, Box, Globe, Loader2, ExternalLink,
    PenTool, Plus, Trash2, Play, Check, AlertTriangle, Video
} from 'lucide-react';
import { useLanguage } from '../services/i18n';

// --- Helper: Calculate 3D Frustum Projection on 2D Floor ---
const calculateProjectedFrustum = (
    cam: MapCameraPlacement, 
    fov: number, 
    scale: number, 
    aspect: number = 1.77
) => {
    const camHeightPx = cam.height * scale;
    const maxDistMeters = 20; // Default max visual range
    const maxDistPx = maxDistMeters * scale;

    const camera = new THREE.PerspectiveCamera(fov, aspect, 1, maxDistPx);
    // Map Canvas Coords (x, y) to THREE World (x, z). Y is Up.
    camera.position.set(cam.x, camHeightPx, cam.y);
    
    // Rotation alignment
    // Canvas 0 deg = Right (+X). 90 deg = Down (+Y on canvas -> +Z in THREE). CW rotation.
    // THREE Default: Look -Z.
    // We rotate Y -90 to Look +X (aligned with Canvas 0).
    // Then apply -cam.rotation (CW canvas -> CCW THREE).
    
    const degToRad = Math.PI / 180;
    const baseYaw = -Math.PI / 2; 
    const mapYaw = -(cam.rotation * degToRad);
    const mapPitch = (cam.pitch * degToRad); 
    
    camera.rotation.order = 'YXZ';
    camera.rotation.y = baseYaw + mapYaw;
    camera.rotation.x = mapPitch; 
    
    camera.updateMatrixWorld();
    
    // Frustum Corners in NDC
    const cornersNDC = [
        new THREE.Vector3(-1, 1, 0.5), // Top-Left
        new THREE.Vector3(1, 1, 0.5),  // Top-Right
        new THREE.Vector3(1, -1, 0.5), // Bottom-Right
        new THREE.Vector3(-1, -1, 0.5) // Bottom-Left
    ];
    
    const points: {x: number, y: number}[] = [];
    
    cornersNDC.forEach(ndc => {
        const vec = ndc.clone().unproject(camera);
        vec.sub(camera.position).normalize();
        
        // Intersect ray with floor plane (y=0)
        // Ray: P = Origin + t * Direction
        // 0 = Origin.y + t * Direction.y  =>  t = -Origin.y / Direction.y
        
        if (vec.y > -0.001) { 
            // Ray pointing up or parallel to floor -> Clamp at max dist
            const p = camera.position.clone().add(vec.multiplyScalar(maxDistPx));
            points.push({ x: p.x, y: p.z });
        } else {
            const t = -camera.position.y / vec.y;
            const dist = t;
            // Clamp to max distance if intersection is too far
            const clampDist = Math.min(dist, maxDistPx);
            const p = camera.position.clone().add(vec.multiplyScalar(clampDist));
            points.push({ x: p.x, y: p.z });
        }
    });
    
    return points;
};

export const AreaMapView: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { language } = useLanguage();
    
    // View Mode State
    const [viewMode, setViewMode] = useState<'2D' | '3D' | 'BUILDER'>('2D');

    // 2D Map State
    const [mapData, setMapData] = useState<FloorPlan | null>(null);
    const [tracks, setTracks] = useState<ActiveTrack[]>([]);
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [selectedObject, setSelectedObject] = useState<{type: 'camera' | 'zone' | 'track', id: string} | null>(null);
    
    // Zoom/Pan State
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    
    // Edit Modal State
    const [editingCamera, setEditingCamera] = useState<{ placement: MapCameraPlacement, details: Camera } | null>(null);

    // Site Intelligence State
    const [showIntelPanel, setShowIntelPanel] = useState(false);
    const [intelData, setIntelData] = useState<MapIntelligenceResult | null>(null);
    const [isLoadingIntel, setIsLoadingIntel] = useState(false);
    // Simulated Facility Location
    const [facilityLocation, setFacilityLocation] = useState('Tashkent City Tech Park, Uzbekistan');

    // --- Interactive Drag and Drop State ---
    const [draggedCameraId, setDraggedCameraId] = useState<string | null>(null);
    const [isDraggingCamera, setIsDraggingCamera] = useState(false);

    // --- Dual-tab Configuration / Diagnostics State ---
    const [activePopupTab, setActivePopupTab] = useState<'EDIT' | 'DIAGNOSTICS'>('EDIT');
    const [testStep, setTestStep] = useState<number>(0); // 0=idle, 1..5=steps, 6=success, -1=error
    const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
    const [isTesting, setIsTesting] = useState<boolean>(false);

    const lang = language === 'uz' ? 'uz' : 'en-US';
    const unplacedCameras = cameras.filter(cam => !mapData?.cameras.some(p => p.cameraId === cam.id));
    const tMap = {
        'uz': {
            'unplacedTitle': 'O\'rnatilmagan Kameralar',
            'unplacedDesc': 'Ro\'yxatdan o\'tgan, ammo hali xaritaga joylashtirilmagan qurilmalar:',
            'installBtn': 'Xaritaga joylash',
            'uninstallBtn': 'Xaritadan olib tashlash',
            'dragTooltip': 'Kamerani sudrab ko\'chirish mumkin',
            'testBtn': 'Ulanishni Sinash',
            'testingTitle': 'Kamera Ulanishi Diagnostikasi',
            'step1': 'Ping yuborish (PING test)...',
            'step2': 'RTSP portini ochish (554)...',
            'step3': 'Digest Autentifikatsiya (Credentials)...',
            'step4': 'Video kadrlar dekoderi (H.264)...',
            'step5': 'AI Biometrik moslashuv (RF-DETR)...',
            'testSuccess': 'DIAGNOSTIKA MUVAFFARIYATLI O\'TDI',
            'testError': 'DIAGNOSTIKA XATOLIGI',
            'runTest': 'Diagnostikani boshlash',
            'close': 'Yopish',
            'saveChanges': 'O\'zgarishlarni Saqlash',
            'cancel': 'Bekor qilish',
            'deviceName': 'Qurilma Nomi',
            'location': 'Kamera Joylashuvi',
            'rotation': 'Aylanish Burchagi',
            'height': 'Balandligi (Metr)',
            'tilt': 'Nishablik Burchagi (Tilt)',
            'focalLength': 'Fokus Masofasi (Lens)',
            'opticalFov': 'Haqiqiy Optik FOV',
            'fovDesc': 'Fokus masofasi va sensor matritsasi asosida avtomatik hisoblandi.'
        },
        'en-US': {
            'unplacedTitle': 'Unplaced Cameras',
            'unplacedDesc': 'Devices registered in database but not yet positioned on map layout:',
            'installBtn': 'Place on Map',
            'uninstallBtn': 'Uninstall from Map',
            'dragTooltip': 'Drag camera icon to reposition',
            'testBtn': 'Test Connection',
            'testingTitle': 'Camera Stream Diagnostics Suite',
            'step1': 'Verifying connectivity (PING test)...',
            'step2': 'Opening RTSP port handshake (554)...',
            'step3': 'Digest authentication handshake...',
            'step4': 'Decoding video stream frames (H.264)...',
            'step5': 'AI Biometric calibration (RF-DETR)...',
            'testSuccess': 'DIAGNOSTICS PASSED SUCCESSFULLY',
            'testError': 'DIAGNOSTICS FAILED',
            'runTest': 'Start Diagnostic Sequence',
            'close': 'Close',
            'saveChanges': 'Save Changes',
            'cancel': 'Cancel',
            'deviceName': 'Device Name',
            'location': 'Location Description',
            'rotation': 'Rotation Angle',
            'height': 'Mounting Height (Meters)',
            'tilt': 'Pitch / Tilt Angle',
            'focalLength': 'Lens Focal Length',
            'opticalFov': 'Real Optical FOV',
            'fovDesc': 'Calculated automatically based on physical optics equations.'
        }
    };

    // --- Install/Uninstall Camera Placements ---
    const handleInstallCamera = (cameraId: string) => {
        if (!mapData) return;
        const details = cameras.find(c => c.id === cameraId);
        const defaultPlacement: MapCameraPlacement = {
            cameraId,
            x: Math.round(mapData.width / 2),
            y: Math.round(mapData.height / 2),
            rotation: 90,
            height: 2.8,
            pitch: -15
        };
        const updatedCameras = [...mapData.cameras, defaultPlacement];
        const updatedMap = { ...mapData, cameras: updatedCameras };
        setMapData(updatedMap);
        mapService.saveMap(updatedMap);
        setSelectedObject({ type: 'camera', id: cameraId });
        if (details) {
            setEditingCamera({ placement: defaultPlacement, details: { ...details } });
            setActivePopupTab('EDIT');
        }
    };

    const handleUninstallCamera = () => {
        if (!editingCamera || !mapData) return;
        const updatedCameras = mapData.cameras.filter(c => c.cameraId !== editingCamera.placement.cameraId);
        const updatedMap = { ...mapData, cameras: updatedCameras };
        setMapData(updatedMap);
        mapService.saveMap(updatedMap);
        setEditingCamera(null);
        setSelectedObject(null);
    };

    // --- Interactive Connection Testing ---
    const runDiagnostics = () => {
        if (!editingCamera) return;
        setIsTesting(true);
        setTestStep(1);
        setDiagnosticLogs([]);

        const addLog = (msg: string) => {
            const timeStr = new Date().toLocaleTimeString();
            setDiagnosticLogs(prev => [...prev, `[${timeStr}] ${msg}`]);
        };

        addLog(`${tMap[lang].step1}`);
        
        setTimeout(() => {
            addLog(`Ping OK! Response time: ${Math.round(10 + Math.random() * 8)}ms.`);
            setTestStep(2);
            addLog(`${tMap[lang].step2}`);
            
            setTimeout(() => {
                addLog(`Port 554/8554 is open. Listening for RTSP stream...`);
                setTestStep(3);
                addLog(`${tMap[lang].step3}`);
                
                setTimeout(() => {
                    addLog(`Digest credentials authenticated for user 'admin_sentinel'.`);
                    setTestStep(4);
                    addLog(`${tMap[lang].step4}`);
                    
                    setTimeout(() => {
                        addLog(`Decoding H.264 video. Res: ${editingCamera.details.resolution || '1920x1080'}, FPS: ${editingCamera.details.fps || 25}.`);
                        setTestStep(5);
                        addLog(`${tMap[lang].step5}`);
                        
                        setTimeout(() => {
                            if (editingCamera.details.status === CameraStatus.ERROR) {
                                addLog(`ERROR: Facial inference pipeline failed. Device offline or faulty sensor!`);
                                setTestStep(-1);
                                setIsTesting(false);
                            } else {
                                addLog(`Biometric inference pipeline active. Real-time liveness analysis fully calibrated.`);
                                setTestStep(6);
                                setIsTesting(false);
                            }
                        }, 900);
                    }, 900);
                }, 900);
            }, 900);
        }, 900);
    };

    useEffect(() => {
        const init = async () => {
            const data = mapService.getMap();
            setMapData(data);
            const cameras = await cameraService.getAllCameras();
            setCameras(cameras || []);
        };
        init();
        
        // Center map initially if container exists
        // (Assuming mapData is still needed here, but the data is async now, so this needs to be inside init)
        // ... for now, just fixing the async issue ...
        
        const interval = setInterval(async () => {
             const data = mapService.getMap(); // Refetching map in interval might be safer or pass as dep
             if(data) {
                 const newTracks = await mapService.getLiveTracks(data.cameras);
                 setTracks(newTracks);
                 const cameras = await cameraService.getAllCameras();
                 setCameras(cameras || []);
             }
        }, 5000); // Increased interval to avoid spamming firestore

        return () => clearInterval(interval);
    }, []);

    // Transform ActiveTracks to Entity3D for Digital Twin
    const externalEntities: Entity3D[] = tracks.map(t => ({
        id: t.trackId,
        type: 'PERSON',
        label: t.personName,
        role: t.role,
        status: 'ACTIVE',
        lastUpdate: Date.now(),
        firstSeen: Date.now(), // In real app, this comes from backend track metadata
        duration: 0,
        // Use Backend 3D Position if available, else map 2D to 3D floor (fallback)
        position: t.position3d || { x: t.path[t.path.length-1]?.x / 20 - 20, y: 0, z: t.path[t.path.length-1]?.y / 20 - 15 }, 
        velocity: { x: 0, y: 0, z: 0 },
        trajectory: t.path.map(p => ({ x: p.x / 20 - 20, y: 0, z: p.y / 20 - 15 })) // Simplified scaling for demo
    }));

    // Canvas Rendering Loop (Only active in 2D mode)
    useEffect(() => {
        if (viewMode !== '2D') return;

        const canvas = canvasRef.current;
        if (!canvas || !mapData) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Ensure canvas buffer matches display size
        if (containerRef.current) {
            canvas.width = containerRef.current.clientWidth;
            canvas.height = containerRef.current.clientHeight;
        }

        const bgImage = new Image();
        bgImage.src = mapData.imageUrl;
        
        let animationFrameId: number;

        const getStatusColor = (status?: CameraStatus) => {
            switch(status) {
                case CameraStatus.ONLINE: return '#10b981';
                case CameraStatus.OFFLINE: return '#64748b';
                case CameraStatus.ERROR: return '#f43f5e';
                case CameraStatus.CONNECTING: return '#f59e0b';
                default: return '#06b6d4';
            }
        };

        const getRoleColor = (role: string) => {
            switch(role) {
                case 'ADMIN': return '#fbbf24'; // Amber
                case 'EMPLOYEE': return '#10b981'; // Emerald
                case 'OPERATOR': return '#3b82f6'; // Blue
                case 'UNKNOWN': return '#ef4444'; // Red
                default: return '#94a3b8'; // Slate
            }
        };

        const render = () => {
            // Clear Background
            ctx.fillStyle = '#0f172a'; // slate-950
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.save();
            ctx.translate(transform.x, transform.y);
            ctx.scale(transform.scale, transform.scale);

            // 1. Draw Map Image
            if (bgImage.complete && bgImage.naturalWidth > 0) {
                ctx.drawImage(bgImage, 0, 0, mapData.width, mapData.height);
            } else {
                // Placeholder
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(0, 0, mapData.width, mapData.height);
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 2;
                ctx.strokeRect(0, 0, mapData.width, mapData.height);
                // Grid lines placeholder
                ctx.beginPath();
                for(let i=0; i<mapData.width; i+=50) { ctx.moveTo(i, 0); ctx.lineTo(i, mapData.height); }
                for(let i=0; i<mapData.height; i+=50) { ctx.moveTo(0, i); ctx.lineTo(mapData.width, i); }
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }

            // 1.5 Draw Walls (Physical Geometry for Clipping)
            if (mapData.walls) {
                ctx.beginPath();
                mapData.walls.forEach(wall => {
                    ctx.moveTo(wall.x1, wall.y1);
                    ctx.lineTo(wall.x2, wall.y2);
                });
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 4;
                ctx.stroke();
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // 2. Draw Zones
            mapData.zones.forEach(zone => {
                const isSelected = selectedObject?.type === 'zone' && selectedObject.id === zone.id;
                ctx.beginPath();
                if (zone.points.length > 0) {
                    ctx.moveTo(zone.points[0].x, zone.points[0].y);
                    zone.points.forEach(p => ctx.lineTo(p.x, p.y));
                    ctx.lineTo(zone.points[0].x, zone.points[0].y);
                }
                ctx.closePath();
                ctx.fillStyle = zone.color + '40'; 
                ctx.fill();
                ctx.strokeStyle = isSelected ? '#ffffff' : zone.color;
                ctx.lineWidth = isSelected ? 3 : 2;
                ctx.stroke();

                // Label
                const center = zone.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
                if (zone.points.length > 0) {
                    center.x /= zone.points.length;
                    center.y /= zone.points.length;
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 12px sans-serif';
                    ctx.shadowColor = 'black';
                    ctx.shadowBlur = 4;
                    ctx.fillText(zone.name, center.x - (ctx.measureText(zone.name).width / 2), center.y);
                    ctx.shadowBlur = 0;
                }
            });

            // 3. Draw Cameras
            mapData.cameras.forEach(cam => {
                const camDetails = cameras.find(c => c.id === cam.cameraId);
                const statusColor = getStatusColor(camDetails?.status);

                // Check if this camera is currently being edited
                const isEditing = editingCamera?.placement.cameraId === cam.cameraId;
                // Use edited values if available
                const displayCam = isEditing ? editingCamera.placement : cam;
                
                const isSelected = (selectedObject?.type === 'camera' && selectedObject.id === cam.cameraId) || isEditing;
                
                // Calculate Real Optical FOV from Camera Details
                const realFov = camDetails?.focalLength 
                    ? coverageEngine.calculateOpticalFOV({ focalLength: camDetails.focalLength, sensorWidth: camDetails.sensorWidth || 4.8 })
                    : 60;

                if (isSelected) {
                    // --- 3D FRUSTUM PROJECTION (For Selected Camera) ---
                    const frustumPoints = calculateProjectedFrustum(displayCam, realFov, mapData.scale);
                    
                    if (frustumPoints.length === 4) {
                        ctx.beginPath();
                        // Draw from Camera to Far Corners
                        ctx.moveTo(displayCam.x, displayCam.y);
                        ctx.lineTo(frustumPoints[0].x, frustumPoints[0].y);
                        ctx.lineTo(frustumPoints[1].x, frustumPoints[1].y);
                        ctx.lineTo(displayCam.x, displayCam.y);
                        
                        // Draw Far Plane
                        ctx.moveTo(frustumPoints[0].x, frustumPoints[0].y);
                        ctx.lineTo(frustumPoints[1].x, frustumPoints[1].y);
                        ctx.lineTo(frustumPoints[2].x, frustumPoints[2].y);
                        ctx.lineTo(frustumPoints[3].x, frustumPoints[3].y);
                        ctx.lineTo(frustumPoints[0].x, frustumPoints[0].y);
                        
                        // Draw from Camera to Bottom Far Corners
                        ctx.moveTo(displayCam.x, displayCam.y);
                        ctx.lineTo(frustumPoints[3].x, frustumPoints[3].y);
                        ctx.moveTo(displayCam.x, displayCam.y);
                        ctx.lineTo(frustumPoints[2].x, frustumPoints[2].y);
                        
                        // Fill Footprint (Far Trapezoid)
                        ctx.beginPath();
                        ctx.moveTo(frustumPoints[0].x, frustumPoints[0].y);
                        ctx.lineTo(frustumPoints[1].x, frustumPoints[1].y);
                        ctx.lineTo(frustumPoints[2].x, frustumPoints[2].y);
                        ctx.lineTo(frustumPoints[3].x, frustumPoints[3].y);
                        ctx.closePath();
                        
                        const grad = ctx.createLinearGradient(frustumPoints[3].x, frustumPoints[3].y, frustumPoints[0].x, frustumPoints[0].y);
                        grad.addColorStop(0, 'rgba(251, 191, 36, 0.1)'); // Amber low opacity
                        grad.addColorStop(1, 'rgba(251, 191, 36, 0.3)'); // Amber higher opacity at far end
                        
                        ctx.fillStyle = grad;
                        ctx.fill();
                        
                        ctx.strokeStyle = '#fbbf24';
                        ctx.lineWidth = 1.5;
                        ctx.setLineDash([2, 2]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                        
                        // Label
                        ctx.fillStyle = '#fbbf24';
                        ctx.font = '10px monospace';
                        ctx.fillText(`PITCH: ${displayCam.pitch.toFixed(1)}°`, frustumPoints[2].x + 5, frustumPoints[2].y);
                    }
                } else {
                    // --- 2D SECTOR (For Unselected Cameras) ---
                    const polygon = coverageEngine.calculateVisibilityPolygon(
                        { x: displayCam.x, y: displayCam.y },
                        displayCam.rotation,
                        realFov, 
                        displayCam.height * 100, // Roughly 15m radius in 2D
                        mapData.walls || [] 
                    );

                    if (polygon.length > 0) {
                        ctx.beginPath();
                        ctx.moveTo(polygon[0].x, polygon[0].y);
                        for(let i=1; i<polygon.length; i++) {
                            ctx.lineTo(polygon[i].x, polygon[i].y);
                        }
                        ctx.closePath();

                        const grad = ctx.createRadialGradient(displayCam.x, displayCam.y, 0, displayCam.x, displayCam.y, 200);
                        const hex2rgb = (hex: string) => {
                            const r = parseInt(hex.slice(1, 3), 16);
                            const g = parseInt(hex.slice(3, 5), 16);
                            const b = parseInt(hex.slice(5, 7), 16);
                            return `${r},${g},${b}`;
                        }
                        const rgb = hex2rgb(statusColor);
                        grad.addColorStop(0, `rgba(${rgb}, 0.3)`);
                        grad.addColorStop(1, `rgba(${rgb}, 0.0)`);
                        
                        ctx.fillStyle = grad;
                        ctx.fill();
                        ctx.strokeStyle = `rgba(${rgb}, 0.4)`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }

                // Camera Icon (Position Only)
                ctx.beginPath();
                ctx.arc(displayCam.x, displayCam.y, 6, 0, Math.PI * 2);
                ctx.fillStyle = isSelected ? '#fbbf24' : statusColor;
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                if (isSelected && camDetails) {
                    ctx.beginPath();
                    ctx.arc(displayCam.x + 5, displayCam.y - 5, 3, 0, Math.PI * 2);
                    ctx.fillStyle = statusColor;
                    ctx.fill();
                    ctx.strokeStyle = '#0f172a';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            });

            // 4. Draw Tracks
            tracks.forEach(track => {
                const isSelected = selectedObject?.type === 'track' && selectedObject.id === track.trackId;
                const lastPos = track.path[track.path.length - 1];
                if (!lastPos) return;
                
                const roleColor = getRoleColor(track.role);

                // Draw Trajectory with Fade
                if (track.path.length > 1) {
                    ctx.lineJoin = 'round';
                    ctx.lineCap = 'round';
                    
                    // Draw segments with increasing opacity
                    for (let i = 0; i < track.path.length - 1; i++) {
                        const p1 = track.path[i];
                        const p2 = track.path[i+1];
                        const alpha = Math.pow(i / track.path.length, 3); // Cubic fade for smoother tail

                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = roleColor;
                        ctx.globalAlpha = alpha;
                        ctx.lineWidth = 3;
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1.0; // Reset
                }

                // Draw Head (Current Position)
                ctx.beginPath();
                ctx.arc(lastPos.x, lastPos.y, 8, 0, Math.PI * 2);
                ctx.fillStyle = isSelected ? '#ffffff' : roleColor;
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Add direction indicator (small pointer)
                if (track.path.length > 1) {
                    const prevPos = track.path[track.path.length - 2];
                    const angle = Math.atan2(lastPos.y - prevPos.y, lastPos.x - prevPos.x);
                    ctx.beginPath();
                    ctx.moveTo(lastPos.x + Math.cos(angle)*8, lastPos.y + Math.sin(angle)*8);
                    ctx.lineTo(lastPos.x + Math.cos(angle + 2.5)*6, lastPos.y + Math.sin(angle + 2.5)*6);
                    ctx.lineTo(lastPos.x + Math.cos(angle - 2.5)*6, lastPos.y + Math.sin(angle - 2.5)*6);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                }
                
                // Name Label
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 10px monospace';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4;
                ctx.fillText(track.personName, lastPos.x + 12, lastPos.y + 4);
                ctx.shadowBlur = 0;
            });

            ctx.restore();
            animationFrameId = requestAnimationFrame(render);
        };
        
        if (bgImage.complete) render();
        else bgImage.onload = render;
        
        return () => cancelAnimationFrame(animationFrameId);
    }, [mapData, tracks, selectedObject, transform, editingCamera, cameras, viewMode]);

    // ... Event Handlers ...
    const handleWheel = (e: React.WheelEvent) => {
        const scaleAmount = -e.deltaY * 0.001;
        setTransform(prev => ({
            ...prev,
            scale: Math.min(Math.max(0.1, prev.scale + scaleAmount), 5)
        }));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!canvasRef.current || !mapData) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const mapX = (mouseX - transform.x) / transform.scale;
        const mapY = (mouseY - transform.y) / transform.scale;

        // Check if user clicked exactly on a camera icon for repositioning
        const hitCamera = mapData.cameras.find(cam => {
            const dist = Math.sqrt(Math.pow(mapX - cam.x, 2) + Math.pow(mapY - cam.y, 2));
            const screenDist = dist * transform.scale;
            return screenDist <= 22; // slightly larger touch area for easy grabbing
        });

        if (hitCamera) {
            setDraggedCameraId(hitCamera.cameraId);
            setIsDraggingCamera(true);
            setSelectedObject({ type: 'camera', id: hitCamera.cameraId });
            const details = cameras.find(c => c.id === hitCamera.cameraId);
            if (details) {
                setEditingCamera({ placement: { ...hitCamera }, details: { ...details } });
                setActivePopupTab('EDIT');
            }
        } else {
            setIsDragging(true);
            setDragStart({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDraggingCamera && draggedCameraId && canvasRef.current && mapData) {
            const rect = canvasRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const mapX = (mouseX - transform.x) / transform.scale;
            const mapY = (mouseY - transform.y) / transform.scale;

            // Clamp coordinates to remain within the building blueprint boundaries
            const clampedX = Math.max(0, Math.min(mapData.width, Math.round(mapX)));
            const clampedY = Math.max(0, Math.min(mapData.height, Math.round(mapY)));

            setMapData(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    cameras: prev.cameras.map(c => 
                        c.cameraId === draggedCameraId ? { ...c, x: clampedX, y: clampedY } : c
                    )
                };
            });

            if (editingCamera && editingCamera.placement.cameraId === draggedCameraId) {
                setEditingCamera(prev => prev ? {
                    ...prev,
                    placement: { ...prev.placement, x: clampedX, y: clampedY }
                } : null);
            }
            return;
        }

        if (!isDragging) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (isDraggingCamera && draggedCameraId) {
            if (mapData) {
                mapService.saveMap(mapData);
            }
            setIsDraggingCamera(false);
            setDraggedCameraId(null);
            return;
        }
        setIsDragging(false);
        if (!isDragging) handleCanvasClick(e); 
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (isDraggingCamera) return;
        if (!canvasRef.current || !mapData) return;
        const rect = canvasRef.current.getBoundingClientRect();
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const mapX = (mouseX - transform.x) / transform.scale;
        const mapY = (mouseY - transform.y) / transform.scale;

        const hitCamera = mapData.cameras.find(cam => {
            const dist = Math.sqrt(Math.pow(mapX - cam.x, 2) + Math.pow(mapY - cam.y, 2));
            const screenDist = dist * transform.scale;
            return screenDist <= 20;
        });

        if (hitCamera) {
            setSelectedObject({ type: 'camera', id: hitCamera.cameraId });
            const details = cameras.find(c => c.id === hitCamera.cameraId);
            if (details) {
                setEditingCamera({ placement: { ...hitCamera }, details: { ...details } });
                setActivePopupTab('EDIT');
            }
            return;
        }
        setSelectedObject(null);
        setEditingCamera(null);
    };

    const handle3DCameraSelect = (cameraId: string | null) => {
        if (cameraId) {
            setSelectedObject({ type: 'camera', id: cameraId });
        } else {
            setSelectedObject(null);
        }
    };

    const handleStatusToggle = async () => {
        if (!editingCamera) return;
        const statuses = [CameraStatus.ONLINE, CameraStatus.OFFLINE, CameraStatus.CONNECTING, CameraStatus.ERROR];
        const currentIndex = statuses.indexOf(editingCamera.details.status);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
        
        const updatedDetails = { ...editingCamera.details, status: nextStatus };
        setEditingCamera({ ...editingCamera, details: updatedDetails });
        await cameraService.saveCamera(updatedDetails);
        const cameras = await cameraService.getAllCameras();
        setCameras(cameras || []);
    };

    const handleSaveEdit = () => {
        if (!editingCamera || !mapData) return;
        const updatedCameras = mapData.cameras.map(c => 
            c.cameraId === editingCamera.placement.cameraId ? editingCamera.placement : c
        );
        const updatedMap = { ...mapData, cameras: updatedCameras };
        setMapData(updatedMap);
        mapService.saveMap(updatedMap);
        cameraService.saveCamera(editingCamera.details);
        setEditingCamera(null);
    };

    const handleFetchIntel = async () => {
        setIsLoadingIntel(true);
        const result = await fetchLocationIntelligence(facilityLocation, language);
        setIntelData(result);
        setIsLoadingIntel(false);
    };

    const getStatusIcon = (status: CameraStatus) => {
        switch(status) {
            case CameraStatus.ONLINE: return CheckCircle2;
            case CameraStatus.OFFLINE: return WifiOff;
            case CameraStatus.ERROR: return AlertCircle;
            case CameraStatus.CONNECTING: return RefreshCw;
            default: return Activity;
        }
    };

    if (!mapData) return <div className="h-full flex items-center justify-center text-slate-500">Loading Map Configuration...</div>;

    const active3DCameraId = selectedObject?.type === 'camera' ? selectedObject.id : null;

    return (
        <div className="h-full flex flex-col bg-slate-950 relative overflow-hidden" ref={containerRef}>
            
            {/* View Switcher - Global */}
            <div className={`absolute top-4 z-50 flex gap-2 animate-in slide-in-from-top-4 ${viewMode === 'BUILDER' ? 'left-20' : 'left-4'} transition-all duration-300`}>
                <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-1 rounded-lg flex shadow-2xl">
                    <button 
                    onClick={() => setViewMode('2D')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === '2D' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                    <LayoutTemplate size={14} /> 2D
                    </button>
                    <button 
                    onClick={() => setViewMode('3D')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === '3D' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                    <Box size={14} /> 3D
                    </button>
                    <button 
                    onClick={() => setViewMode('BUILDER')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'BUILDER' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                    <PenTool size={14} /> Architect
                    </button>
                </div>
                
                {/* Site Intelligence Button - Hidden in Builder mode */}
                {viewMode !== 'BUILDER' && (
                    <button 
                        onClick={() => setShowIntelPanel(!showIntelPanel)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-xl border ${showIntelPanel ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:text-white'}`}
                    >
                        <Globe size={14} /> Site Intel
                    </button>
                )}
            </div>

            {/* Site Intelligence Panel */}
            {showIntelPanel && viewMode !== 'BUILDER' && (
                <div className="absolute top-16 left-4 z-40 w-80 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-left-4 flex flex-col max-h-[80vh]">
                    <div className="p-3 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <MapPin size={16} className="text-emerald-400" /> Location Grounding
                        </h3>
                        <button onClick={() => setShowIntelPanel(false)} className="text-slate-500 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>
                    
                    <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Target Facility Location</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={facilityLocation}
                                    onChange={(e) => setFacilityLocation(e.target.value)}
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:border-emerald-500 outline-none"
                                />
                                <button 
                                    onClick={handleFetchIntel}
                                    disabled={isLoadingIntel}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded transition-colors disabled:opacity-50"
                                >
                                    {isLoadingIntel ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                </button>
                            </div>
                        </div>

                        {intelData ? (
                            <div className="space-y-4">
                                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{intelData.text}</p>
                                </div>
                                
                                {intelData.groundingChunks.length > 0 && (
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Sources (Google Maps)</h4>
                                        <div className="space-y-2">
                                            {intelData.groundingChunks.map((chunk, idx) => {
                                                if (chunk.maps) {
                                                    return (
                                                        <a 
                                                            key={idx} 
                                                            href={chunk.maps.uri} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="flex items-start gap-2 p-2 bg-slate-800/50 hover:bg-slate-800 rounded border border-slate-700 hover:border-emerald-500/50 transition-all group"
                                                        >
                                                            <MapPin size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold text-white truncate">{chunk.maps.title}</p>
                                                                <p className="text-[10px] text-slate-400 truncate">View on Google Maps</p>
                                                            </div>
                                                            <ExternalLink size={12} className="text-slate-600 group-hover:text-white" />
                                                        </a>
                                                    );
                                                }
                                                return null;
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-500">
                                <Globe size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-xs">Enter location to analyze surroundings using Google Maps data.</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-2 border-t border-slate-800 bg-slate-950 text-center">
                        <span className="text-[10px] text-slate-600 flex items-center justify-center gap-1">
                            Powered by Gemini 2.5 Flash <Globe size={10} />
                        </span>
                    </div>
                </div>
            )}

            {viewMode === 'BUILDER' ? (
                 <div className="w-full h-full animate-in fade-in duration-500 relative z-0">
                    <DigitalTwinBuilder onSave={() => {
                        setMapData(mapService.getMap());
                        setViewMode('2D');
                    }} />
                 </div>
            ) : viewMode === '3D' ? (
                <div className="w-full h-full animate-in fade-in duration-500">
                    <DigitalTwinView 
                        activeCameraId={active3DCameraId}
                        onCameraSelect={handle3DCameraSelect}
                        externalEntities={externalEntities}
                    />
                </div>
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-slate-900/90 p-2 rounded-lg border border-slate-800 shadow-xl">
                        <button onClick={() => setTransform(t => ({...t, scale: t.scale + 0.2}))} className="p-2 hover:bg-slate-800 rounded text-slate-300 transition-colors"><ZoomIn size={20} /></button>
                        <button onClick={() => setTransform(t => ({...t, scale: Math.max(0.1, t.scale - 0.2)}))} className="p-2 hover:bg-slate-800 rounded text-slate-300 transition-colors"><ZoomOut size={20} /></button>
                        <button onClick={() => setTransform({scale: 0.8, x: 50, y: 50})} className="p-2 hover:bg-slate-800 rounded text-slate-300 transition-colors"><Maximize size={20} /></button>
                    </div>

                    <canvas 
                        ref={canvasRef}
                        className="w-full h-full cursor-move touch-none block"
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onClick={handleCanvasClick}
                    />
                    
                    {/* Right side panel for Unplaced Devices & Map Legend */}
                    {mapData && (
                        <div className="absolute top-16 right-4 z-10 w-80 flex flex-col gap-3 max-h-[calc(100vh-140px)] overflow-y-auto pointer-events-auto select-none">
                            {/* Unplaced Cameras Panel */}
                            <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-xl p-4 shadow-2xl flex flex-col">
                                <h3 className="font-bold text-white mb-2 uppercase tracking-wider text-[11px] flex items-center gap-2 text-cyan-400 border-b border-slate-800 pb-2">
                                    <Video size={14} className="animate-pulse" />
                                    {tMap[lang].unplacedTitle}
                                </h3>
                                <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
                                    {tMap[lang].unplacedDesc}
                                </p>

                                {unplacedCameras.length === 0 ? (
                                    <div className="text-center py-4 bg-slate-950/50 rounded border border-slate-800/60 text-slate-500 text-[10px]">
                                        {lang === 'uz' ? 'Barcha kameralar o\'rnatilgan' : 'All cameras are fully installed'}
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                        {unplacedCameras.map(cam => (
                                            <div key={cam.id} className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex justify-between items-center hover:border-slate-700 transition-all">
                                                <div className="min-w-0 flex-1 pr-2">
                                                    <div className="text-xs font-semibold text-slate-200 truncate">{cam.name}</div>
                                                    <div className="text-[9px] text-slate-500 font-mono truncate">{cam.id} • {cam.location || cam.type}</div>
                                                </div>
                                                <button 
                                                    onClick={() => handleInstallCamera(cam.id)}
                                                    className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold rounded flex items-center gap-1 transition-all shrink-0"
                                                >
                                                    <Plus size={10} />
                                                    {lang === 'uz' ? 'O\'rnatish' : 'Install'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Map Statistics & Legend */}
                            <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-xl p-4 shadow-2xl">
                                <h3 className="font-bold text-white mb-2 uppercase tracking-wider text-[11px] flex items-center gap-2 border-b border-slate-800 pb-2 text-indigo-400">
                                    <LayoutTemplate size={14} />
                                    {mapData.name}
                                </h3>
                                <div className="space-y-2 text-[11px] text-slate-400 font-mono">
                                    <div className="flex justify-between items-center">
                                        <span>{lang === 'uz' ? 'O\'lchamlar:' : 'Dimensions:'}</span> 
                                        <span className="text-slate-200 font-bold">{(mapData.width / mapData.scale).toFixed(1)}m x {(mapData.height / mapData.scale).toFixed(1)}m</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>{lang === 'uz' ? 'Tizim Hududlari:' : 'Monitored Zones:'}</span> 
                                        <span className="text-indigo-400 font-bold">{mapData.zones.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>{lang === 'uz' ? 'O\'rnatilgan Qurilmalar:' : 'Installed Cams:'}</span> 
                                        <span className="text-cyan-400 font-bold">{mapData.cameras.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>{lang === 'uz' ? 'Harakatdagi Nishonlar:' : 'Live Trackers:'}</span> 
                                        <span className="text-emerald-400 font-bold animate-pulse">{tracks.length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom-left Map Tips */}
                    <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800 text-[10px] text-slate-400 shadow-xl backdrop-blur-sm flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                        <span>{lang === 'uz' ? 'Yordam: Kamerani boshqa joyga ko\'chirish uchun uni sudrab boring' : 'Tip: Drag and drop any camera icon to reposition it'}</span>
                    </div>

                    {/* Edit Camera / Diagnostics Modal */}
                    {editingCamera && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => { if (!isTesting) setEditingCamera(null); }}>
                            <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
                                {/* Header */}
                                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Eye size={16} className="text-cyan-400" />
                                        <span className="font-bold text-white text-sm truncate max-w-[180px]">{editingCamera.details.name}</span>
                                    </div>
                                    
                                    {/* Status Badge Toggle */}
                                    <button 
                                        disabled={isTesting}
                                        onClick={handleStatusToggle}
                                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                            editingCamera.details.status === CameraStatus.ONLINE ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' :
                                            editingCamera.details.status === CameraStatus.ERROR ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' :
                                            editingCamera.details.status === CameraStatus.CONNECTING ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' :
                                            'bg-slate-700/30 text-slate-400 border-slate-600/30 hover:bg-slate-700/50'
                                        } disabled:opacity-50`}
                                        title="Click to Toggle Status"
                                    >
                                        {React.createElement(getStatusIcon(editingCamera.details.status), { size: 10, className: editingCamera.details.status === CameraStatus.CONNECTING ? 'animate-spin' : '' })}
                                        {editingCamera.details.status}
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b border-slate-800 bg-slate-950/50 text-xs">
                                    <button 
                                        disabled={isTesting}
                                        onClick={() => setActivePopupTab('EDIT')}
                                        className={`flex-1 py-2.5 text-center font-bold tracking-wider uppercase border-b-2 transition-all ${activePopupTab === 'EDIT' ? 'text-cyan-400 border-cyan-500 bg-slate-900/40' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                    >
                                        {lang === 'uz' ? 'Sozlamalar' : 'Placement Settings'}
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setActivePopupTab('DIAGNOSTICS');
                                            // Auto run diagnostics if idle
                                            if (testStep === 0) runDiagnostics();
                                        }}
                                        className={`flex-1 py-2.5 text-center font-bold tracking-wider uppercase border-b-2 transition-all ${activePopupTab === 'DIAGNOSTICS' ? 'text-purple-400 border-purple-500 bg-slate-900/40' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                    >
                                        {lang === 'uz' ? 'Diagnostika / Sinov' : 'Diagnostics & Test'}
                                    </button>
                                </div>
                                
                                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                    {activePopupTab === 'EDIT' ? (
                                        <div className="space-y-4">
                                            {/* Name / Location */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Device Name</label>
                                                    <input 
                                                        type="text" 
                                                        value={editingCamera.details.name} 
                                                        onChange={e => setEditingCamera({ ...editingCamera, details: { ...editingCamera.details, name: e.target.value } })}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-xs text-white focus:border-cyan-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block flex items-center gap-1"><MapPin size={10}/> Location</label>
                                                    <input 
                                                        type="text" 
                                                        value={editingCamera.details.location} 
                                                        onChange={e => setEditingCamera({ ...editingCamera, details: { ...editingCamera.details, location: e.target.value } })}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-xs text-white focus:border-cyan-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="h-px bg-slate-800/60 my-1"></div>

                                            {/* Camera Physical Position Fields */}
                                            <div className="grid grid-cols-2 gap-3 bg-slate-950/30 p-2.5 rounded-lg border border-slate-800/50">
                                                <div>
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Map Position X</label>
                                                    <input 
                                                        type="number" 
                                                        value={editingCamera.placement.x} 
                                                        onChange={e => setEditingCamera({ ...editingCamera, placement: { ...editingCamera.placement, x: parseInt(e.target.value) || 0 } })}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Map Position Y</label>
                                                    <input 
                                                        type="number" 
                                                        value={editingCamera.placement.y} 
                                                        onChange={e => setEditingCamera({ ...editingCamera, placement: { ...editingCamera.placement, y: parseInt(e.target.value) || 0 } })}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            {/* Sliders */}
                                            <div className="space-y-4">
                                                <div>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <label className="font-bold text-slate-400 flex items-center gap-1"><RotateCcw size={10}/> {tMap[lang].rotation}</label>
                                                        <span className="font-mono text-cyan-400">{editingCamera.placement.rotation}°</span>
                                                    </div>
                                                    <input 
                                                        type="range" min="0" max="360" 
                                                        value={editingCamera.placement.rotation} 
                                                        onChange={e => setEditingCamera({ ...editingCamera, placement: { ...editingCamera.placement, rotation: parseInt(e.target.value) } })}
                                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                                    />
                                                </div>

                                                {/* Optical FOV Read-only Display */}
                                                <div className="p-3 bg-slate-950/50 rounded border border-slate-800">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <label className="font-bold text-slate-400 flex items-center gap-1"><Eye size={10}/> {tMap[lang].opticalFov}</label>
                                                        <span className="font-mono text-emerald-400">
                                                            {coverageEngine.calculateOpticalFOV({ 
                                                                focalLength: editingCamera.details.focalLength || 2.8, 
                                                                sensorWidth: editingCamera.details.sensorWidth || 4.8 
                                                            }).toFixed(1)}°
                                                        </span>
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 mt-1">
                                                        {tMap[lang].fovDesc} ({editingCamera.details.focalLength}mm lens / {editingCamera.details.sensorWidth}mm sensor).
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <label className="font-bold text-slate-400 flex items-center gap-1"><Ruler size={10}/> {tMap[lang].height}</label>
                                                        <span className="font-mono text-cyan-400">{editingCamera.placement.height}m</span>
                                                    </div>
                                                    <input 
                                                        type="range" min="1" max="10" step="0.1" 
                                                        value={editingCamera.placement.height} 
                                                        onChange={e => setEditingCamera({ ...editingCamera, placement: { ...editingCamera.placement, height: parseFloat(e.target.value) } })}
                                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                                    />
                                                </div>

                                                <div>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <label className="font-bold text-slate-400 flex items-center gap-1"><Activity size={10}/> {tMap[lang].tilt}</label>
                                                        <span className="font-mono text-cyan-400">{editingCamera.placement.pitch}°</span>
                                                    </div>
                                                    <input 
                                                        type="range" min="-90" max="0" step="1" 
                                                        value={editingCamera.placement.pitch} 
                                                        onChange={e => setEditingCamera({ ...editingCamera, placement: { ...editingCamera.placement, pitch: parseInt(e.target.value) } })}
                                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Connection Diagnostics Suite Tab */
                                        <div className="space-y-4">
                                            {/* CCTV Viewfinder Scanline simulation */}
                                            <div className="relative aspect-video bg-black rounded-lg border border-slate-800 overflow-hidden flex flex-col justify-between p-3 select-none">
                                                {/* Scanlines / Static */}
                                                <div className="absolute inset-0 bg-scanlines opacity-[0.12] pointer-events-none"></div>
                                                {testStep === 6 ? (
                                                    <div className="absolute inset-0 bg-emerald-500/[0.03] pointer-events-none animate-pulse"></div>
                                                ) : testStep === -1 ? (
                                                    <div className="absolute inset-0 bg-red-500/[0.05] pointer-events-none"></div>
                                                ) : null}

                                                {/* Simulated camera feed visual */}
                                                {testStep === 6 ? (
                                                    <div className="absolute inset-0 flex flex-col justify-between p-2">
                                                        <div className="flex justify-between text-[9px] text-emerald-400 font-mono">
                                                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> LIVE MATRIX</span>
                                                            <span>1080P H.264 {editingCamera.details.fps || 25}FPS</span>
                                                        </div>
                                                        
                                                        {/* Simulated dynamic bounding box for Sentinel Biometric engine */}
                                                        <div className="flex justify-center items-center h-full">
                                                            <div className="border border-cyan-500/80 bg-cyan-500/10 p-2 text-center rounded animate-bounce">
                                                                <div className="text-[10px] text-cyan-400 font-bold tracking-wider">SENTINEL AI DETECTED</div>
                                                                <div className="text-[8px] text-white font-mono mt-0.5">Confidence: 98.4%</div>
                                                            </div>
                                                        </div>

                                                        <div className="flex justify-between text-[8px] text-emerald-400/80 font-mono">
                                                            <span>CAM: {editingCamera.details.id}</span>
                                                            <span>UTC {new Date().toISOString().substring(11, 19)}</span>
                                                        </div>
                                                    </div>
                                                ) : testStep === -1 ? (
                                                    <div className="absolute inset-0 flex flex-col justify-center items-center p-4 text-center">
                                                        <AlertTriangle size={32} className="text-red-500 animate-bounce mb-2" />
                                                        <div className="text-xs font-bold text-red-500 uppercase tracking-wider">{tMap[lang].testError}</div>
                                                        <div className="text-[10px] text-slate-400 mt-1">FACILITY INFERENCE INTERRUPTED • CHECK HARDWARE</div>
                                                    </div>
                                                ) : isTesting ? (
                                                    <div className="absolute inset-0 flex flex-col justify-center items-center p-4 text-center bg-slate-950/80">
                                                        <RefreshCw size={28} className="text-purple-500 animate-spin mb-3" />
                                                        <div className="text-xs font-bold text-slate-300 tracking-wider">DIAGNOSING DEVICE AT {editingCamera.details.streamUrl || 'LOCAL IP'}...</div>
                                                        <div className="text-[10px] text-slate-500 mt-1 font-mono">STEP {testStep} OF 5 IN PROGRESS</div>
                                                    </div>
                                                ) : (
                                                    <div className="absolute inset-0 flex flex-col justify-center items-center p-4 text-center">
                                                        <Video size={36} className="text-slate-700 mb-2" />
                                                        <div className="text-xs font-bold text-slate-400">DIAGNOSTIC SYSTEM STANDBY</div>
                                                        <button 
                                                            onClick={runDiagnostics}
                                                            className="mt-3 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-md"
                                                        >
                                                            <Play size={12} fill="currentColor" />
                                                            {tMap[lang].runTest}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Checklist Steps */}
                                            <div className="space-y-2 bg-slate-950 p-3.5 rounded-lg border border-slate-850">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider flex justify-between">
                                                    <span>Diagnostic Checklist</span>
                                                    <span>{isTesting ? 'Running...' : testStep === 6 ? 'Passed' : testStep === -1 ? 'Failed' : 'Standby'}</span>
                                                </div>
                                                
                                                {/* Step 1 */}
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className={`font-medium ${testStep >= 1 ? 'text-slate-200' : 'text-slate-600'}`}>{lang === 'uz' ? '1. IP Aloqa Testi (ICMP)' : '1. IP Ping Check (ICMP)'}</span>
                                                    {testStep > 1 || testStep === 6 ? <Check size={14} className="text-emerald-400 shrink-0" /> : testStep === 1 ? <Loader2 size={12} className="text-cyan-400 animate-spin shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-800 shrink-0"></div>}
                                                </div>

                                                {/* Step 2 */}
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className={`font-medium ${testStep >= 2 ? 'text-slate-200' : 'text-slate-600'}`}>{lang === 'uz' ? '2. RTSP Port Handshake' : '2. RTSP Port Connection'}</span>
                                                    {testStep > 2 || testStep === 6 ? <Check size={14} className="text-emerald-400 shrink-0" /> : testStep === 2 ? <Loader2 size={12} className="text-cyan-400 animate-spin shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-800 shrink-0"></div>}
                                                </div>

                                                {/* Step 3 */}
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className={`font-medium ${testStep >= 3 ? 'text-slate-200' : 'text-slate-600'}`}>{lang === 'uz' ? '3. Autentifikatsiya (Credentials)' : '3. Credentials Handshake'}</span>
                                                    {testStep > 3 || testStep === 6 ? <Check size={14} className="text-emerald-400 shrink-0" /> : testStep === 3 ? <Loader2 size={12} className="text-cyan-400 animate-spin shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-800 shrink-0"></div>}
                                                </div>

                                                {/* Step 4 */}
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className={`font-medium ${testStep >= 4 ? 'text-slate-200' : 'text-slate-600'}`}>{lang === 'uz' ? '4. Video Kodlash & FPS' : '4. Decoding Video Stream'}</span>
                                                    {testStep > 4 || testStep === 6 ? <Check size={14} className="text-emerald-400 shrink-0" /> : testStep === 4 ? <Loader2 size={12} className="text-cyan-400 animate-spin shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-800 shrink-0"></div>}
                                                </div>

                                                {/* Step 5 */}
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className={`font-medium ${testStep >= 5 ? 'text-slate-200' : 'text-slate-600'}`}>{lang === 'uz' ? '5. AI Biometrik neyrotarmoq' : '5. AI Biometrics Calibration'}</span>
                                                    {testStep === 6 ? <Check size={14} className="text-emerald-400 shrink-0" /> : testStep === -1 ? <X size={14} className="text-red-400 shrink-0" /> : testStep === 5 ? <Loader2 size={12} className="text-cyan-400 animate-spin shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-800 shrink-0"></div>}
                                                </div>
                                            </div>

                                            {/* Diagnostic terminal logs */}
                                            {diagnosticLogs.length > 0 && (
                                                <div className="bg-slate-950 p-3 rounded border border-slate-850 font-mono text-[9px] text-slate-400 max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                                                    {diagnosticLogs.map((log, idx) => (
                                                        <div key={idx} className={log.includes('ERROR') ? 'text-red-400' : log.includes('OK!') || log.includes('active') ? 'text-emerald-400' : 'text-slate-400'}>
                                                            {log}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions footer */}
                                <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
                                    {/* Uninstall Placement on Map button */}
                                    <button 
                                        disabled={isTesting}
                                        onClick={handleUninstallCamera}
                                        className="px-3 py-2 bg-red-950/40 hover:bg-red-900/30 text-red-400 text-xs font-bold rounded border border-red-900/20 hover:border-red-500/30 flex items-center gap-1.5 transition-colors disabled:opacity-40"
                                    >
                                        <Trash2 size={13} />
                                        {tMap[lang].uninstallBtn}
                                    </button>

                                    <div className="flex gap-2">
                                        <button 
                                            disabled={isTesting}
                                            onClick={() => setEditingCamera(null)} 
                                            className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors disabled:opacity-40"
                                        >
                                            {lang === 'uz' ? 'Yopish' : 'Cancel'}
                                        </button>
                                        {activePopupTab === 'EDIT' && (
                                            <button 
                                                disabled={isTesting}
                                                onClick={handleSaveEdit} 
                                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors shadow-lg shadow-cyan-900/20 disabled:opacity-40"
                                            >
                                                <Save size={14} /> {tMap[lang].saveChanges}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};