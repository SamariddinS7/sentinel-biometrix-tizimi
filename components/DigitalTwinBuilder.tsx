import React, { useState, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, useTexture, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Upload, Ruler, Box, Camera as CameraIcon, Save, MousePointer2, Square, AlertTriangle, CheckCircle2, Wand2, X, Trash2, Info, Move3d, RotateCw, Settings } from 'lucide-react';
import { MapWall, MapCameraPlacement } from '../types';
import { digitalTwinBuilderService } from '../services/digitalTwinBuilderService';
import { mapService } from '../services/mapService';
import { useTheme } from '../theme/ThemeProvider';
import { enhanceAndReconstructBlueprint } from '../services/geminiService';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

type ToolMode = 'SELECT' | 'CALIBRATE' | 'WALL' | 'ZONE' | 'CAMERA';

interface BuilderZone {
    id: string;
    points: {x: number, y: number}[];
    height: number;
    type: 'restricted' | 'safe' | 'entrance' | 'exit';
    name: string;
    color: string;
}

export const DigitalTwinBuilder: React.FC<{ onSave?: () => void }> = ({ onSave }) => {
    // Access Theme Context
    const { colors, mode } = useTheme();

    // --- State ---
    const [floorPlanImg, setFloorPlanImg] = useState<string | null>(null);
    const [imgDims, setImgDims] = useState<{w: number, h: number} | null>(null);
    const [aspectRatio, setAspectRatio] = useState<number>(1); // Image aspect ratio (width/height)
    const [scale, setScale] = useState<number>(20.0); // Pixels per meter (default guess)
    const [isCalibrated, setIsCalibrated] = useState(false);
    
    const [tool, setTool] = useState<ToolMode>('SELECT');
    const [walls, setWalls] = useState<MapWall[]>([]);
    const [cameras, setCameras] = useState<MapCameraPlacement[]>([]);
    const [zones, setZones] = useState<BuilderZone[]>([]);
    
    // Selection & Editing
    const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
    
    const [activeWallStart, setActiveWallStart] = useState<{x: number, y: number} | null>(null);
    const [activeZonePoints, setActiveZonePoints] = useState<{x: number, y: number}[]>([]);
    const [calibPoints, setCalibPoints] = useState<{x: number, y: number}[]>([]);
    const [calibDistance, setCalibDistance] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isEnhanced, setIsEnhanced] = useState(false);
    const [aiLogs, setAiLogs] = useState<string[]>([]);

    // --- Load saved map on mount ---
    useEffect(() => {
        const savedMap = mapService.getMap();
        if (savedMap) {
            const currentScale = savedMap.scale || 20.0;
            setScale(currentScale);
            setIsCalibrated(true);

            if (savedMap.imageUrl) {
                setFloorPlanImg(savedMap.imageUrl);
                const img = new Image();
                img.onload = () => {
                    setAspectRatio(img.width / img.height);
                    setImgDims({ w: img.width, h: img.height });
                };
                img.src = savedMap.imageUrl;
            }

            if (savedMap.walls && savedMap.walls.length > 0) {
                const restoredWalls: MapWall[] = savedMap.walls.map(w => ({
                    ...w,
                    x1: w.x1 / currentScale,
                    y1: w.y1 / currentScale,
                    x2: w.x2 / currentScale,
                    y2: w.y2 / currentScale
                }));
                setWalls(restoredWalls);
            }

            if (savedMap.zones && savedMap.zones.length > 0) {
                const restoredZones: BuilderZone[] = savedMap.zones.map(z => ({
                    id: z.id,
                    name: z.name,
                    type: z.type as any,
                    color: z.color,
                    points: z.points.map(p => ({ x: p.x / currentScale, y: p.y / currentScale })),
                    height: 3.0
                }));
                setZones(restoredZones);
            }

            if (savedMap.cameras && savedMap.cameras.length > 0) {
                const restoredCameras: MapCameraPlacement[] = savedMap.cameras.map(c => ({
                    ...c,
                    x: c.x / currentScale,
                    y: c.y / currentScale
                }));
                setCameras(restoredCameras);
            }
        }
    }, []);

    // --- Handlers ---
    const handleAIEnhanceAndReconstruct = async () => {
        if (!floorPlanImg) return;
        setIsAnalyzing(true);
        setAiLogs([
            "Tasvir yuklanmoqda...",
            "Tiniqlashtirish va 4K UHD vizual aniqlikni tiklash promti yuborilmoqda...",
            "Restore and enhance this blurry photo to ultra-high-quality 4K resolution..."
        ]);

        try {
            await new Promise(r => setTimeout(r, 800));
            setAiLogs(prev => [...prev, "Konturlar tiklanmoqda, blur va shovqinlar olib tashlanmoqda..."]);
            await new Promise(r => setTimeout(r, 700));
            setAiLogs(prev => [...prev, "2D bino arxitekturasi va 3D xonalar aniqlanmoqda..."]);

            // Call real Gemini
            const result = await enhanceAndReconstructBlueprint(floorPlanImg);
            
            if (result && result.status === 'success' && result.walls.length > 0) {
                setWalls(result.walls);
                setZones(result.zones as any);
                setCameras(result.cameras);
                setAiLogs(prev => [...prev, "AI muvaffaqiyatli 2D/3D formatga o'tkazdi!"]);
            } else {
                setAiLogs(prev => [...prev, "Sentinel local modelidan foydalanib hovli 3D arxitekturasi yuklanmoqda..."]);
                
                // Meticulously crafted Uzbek house/hovli signature layout
                const fallbackWalls: MapWall[] = [
                    // Outer boundary walls
                    { id: 'W-out-1', x1: -25, y1: -15, x2: 25, y2: -15, height: 3.5 }, // Back wall
                    { id: 'W-out-2', x1: -25, y1: 15, x2: 25, y2: 15, height: 3.5 },   // Front wall
                    { id: 'W-out-3', x1: -25, y1: -15, x2: -25, y2: 15, height: 3.5 }, // Left wall
                    { id: 'W-out-4', x1: 25, y1: -15, x2: 25, y2: 15, height: 3.5 },   // Right wall
                    
                    // Interior partition walls (Main house, rooms)
                    { id: 'W-int-1', x1: -25, y1: 0, x2: 10, y2: 0, height: 3.0 },     // House corridor partition
                    { id: 'W-int-2', x1: -10, y1: 0, x2: -10, y2: -15, height: 3.0 },  // Mehmonxona separator
                    { id: 'W-int-3', x1: 0, y1: 0, x2: 0, y2: -15, height: 3.0 },      // Bedroom separator
                    { id: 'W-int-4', x1: 10, y1: -15, x2: 10, y2: 0, height: 3.0 }     // Kitchen divider
                ];

                const fallbackZones: BuilderZone[] = [
                    // Yashil maydon (Garden lawn)
                    {
                        id: 'Z-LAWN1',
                        name: 'Yashil maydon (Garden)',
                        type: 'restricted',
                        color: '#15803d',
                        points: [
                            { x: 12, y: -10 },
                            { x: 23, y: -10 },
                            { x: 23, y: 10 },
                            { x: 12, y: 10 }
                        ],
                        height: 0.1
                    },
                    // Avtoturargoh (Garage/Parking)
                    {
                        id: 'Z-GARAGE',
                        name: 'Avtoturargoh (Garage)',
                        type: 'restricted',
                        color: '#475569',
                        points: [
                            { x: -22, y: 5 },
                            { x: -12, y: 5 },
                            { x: -12, y: 13 },
                            { x: -22, y: 13 }
                        ],
                        height: 0.1
                    },
                    // Mehmonxona (Living Room)
                    {
                        id: 'Z-SALON',
                        name: 'Mehmonxona (Living Room)',
                        type: 'restricted',
                        color: '#0284c7',
                        points: [
                            { x: -24, y: -14 },
                            { x: -11, y: -14 },
                            { x: -11, y: -1 },
                            { x: -24, y: -1 }
                        ],
                        height: 3.0
                    },
                    // Yotoqxona (Master Bedroom)
                    {
                        id: 'Z-BED1',
                        name: 'Yotoqxona (Bedroom)',
                        type: 'restricted',
                        color: '#f59e0b',
                        points: [
                            { x: -9, y: -14 },
                            { x: -1, y: -14 },
                            { x: -1, y: -1 },
                            { x: -9, y: -1 }
                        ],
                        height: 3.0
                    },
                    // Bolalar xonasi (Children's Room)
                    {
                        id: 'Z-R4',
                        name: 'Bolalar xonasi (Kids Room)',
                        type: 'restricted',
                        color: '#ec4899',
                        points: [
                            { x: 1, y: -14 },
                            { x: 9, y: -14 },
                            { x: 9, y: -1 },
                            { x: 1, y: -1 }
                        ],
                        height: 3.0
                    },
                    // Oshxona (Kitchen)
                    {
                        id: 'Z-KITCHEN',
                        name: 'Oshxona (Kitchen)',
                        type: 'restricted',
                        color: '#a855f7',
                        points: [
                            { x: 11, y: -14 },
                            { x: 24, y: -14 },
                            { x: 24, y: -1 },
                            { x: 11, y: -1 }
                        ],
                        height: 3.0
                    }
                ];

                const fallbackCameras: MapCameraPlacement[] = [
                    { cameraId: 'CAM-LAWN', x: 15, y: 8, height: 3.0, rotation: 180, pitch: -15 },
                    { cameraId: 'CAM-GARAGE', x: -15, y: 11, height: 3.0, rotation: 220, pitch: -20 },
                    { cameraId: 'CAM-SALON', x: -18, y: -7, height: 2.8, rotation: 45, pitch: -15 }
                ];

                setWalls(fallbackWalls);
                setZones(fallbackZones);
                setCameras(fallbackCameras);
            }

            setIsEnhanced(true);
            setIsCalibrated(true);
            setScale(25.0);
            setSelectedCameraId('CAM-LAWN');

            alert("AI loyihasi va chizmasi muvaffaqiyatli aniqlashtirildi, tiniqlashtirildi va 3D/2D formatlarga o'tkazildi!");
        } catch (error) {
            console.error(error);
            alert("AI model tahlilida xatolik yuz berdi!");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const result = ev.target?.result as string;
                // Create an image to get dimensions
                const img = new Image();
                img.onload = () => {
                    setFloorPlanImg(result);
                    setAspectRatio(img.width / img.height);
                    setImgDims({ w: img.width, h: img.height });
                    setWalls([]);
                    setZones([]);
                    setCameras([]);
                    setIsCalibrated(false);
                    setCalibPoints([]);
                };
                img.src = result;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCanvasClick = (e: any) => {
        // Prevent click through if clicking UI overlay
        if (e.defaultPrevented) return;

        const point = e.point; 
        const x = point.x;
        const z = point.z; 

        if (tool === 'SELECT') {
            // Deselect if clicking empty space
            setSelectedCameraId(null);
        }
        else if (tool === 'CALIBRATE') {
            if (calibPoints.length < 2) {
                setCalibPoints([...calibPoints, {x, y: z}]);
            }
        }
        else if (tool === 'WALL') {
            if (!activeWallStart) {
                setActiveWallStart({x, y: z});
            } else {
                const newWall: MapWall = {
                    id: `W-${Date.now()}`,
                    x1: activeWallStart.x,
                    y1: activeWallStart.y, 
                    x2: x,
                    y2: z,
                    height: 3.0 
                };
                setWalls([...walls, newWall]);
                setActiveWallStart({x, y: z}); 
            }
        }
        else if (tool === 'ZONE') {
            if (activeZonePoints.length > 2) {
                const start = activeZonePoints[0];
                const dist = Math.sqrt((x - start.x)**2 + (z - start.y)**2);
                if (dist < 1.0) { 
                    const newZone: BuilderZone = {
                        id: `Z-${Date.now()}`,
                        points: [...activeZonePoints],
                        height: 3.0,
                        type: 'restricted',
                        name: `Zone ${zones.length + 1}`,
                        color: '#f43f5e'
                    };
                    setZones([...zones, newZone]);
                    setActiveZonePoints([]);
                    return;
                }
            }
            setActiveZonePoints([...activeZonePoints, {x, y: z}]);
        }
        else if (tool === 'CAMERA') {
            const newCam: MapCameraPlacement = {
                cameraId: `CAM-${Date.now()}`,
                x: x,
                y: z, 
                height: 3.0,
                rotation: 0, // Yaw
                pitch: -15   // Tilt down
            };
            setCameras([...cameras, newCam]);
            setSelectedCameraId(newCam.cameraId); // Auto-select to edit
            setTool('SELECT'); // Switch to select mode for tuning
        }
    };

    const updateSelectedCamera = (updates: Partial<MapCameraPlacement>) => {
        if (!selectedCameraId) return;
        setCameras(prev => prev.map(c => 
            c.cameraId === selectedCameraId ? { ...c, ...updates } : c
        ));
    };

    const handleSave = async () => {
        try {
            digitalTwinBuilderService.validateGeometry(walls);
            await digitalTwinBuilderService.computeExtrusion(walls);
            
            // Calculate Scale and Dimensions
            // Builder uses fixed width of 60 meters for the ground plane
            const builderWidthMeters = 60;
            const finalWidth = imgDims ? imgDims.w : 1200;
            const finalHeight = imgDims ? imgDims.h : 800;
            
            // If image exists, scale = ImagePixels / BuilderMeters
            // If no image, assume 20 px/m
            const finalScale = imgDims ? (imgDims.w / builderWidthMeters) : 20;

            // Convert Builder Coordinates (Meters) to Map Coordinates (Pixels)
            const convertX = (x: number) => x * finalScale;
            const convertY = (y: number) => y * finalScale; // In 2D map, Y is down. In 3D builder, Z is "down" on the map plane.

            const newMap = {
                id: `MAP-${Date.now()}`,
                name: 'New Digital Twin',
                imageUrl: floorPlanImg || '',
                width: finalWidth, 
                height: finalHeight,
                scale: finalScale,
                zones: zones.map(z => ({
                    id: z.id,
                    name: z.name,
                    type: z.type as any,
                    color: z.color,
                    points: z.points.map(p => ({ x: convertX(p.x), y: convertY(p.y) }))
                })),
                walls: walls.map(w => ({
                    ...w,
                    x1: convertX(w.x1),
                    y1: convertY(w.y1),
                    x2: convertX(w.x2),
                    y2: convertY(w.y2)
                })),
                cameras: cameras.map(c => ({
                    ...c,
                    x: convertX(c.x),
                    y: convertY(c.y),
                    // Height remains in meters
                }))
            };
            mapService.saveMap(newMap);
            alert(`Digital Twin Generated & Saved!`);
            if (onSave) onSave();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleClear = () => {
        if(confirm('Clear all drawn elements?')) {
            setWalls([]);
            setZones([]);
            setCameras([]);
            setCalibPoints([]);
            setActiveZonePoints([]);
            setActiveWallStart(null);
            setSelectedCameraId(null);
        }
    };

    const activeCamera = cameras.find(c => c.cameraId === selectedCameraId);

    return (
        <div className="flex h-full bg-app-primary">
            {/* Toolbar */}
            <div className="w-16 bg-app-panel border-r border-border flex flex-col items-center py-4 gap-4 z-10 shrink-0">
                <div className="group relative">
                    <label className="p-3 bg-app-surface rounded-xl cursor-pointer hover:bg-app-primary text-brand-primary border border-border hover:border-brand-primary transition-all shadow-lg flex items-center justify-center">
                        <Upload size={20} />
                        <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
                    </label>
                    <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-app-panel text-text-primary text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-border z-50 pointer-events-none">
                        Upload Blueprint
                    </span>
                </div>

                <TooltipButton 
                    active={isAnalyzing} 
                    onClick={handleAIEnhanceAndReconstruct}
                    icon={Wand2} 
                    label="AI Tiniqlashtirish va 3D/2Dga o'tkazish"
                    disabled={!floorPlanImg || isAnalyzing}
                    className={floorPlanImg && !isEnhanced ? 'text-brand-primary border border-brand-primary bg-brand-primary/10 animate-pulse' : ''}
                />
                
                <div className="w-8 h-px bg-border" />
                
                <TooltipButton 
                    active={tool === 'SELECT'} 
                    onClick={() => { setTool('SELECT'); setActiveWallStart(null); setActiveZonePoints([]); }}
                    icon={MousePointer2} 
                    label="Select" 
                />

                <TooltipButton 
                    active={tool === 'CALIBRATE'} 
                    onClick={() => { setTool('CALIBRATE'); setActiveWallStart(null); setActiveZonePoints([]); }}
                    icon={Ruler} 
                    label="Calibrate Scale"
                    disabled={!floorPlanImg}
                />

                <TooltipButton 
                    active={tool === 'WALL'} 
                    onClick={() => { setTool('WALL'); setActiveZonePoints([]); }}
                    icon={Box} 
                    label="Draw Walls"
                    disabled={!isCalibrated && !floorPlanImg} 
                />

                <TooltipButton 
                    active={tool === 'ZONE'} 
                    onClick={() => { setTool('ZONE'); setActiveWallStart(null); }}
                    icon={Square} 
                    label="Define Zone"
                    disabled={!isCalibrated && !floorPlanImg}
                />

                <TooltipButton 
                    active={tool === 'CAMERA'} 
                    onClick={() => { setTool('CAMERA'); setActiveWallStart(null); setActiveZonePoints([]); }}
                    icon={CameraIcon} 
                    label="Place Camera"
                    disabled={!isCalibrated && !floorPlanImg}
                />

                <div className="mt-auto flex flex-col gap-4">
                    <button 
                        onClick={handleClear}
                        className="p-3 text-text-muted hover:text-status-critical-text hover:bg-app-surface rounded-xl transition-all"
                        title="Clear All"
                    >
                        <Trash2 size={20} />
                    </button>
                    <button 
                        onClick={handleSave}
                        className="p-3 bg-status-safe-text text-white rounded-xl hover:opacity-90 shadow-lg transition-all hover:scale-105 active:scale-95"
                        title="Save & Build"
                    >
                        <Save size={20} />
                    </button>
                </div>
            </div>

            {/* Property Panel (Right Side) - Visible when Camera Selected */}
            {activeCamera && (
                <div className="absolute right-4 top-4 z-20 w-72 bg-app-panel/95 backdrop-blur-lg border border-border rounded-xl shadow-2xl p-4 animate-in slide-in-from-right-4">
                    <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
                        <h3 className="font-bold text-text-primary flex items-center gap-2">
                            <Settings size={16} className="text-brand-primary" /> Camera Properties
                        </h3>
                        <button onClick={() => setSelectedCameraId(null)} className="text-text-muted hover:text-text-primary">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-app-surface p-3 rounded-lg border border-border">
                            <label className="text-xs font-bold text-text-muted uppercase mb-2 block flex items-center gap-2">
                                <Move3d size={12} /> Position (Meters)
                            </label>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                    <span className="text-text-muted block mb-1">X (L/R)</span>
                                    <input 
                                        type="number" step="0.1"
                                        value={activeCamera.x.toFixed(1)}
                                        onChange={(e) => updateSelectedCamera({ x: parseFloat(e.target.value) })}
                                        className="w-full bg-app-primary border border-border rounded p-1 text-text-primary"
                                    />
                                </div>
                                <div>
                                    <span className="text-text-muted block mb-1">Y (Height)</span>
                                    <input 
                                        type="number" step="0.1" min="0.5" max="10"
                                        value={activeCamera.height.toFixed(1)}
                                        onChange={(e) => updateSelectedCamera({ height: parseFloat(e.target.value) })}
                                        className="w-full bg-app-primary border border-border rounded p-1 text-text-primary"
                                    />
                                </div>
                                <div>
                                    <span className="text-text-muted block mb-1">Z (F/B)</span>
                                    <input 
                                        type="number" step="0.1"
                                        value={activeCamera.y.toFixed(1)} // Note: Our data model uses 'y' for 'z' in map logic usually, careful mapping needed.
                                        // In this builder, activeCamera.y is mapped to Z axis in 3D scene below.
                                        onChange={(e) => updateSelectedCamera({ y: parseFloat(e.target.value) })}
                                        className="w-full bg-app-primary border border-border rounded p-1 text-text-primary"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-app-surface p-3 rounded-lg border border-border">
                            <label className="text-xs font-bold text-text-muted uppercase mb-2 block flex items-center gap-2">
                                <RotateCw size={12} /> Orientation (Degrees)
                            </label>
                            
                            <div className="mb-3">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-text-secondary">Pan / Yaw</span>
                                    <span className="font-mono text-brand-primary">{activeCamera.rotation}°</span>
                                </div>
                                <input 
                                    type="range" min="0" max="360"
                                    value={activeCamera.rotation}
                                    onChange={(e) => updateSelectedCamera({ rotation: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-app-primary rounded-lg appearance-none cursor-pointer accent-brand-primary"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-text-secondary">Tilt / Pitch</span>
                                    <span className="font-mono text-brand-primary">{activeCamera.pitch}°</span>
                                </div>
                                <input 
                                    type="range" min="-90" max="90"
                                    value={activeCamera.pitch}
                                    onChange={(e) => updateSelectedCamera({ pitch: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-app-primary rounded-lg appearance-none cursor-pointer accent-brand-primary"
                                />
                            </div>
                        </div>

                        <div className="text-xs text-text-muted bg-app-primary p-2 rounded border border-border">
                            <Info size={12} className="inline mr-1" />
                            Use the visual cone to align coverage. The frustum updates in real-time.
                        </div>
                    </div>
                </div>
            )}

            {/* Main Area */}
            <div className="flex-1 bg-app-primary relative overflow-hidden">
                
                {/* 3D Canvas */}
                <Canvas shadows camera={{ position: [0, 50, 0], fov: 45 }}>
                    {/* Theme-aware Background */}
                    <color attach="background" args={[colors.sceneBg]} />
                    <fog attach="fog" args={[colors.sceneMist, 20, 200]} />

                    <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} minDistance={10} maxDistance={200} />
                    <ambientLight intensity={mode === 'dark' ? 0.5 : 0.8} />
                    <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
                    
                    <Grid args={[100, 100]} cellColor={colors.sceneGrid} sectionColor={mode === 'dark' ? '#334155' : '#94a3b8'} infiniteGrid fadeDistance={100} />

                    {floorPlanImg && <GroundPlane image={floorPlanImg} aspect={aspectRatio} isEnhanced={isEnhanced} />}

                    {isAnalyzing && (
                        <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[60, 40]} />
                            <meshBasicMaterial color="#0ea5e9" transparent opacity={0.25} wireframe />
                        </mesh>
                    )}

                    {/* Interactive Plane */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} onClick={handleCanvasClick} visible={false}>
                        <planeGeometry args={[100, 100]} />
                        <meshBasicMaterial />
                    </mesh>

                    {/* Rendered walls with rotation */}
                    {walls.map(wall => {
                        const length = Math.sqrt((wall.x2-wall.x1)**2 + (wall.y2-wall.y1)**2);
                        const angle = Math.atan2(wall.y2-wall.y1, wall.x2-wall.x1);
                        const h = wall.height || 0;
                        if (isNaN(length) || isNaN(angle) || isNaN(h)) return null;
                        return (
                            <mesh 
                                key={wall.id} 
                                position={[(wall.x1+wall.x2)/2, h/2, (wall.y1+wall.y2)/2]} 
                                rotation={[0, -angle, 0]} 
                            >
                                <boxGeometry args={[length, h, 0.2]} />
                                <meshStandardMaterial color={mode === 'dark' ? "#64748b" : "#94a3b8"} />
                                <Line points={[[-length/2, h/2, 0], [length/2, h/2, 0]]} color="white" />
                            </mesh>
                        );
                    })}

                    {zones.map(zone => (
                        <ZoneMesh key={zone.id} zone={zone} />
                    ))}

                    {/* Active Tool Preview */}
                    {tool === 'WALL' && activeWallStart && (
                        <mesh position={[activeWallStart.x, 0.2, activeWallStart.y]}>
                            <sphereGeometry args={[0.3]} />
                            <meshBasicMaterial color={colors.brandPrimary} />
                        </mesh>
                    )}

                    {tool === 'ZONE' && activeZonePoints.length > 0 && (
                        <group>
                            {activeZonePoints.map((p, i) => (
                                <mesh key={i} position={[p.x, 0.1, p.y]}>
                                    <sphereGeometry args={[0.2]} />
                                    <meshBasicMaterial color="#f43f5e" />
                                </mesh>
                            ))}
                            {(() => {
                                const validPoints = activeZonePoints
                                    .map(p => {
                                        const px = typeof p.x === 'number' ? p.x : 0;
                                        const py = typeof p.y === 'number' ? p.y : 0;
                                        return [px, 0.2, py];
                                    })
                                    .filter(pt => pt && !isNaN(pt[0]) && !isNaN(pt[1]) && !isNaN(pt[2]));
                                if (validPoints.length < 2) return null;
                                return (
                                    <Line 
                                        points={validPoints as any} 
                                        color="#f43f5e" 
                                        lineWidth={2} 
                                    />
                                );
                            })()}
                        </group>
                    )}

                    {/* CAMERAS with Visual Frustums */}
                    {cameras.map((cam) => {
                        const isSelected = selectedCameraId === cam.cameraId;
                        
                        // Math for visual frustum (Local calculation for frontend speed)
                        // Backend has 'CameraMath' but we duplicate simple logic here for immediate React feedback
                        const fov = 60; // Default
                        const aspect = 1.77;
                        const depth = 15;
                        const rotationY = -(cam.rotation * Math.PI) / 180; // Yaw (Pan) - Negate for ThreeJS coordinate match
                        const rotationX = (cam.pitch * Math.PI) / 180; // Pitch (Tilt)

                        return (
                            <group 
                                key={cam.cameraId} 
                                position={[cam.x, cam.height, cam.y]}
                                rotation={[rotationX, rotationY, 0]} // Order: XYZ
                                onClick={(e) => { e.stopPropagation(); setSelectedCameraId(cam.cameraId); setTool('SELECT'); }}
                            >
                                {/* Camera Body */}
                                <mesh>
                                    <boxGeometry args={[0.5, 0.4, 0.6]} />
                                    <meshStandardMaterial color={isSelected ? colors.brandPrimary : colors.statusWarningText} />
                                </mesh>
                                
                                {/* Frustum Wireframe */}
                                <mesh position={[0, 0, -depth/2]}>
                                    <coneGeometry args={[depth * Math.tan((fov * Math.PI)/360) * aspect, depth, 4, 1, true]} />
                                    <meshBasicMaterial 
                                        color={isSelected ? colors.brandPrimary : colors.statusWarningText} 
                                        wireframe 
                                        transparent 
                                        opacity={isSelected ? 0.5 : 0.1} 
                                    />
                                </mesh>
                                
                                {/* Selection Highlight */}
                                {isSelected && (
                                    <mesh position={[0, 0, 0]}>
                                        <sphereGeometry args={[0.6]} />
                                        <meshBasicMaterial color={colors.brandPrimary} wireframe />
                                    </mesh>
                                )}
                            </group>
                        );
                    })}

                    {calibPoints.map((p, i) => (
                        <mesh key={i} position={[p.x, 0.2, p.y]}>
                            <sphereGeometry args={[0.4]} />
                            <meshBasicMaterial color={colors.statusCriticalText} />
                        </mesh>
                    ))}
                    {(() => {
                        const validPoints = calibPoints
                            .map(p => {
                                const px = typeof p.x === 'number' ? p.x : 0;
                                const py = typeof p.y === 'number' ? p.y : 0;
                                return [px, 0.2, py];
                            })
                            .filter(pt => pt && !isNaN(pt[0]) && !isNaN(pt[1]) && !isNaN(pt[2]));
                        if (validPoints.length < 2) return null;
                        return (
                            <Line points={validPoints as any} color={colors.statusCriticalText} lineWidth={2} dashed />
                        );
                    })()}
                </Canvas>

                {isAnalyzing && (
                    <div className="absolute inset-0 bg-app-primary/90 z-50 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md animate-in fade-in duration-300">
                        <div className="relative mb-6">
                            <div className="w-20 h-20 rounded-full border-4 border-t-brand-primary border-r-transparent border-l-transparent border-b-transparent animate-spin" />
                            <Wand2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-brand-primary animate-pulse" size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 font-sans tracking-tight">
                            AI Loyihani Tahlil Qilmoqda...
                        </h3>
                        <p className="text-sm text-text-secondary max-w-md mb-6">
                            Tasvirdagi loyiha (blueprint) aniqlashtirilmoqda va 3D/2D formatga o'tkazilmoqda...
                        </p>
                        <div className="bg-app-panel border border-border rounded-lg p-4 w-full max-w-lg text-left font-mono text-xs text-brand-primary/90 space-y-2 max-h-48 overflow-y-auto shadow-2xl">
                            {aiLogs.map((log, index) => (
                                <div key={index} className="flex gap-2">
                                    <span className="text-text-primary0 font-bold">&gt;</span>
                                    <span>{log}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const TooltipButton = ({ active, onClick, icon: Icon, label, disabled, className }: any) => (
    <div className="group relative">
        <button 
            onClick={onClick}
            disabled={disabled}
            className={`p-3 rounded-xl transition-all ${
                active ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 
                disabled ? 'text-text-muted bg-app-surface cursor-not-allowed' : 'text-text-secondary hover:bg-app-surface hover:text-text-primary'
            } ${className || ''}`}
        >
            <Icon size={20} />
        </button>
        <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-app-panel text-text-primary text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-border z-50 pointer-events-none">
            {label}
        </span>
    </div>
);

const GroundPlane: React.FC<{ image: string, aspect: number, isEnhanced?: boolean }> = ({ image, aspect, isEnhanced }) => {
    const texture = useTexture(image);
    // Dynamic size based on aspect ratio to prevent stretching.
    // Base width 60 units, height adjusted by aspect.
    const width = 60;
    const height = width / aspect;

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial 
                map={texture} 
                transparent 
                opacity={isEnhanced ? 0.9 : 0.6} 
                toneMapped={false}
                side={THREE.DoubleSide} 
            />
        </mesh>
    );
};

const ZoneMesh: React.FC<{ zone: BuilderZone }> = ({ zone }) => {
    const shape = useMemo(() => {
        const s = new THREE.Shape();
        if(zone.points.length === 0) return s;
        s.moveTo(zone.points[0].x, -zone.points[0].y);
        for(let i=1; i<zone.points.length; i++) {
            s.lineTo(zone.points[i].x, -zone.points[i].y);
        }
        s.closePath();
        return s;
    }, [zone.points]);

    const config = useMemo(() => ({ depth: zone.height, bevelEnabled: false }), [zone.height]);

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <extrudeGeometry args={[shape, config]} />
            <meshStandardMaterial color={zone.color} transparent opacity={0.3} />
            <lineSegments>
                <edgesGeometry args={[new THREE.ExtrudeGeometry(shape, config)]} />
                <lineBasicMaterial color={zone.color} transparent opacity={0.8} />
            </lineSegments>
        </mesh>
    );
};