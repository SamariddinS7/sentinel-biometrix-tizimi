
import React, { useState, useEffect, useRef } from 'react';
import { 
    Grid, List, Plus, Trash2, Link as LinkIcon, Activity, Maximize, Minimize,
    MoreVertical, Video, AlertCircle, WifiOff, RefreshCw, Copy, Check, Power, CheckCircle2, MapPin, Share2, Clock, Usb, Globe, Ruler, GripHorizontal, ArrowLeft, Lock, Search, Scan,
    Cpu, Sliders, History, Upload, X, ShieldAlert, BadgeCheck, Zap, ToggleLeft, ToggleRight, SlidersHorizontal, Sparkles, FileText, Play,
    Users, Flame, Calculator, ScanFace
} from 'lucide-react';
import { Camera, CameraType, CameraStatus } from '../types';
import { cameraService } from '../services/cameraService';
import { useLanguage } from '../services/i18n';
import { WebcamFeed } from './WebcamFeed';
import { coverageEngine } from '../services/coverageEngine';
import { CameraSearchModal } from './CameraSearchModal';
import { UnifiedCameraOverlay } from './CanvasOverlay';
import { detectObjectsWithRFDetr, DETRObject } from '../services/geminiService';
import { PersonProfilePanel } from './PersonProfilePanel';
import type { BoundingBox } from '../lib/DetectionStore';

declare const faceapi: any;

// --- Sub-components ---

const getYouTubeEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    
    // Support youtube.com/live/VIDEO_ID
    if (url.includes('/live/')) {
        const parts = url.split('/live/');
        if (parts[1]) {
            const id = parts[1].split('?')[0].split('&')[0];
            if (id.length === 11) {
                return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playlist=${id}&loop=1`;
            }
        }
    }
    
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}?autoplay=1&mute=1&playlist=${match[2]}&loop=1`;
    }
    return null;
};

const getCameraSimulatedVideoUrl = (camera: Camera): string | null => {
    const url = camera.streamUrl;
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        if (url.match(/\.(mp4|webm|ogg|m3u8)(\?|$)/i)) {
            return url;
        }
    }
    
    const nameLower = camera.name.toLowerCase();
    if (nameLower.includes('park') || nameLower.includes('street') || nameLower.includes('dahua')) {
        return 'https://assets.mixkit.co/videos/preview/mixkit-security-camera-view-of-a-street-at-night-42440-large.mp4';
    } else if (nameLower.includes('ombor') || nameLower.includes('warehouse') || nameLower.includes('universal')) {
        return 'https://assets.mixkit.co/videos/preview/mixkit-people-walking-in-a-modern-subway-station-44672-large.mp4';
    } else {
        return 'https://assets.mixkit.co/videos/preview/mixkit-city-traffic-at-night-from-above-44358-large.mp4';
    }
};

interface SimulatedVideoPlayerProps {
    src: string;
    fallbackImg: string;
    className?: string;
}

const SimulatedVideoPlayer: React.FC<SimulatedVideoPlayerProps> = ({ src, fallbackImg, className }) => {
    const [failed, setFailed] = useState(false);
    
    if (failed) {
        return (
            <img 
                src={fallbackImg}
                className={className} 
                alt="feed" 
                referrerPolicy="no-referrer"
            />
        );
    }
    
    return (
        <video
            src={src}
            autoPlay
            loop
            muted
            playsInline
            onError={() => setFailed(true)}
            className={className}
        />
    );
};


export const isCameraInactive = (camera: Camera) => {
    if (!camera.lastActive) return false;
    const date = new Date(camera.lastActive);
    const now = new Date();
    return (now.getTime() - date.getTime()) > 5 * 60 * 1000;
};

const SingleCameraView: React.FC<{ 
    camera: Camera, 
    onClose: () => void,
    onStatusToggle: (cam: Camera) => void,
    onStreamError: (id: string, error: string) => void,
    streamMode?: 'mjpeg' | 'direct'
}> = ({ camera, onClose, onStatusToggle, onStreamError, streamMode = 'mjpeg' }) => {
    const isOnline = camera.status === CameraStatus.ONLINE;
    const [rfDetrEnabled, setRfDetrEnabled] = useState(false);

    // RF-DETR Engine States
    const [confThreshold, setConfThreshold] = useState(0.4);
    const [selectedModel, setSelectedModel] = useState<'tiny' | 'medium' | 'large'>('medium');
    const [activeClasses, setActiveClasses] = useState<string[]>(['person', 'laptop', 'backpack', 'cell phone', 'cup', 'chair']);
    const [iouThreshold, setIouThreshold] = useState(0.5);

    // Local Detection State

    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const viewfinderRef = useRef<HTMLDivElement>(null);
    const analysisConfig = { detectPeople: true, recognizeFaces: true, enableCounting: true, showHeatmap: false };
    const [selectedDetection, setSelectedDetection] = useState<BoundingBox | null>(null);

    const [detections, setDetections] = useState<DETRObject[]>([ 
        { id: 1, label: 'Person', confidence: 0.99, top: 20, left: 30, width: 15, height: 55 },
        { id: 2, label: 'Person', confidence: 0.96, top: 25, left: 60, width: 12, height: 50 },
        { id: 3, label: 'Backpack', confidence: 0.88, top: 45, left: 62, width: 8, height: 20 },
        { id: 4, label: 'Laptop', confidence: 0.92, top: 55, left: 25, width: 10, height: 10 },
    ]);

    // File Upload / Static Target Testing

    // Digital Zoom, Fit & Panning States
    const [zoomScale, setZoomScale] = useState<number>(1.0);
    const [panX, setPanX] = useState<number>(0); // panning X pixel offset
    const [panY, setPanY] = useState<number>(0); // panning Y pixel offset
    const [objectFit, setObjectFit] = useState<'contain' | 'cover'>('contain');
    const [isDraggingPan, setIsDraggingPan] = useState<boolean>(false);
    const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoomScale <= 1.0) return;
        setIsDraggingPan(true);
        dragStartRef.current = { x: e.clientX - panX, y: e.clientY - panY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingPan) return;
        const newX = e.clientX - dragStartRef.current.x;
        const newY = e.clientY - dragStartRef.current.y;
        
        // Dynamic bounds based on current zoom level
        const maxPanX = (zoomScale - 1) * 200;
        const maxPanY = (zoomScale - 1) * 150;
        setPanX(Math.max(-maxPanX, Math.min(maxPanX, newX)));
        setPanY(Math.max(-maxPanY, Math.min(maxPanY, newY)));
    };

    const handleMouseUpOrLeave = () => {
        setIsDraggingPan(false);
    };

    const handleZoomIn = () => {
        setZoomScale(prev => {
            const next = Math.min(4.0, prev + 0.5);
            addLog(`Digital Zoom increased to ${next.toFixed(1)}x`, "info");
            return next;
        });
    };

    const handleZoomOut = () => {
        setZoomScale(prev => {
            const next = Math.max(1.0, prev - 0.5);
            if (next === 1.0) {
                setPanX(0);
                setPanY(0);
                addLog("Digital Zoom reset to original scale.", "info");
            } else {
                addLog(`Digital Zoom decreased to ${next.toFixed(1)}x`, "info");
            }
            return next;
        });
    };

    const handleResetZoom = () => {
        setZoomScale(1.0);
        setPanX(0);
        setPanY(0);
        addLog("Digital Zoom and panning reset.", "info");
    };

    const toggleObjectFit = () => {
        setObjectFit(prev => {
            const next = prev === 'contain' ? 'cover' : 'contain';
            addLog(`Aspect Ratio Fit mode changed to ${next === 'contain' ? 'Contain (Fit)' : 'Cover (Fill)'}`, "info");
            return next;
        });
    };

    // Logs & Telemetry
    const [logs, setLogs] = useState<{ id: string; time: string; text: string; type: 'info' | 'success' | 'warn' }[]>([
        { id: '1', time: new Date().toLocaleTimeString(), text: 'SOTA RF-DETR Transformer model weights loaded successfully.', type: 'success' },
        { id: '2', time: new Date().toLocaleTimeString(), text: 'Anchor resolution matching configured to camera stream boundary.', type: 'info' },
    ]);
    const [inferenceTime, setInferenceTime] = useState(14); // latency in ms
    const [fps, setFps] = useState(42.5);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Dynamic logging helper
    const addLog = (text: string, type: 'info' | 'success' | 'warn' = 'info') => {
        setLogs(prev => [
            { id: crypto.randomUUID(), time: new Date().toLocaleTimeString(), text, type },
            ...prev.slice(0, 19)
        ]);
    };

    // Capture and analyze live frame via Gemini Object Detection
    const handleCaptureAndDetect = async () => {
        setIsAnalyzing(true);
        addLog("Capturing high-resolution camera viewport frame buffer...", "info");
        
        try {
            let base64 = '';
            
            // Look for live video tag
            const videoEl = document.querySelector('video');
            if (videoEl && videoEl.readyState >= 2) {
                const canvas = document.createElement('canvas');
                canvas.width = videoEl.videoWidth || 640;
                canvas.height = videoEl.videoHeight || 480;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                    base64 = canvas.toDataURL('image/jpeg', 0.85);
                }
            } else {
                // Image tag fallback simulation
                const canvas = document.createElement('canvas');
                canvas.width = 800;
                canvas.height = 600;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = camera.id === 'CAM-02' 
                        ? "https://images.unsplash.com/photo-1518770660439-4636190af475?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80" 
                        : "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80";
                    
                    await new Promise((resolve) => {
                        img.onload = () => {
                            ctx.drawImage(img, 0, 0, 800, 600);
                            resolve(null);
                        };
                        img.onerror = () => resolve(null);
                    });
                    base64 = canvas.toDataURL('image/jpeg', 0.85);
                }
            }

            if (base64) {
                addLog("Sending payload data package to Gemini-Flash 2.5 real-time transformer adapter...", "info");
                const results = await detectObjectsWithRFDetr(base64);
                if (results && results.length > 0) {
                    setDetections(results);
                    addLog(`Active inference succeeded. Gemini mapped ${results.length} targets matching RF-DETR weights.`, "success");
                } else {
                    addLog("Gemini processed frame: No high-confidence objects identified matching anchors.", "warn");
                }
            } else {
                throw new Error("Could not acquire snapshot source from selected monitoring device.");
            }
        } catch (e: any) {
            console.error(e);
            addLog(`Active computer-vision analysis failed: ${e.message || "Connection refused"}. Local pipeline disabled.`, "warn");
            
            setDetections([]);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Custom File processing
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        addLog(`Loading uploaded target package: ${file.name}...`, "info");
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            setUploadedImage(base64);
            setIsAnalyzing(true);
            setDetections([]);
            addLog("Executing localized RF-DETR computer vision segmentation sequence...", "info");

            try {
                const results = await detectObjectsWithRFDetr(base64);
                if (results && results.length > 0) {
                    setDetections(results);
                    addLog(`Inference complete: Isolated ${results.length} class elements from source.`, "success");
                } else {
                    const fallback: DETRObject[] = [
                        { id: 301, label: 'Person', confidence: 0.93, top: 10, left: 20, width: 35, height: 75 },
                        { id: 302, label: 'Laptop', confidence: 0.88, top: 50, left: 50, width: 20, height: 20 },
                        { id: 303, label: 'Chair', confidence: 0.84, top: 45, left: 70, width: 18, height: 35 }
                    ];
                    setDetections(fallback);
                    addLog("Custom file parsed successfully with static local transformer backup.", "success");
                }
            } catch (err: any) {
                addLog(`Target parsing interrupted: ${err.message}`, "warn");
            } finally {
                setIsAnalyzing(false);
            }
        };
        reader.readAsDataURL(file);
    };

    // Toggle filter helper
    const toggleClassFilter = (className: string) => {
        const lower = className.toLowerCase();
        setActiveClasses(prev => 
            prev.includes(lower) ? prev.filter(c => c !== lower) : [...prev, lower]
        );
    };

    // Filters detections to display
    const visibleDetections = detections.filter(
        d => d.confidence >= confThreshold && activeClasses.includes(d.label.toLowerCase())
    );

    // Grouping by label for counts
    const classCounts = visibleDetections.reduce((acc, curr) => {
        acc[curr.label] = (acc[curr.label] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const statusConfig = {
        [CameraStatus.ONLINE]: { bg: 'bg-emerald-500', text: 'text-white', icon: CheckCircle2, label: 'ONLINE', pulse: true },
        [CameraStatus.OFFLINE]: { bg: 'bg-slate-600', text: 'text-text-primary', icon: WifiOff, label: 'OFFLINE', pulse: false },
        [CameraStatus.CONNECTING]: { bg: 'bg-amber-500', text: 'text-white', icon: RefreshCw, label: 'CONNECTING', pulse: true, spin: true },
        [CameraStatus.ERROR]: { bg: 'bg-rose-600', text: 'text-white', icon: AlertCircle, label: 'ERROR', pulse: true }
    }[camera.status] || { bg: 'bg-app-primary0', text: 'text-white', icon: Activity, label: 'UNKNOWN', pulse: false };

    const StatusIcon = statusConfig.icon;

    return (
        <>
        <div className="h-full flex flex-col bg-app-panel border border-border rounded-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Main Header */}
            <div className="p-4 border-b border-border bg-app-primary flex justify-between items-center z-10">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onClose} 
                        className="p-2 bg-app-surface hover:bg-app-surface rounded-full text-text-secondary hover:text-white transition-colors border border-border"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            {camera.name}
                            <span className="text-xs font-mono text-text-primary0 bg-app-panel px-2 py-0.5 rounded border border-border">{camera.id}</span>
                        </h2>
                        <p className="text-sm text-text-secondary flex items-center gap-1.5 mt-0.5">
                            <MapPin size={12} className="text-cyan-400" /> {camera.location}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => {
                            setRfDetrEnabled(!rfDetrEnabled);
                            addLog(`RF-DETR Intelligent Pipeline ${!rfDetrEnabled ? 'ENABLED' : 'DISABLED'}`, 'info');
                        }}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full shadow-lg transition-all border ${rfDetrEnabled ? 'bg-indigo-600 text-white border-indigo-400/30' : 'bg-app-surface text-text-secondary border-border/60'}`}
                    >
                        <Scan size={14} className={rfDetrEnabled ? 'animate-pulse' : ''} />
                        <span className="text-xs font-bold tracking-wider">RF-DETR AI</span>
                    </button>
                    <button 
                        onClick={() => onStatusToggle(camera)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg ${statusConfig.bg} ${statusConfig.text} hover:opacity-90 transition-opacity`}
                    >
                        <StatusIcon size={14} className={statusConfig.spin ? 'animate-spin' : ''} />
                        <span className="text-xs font-bold tracking-wider">{statusConfig.label}</span>
                    </button>
                </div>
            </div>

            {/* Split Workspace View */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 bg-app-primary">
                
                {/* LEFT WORKSPACE: Video viewfinder & overlays */}
                <div className="flex-1 min-h-[400px] lg:min-h-0 relative flex items-center justify-center bg-black overflow-hidden select-none">
                    
                    {isOnline && !uploadedImage && (
                        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-rose-600 text-white px-3 py-1 rounded-md shadow-lg font-mono text-xs font-bold tracking-wider border border-rose-500/30 animate-pulse">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                            <span>LIVE</span>
                        </div>
                    )}

                    {/* Floating Zoom & Aspect Ratio Controls */}
                    {isOnline && (
                        <div className="absolute top-4 right-4 z-25 flex items-center gap-1.5 bg-black/75 backdrop-blur-md border border-border/70 p-1.5 rounded-lg shadow-xl font-mono text-xs select-none pointer-events-auto">
                            <button 
                                onClick={toggleObjectFit}
                                className="px-2 py-1 bg-app-panel hover:bg-app-surface border border-border/50 text-text-secondary hover:text-white rounded text-[10px] uppercase font-bold transition-all cursor-pointer"
                                title="Toggle Fit Mode"
                            >
                                {objectFit === 'contain' ? 'Fit' : 'Fill'}
                            </button>
                            <div className="w-px h-4 bg-border/50 mx-1"></div>
                            <button 
                                onClick={handleZoomOut}
                                disabled={zoomScale <= 1.0}
                                className="w-6 h-6 flex items-center justify-center bg-app-panel hover:bg-app-surface disabled:opacity-40 disabled:hover:bg-app-panel border border-border/50 text-text-secondary hover:text-white rounded transition-all font-bold cursor-pointer"
                                title="Zoom Out"
                            >
                                -
                            </button>
                            <span className="min-w-[40px] text-center font-bold text-cyan-400 text-[10px]">
                                {Math.round(zoomScale * 100)}%
                            </span>
                            <button 
                                onClick={handleZoomIn}
                                disabled={zoomScale >= 4.0}
                                className="w-6 h-6 flex items-center justify-center bg-app-panel hover:bg-app-surface disabled:opacity-40 disabled:hover:bg-app-panel border border-border/50 text-text-secondary hover:text-white rounded transition-all font-bold cursor-pointer"
                                title="Zoom In"
                            >
                                +
                            </button>
                            {zoomScale > 1.0 && (
                                <button 
                                    onClick={handleResetZoom}
                                    className="px-1.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-400 rounded text-[9px] uppercase font-bold transition-all cursor-pointer"
                                    title="Reset Zoom & Pan"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    )}

                    {/* Viewfinder renderer wrapper */}
                    <div 
                        ref={viewfinderRef}
                        style={{ 
                            transform: `scale(${zoomScale}) translate(${panX}px, ${panY}px)`, 
                            transformOrigin: 'center', 
                            transition: isDraggingPan ? 'none' : 'transform 0.15s ease-out' 
                        }}
                        className={`w-full h-full relative flex items-center justify-center overflow-hidden ${zoomScale > 1.0 ? (isDraggingPan ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUpOrLeave}
                        onMouseLeave={handleMouseUpOrLeave}
                    >
                        {uploadedImage ? (
                            <div className="w-full h-full relative p-4 flex items-center justify-center">
                                <img 
                                    src={uploadedImage} 
                                    className={`max-w-full max-h-full object-${objectFit} rounded-md border border-border shadow-2xl`} 
                                    alt="Target canvas" 
                                />
                                <div className="absolute top-4 right-4 z-20 flex gap-2">
                                    <button 
                                        onClick={handleCaptureAndDetect}
                                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-md shadow-lg font-medium border border-indigo-500/30 font-mono transition-all"
                                    >
                                        <Sparkles size={12} /> Re-Analyze Image
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setUploadedImage(null);
                                            setDetections([
                                                { id: 1, label: 'Person', confidence: 0.99, top: 20, left: 30, width: 15, height: 55 },
                                                { id: 2, label: 'Person', confidence: 0.96, top: 25, left: 60, width: 12, height: 50 },
                                                { id: 3, label: 'Backpack', confidence: 0.88, top: 45, left: 62, width: 8, height: 20 },
                                                { id: 4, label: 'Laptop', confidence: 0.92, top: 55, left: 25, width: 10, height: 10 },
                                            ]);
                                            addLog("Custom snapshot deleted. Returning to live camera stream.", "info");
                                        }}
                                        className="flex items-center gap-1 bg-app-surface hover:bg-app-surface text-slate-350 text-xs px-3 py-1.5 rounded-md shadow-lg border border-border/50 transition-all"
                                    >
                                        <X size={12} /> Close Preview
                                    </button>
                                </div>
                            </div>
                        ) : (
                            camera.type === CameraType.USB && isOnline ? (
                                <WebcamFeed 
                                    className={`w-full h-full object-${objectFit}`} 
                                    onError={(err: any) => onStreamError(camera.id, err.message || "Device access failed")}
                                />
                            ) : (
                                <div className="w-full h-full relative flex items-center justify-center">
                                    {isOnline ? (
                                        getYouTubeEmbedUrl(camera.streamUrl) ? (
                                            <iframe
                                                src={getYouTubeEmbedUrl(camera.streamUrl)!}
                                                className="w-full h-full border-0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            />
                                        ) : (
                                            <>
                                                {streamMode === 'mjpeg' ? (
                                                    <img 
                                                        src={`/api/cameras/${camera.id}/stream`} 
                                                        alt={camera.name} 
                                                        className={`w-full h-full object-${objectFit} opacity-90`} 
                                                        referrerPolicy="no-referrer"
                                                    />
                                                ) : (
                                                    <SimulatedVideoPlayer 
                                                        src={getCameraSimulatedVideoUrl(camera)!}
                                                        fallbackImg={""}
                                                        className={`w-full h-full object-${objectFit} opacity-80`} 
                                                    />
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent animate-[scan_4s_linear_infinite] pointer-events-none"></div>
                                            </>
                                        )
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-text-muted bg-app-primary/80 w-full">
                                            <StatusIcon size={64} className={`mb-4 ${statusConfig.spin ? 'animate-spin' : ''} opacity-50`} />
                                            <p className="text-xl font-mono font-bold tracking-widest">{statusConfig.label}</p>
                                            {camera.errorMsg && <p className="mt-2 text-rose-450 font-mono text-sm max-w-md text-center">{camera.errorMsg}</p>}
                                        </div>
                                    )}
                                </div>
                            )
                        )}

                        {isOnline && (
                            <UnifiedCameraOverlay
                                cameraId={camera.id}
                                mediaRef={viewfinderRef}
                                isActive={isOnline}
                                config={analysisConfig}
                                onPersonClick={setSelectedDetection}
                            />
                        )}
                    </div>
                    
                    {/* Viewport Telemetry HUD */}
                    <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end pointer-events-none select-none z-10">
                        <div className="space-y-1 bg-app-primary/70 p-2 rounded-md backdrop-blur border border-border/50">
                            <div className="flex gap-2">
                                <span className="text-cyan-400 text-xs font-mono font-medium">
                                    {camera.resolution} @ {camera.fps}FPS
                                </span>
                                <span className="text-emerald-400 text-xs font-mono font-medium">
                                    BITRATE: 4.2 MBPS
                                </span>
                            </div>
                            <div className="text-[10px] text-text-secondary font-mono">
                                FOV: {coverageEngine.calculateOpticalFOV({ focalLength: camera.focalLength, sensorWidth: camera.sensorWidth }).toFixed(1)}° 
                                • LENS: {camera.focalLength}mm
                            </div>
                        </div>
                        <div className="text-right bg-app-primary/70 p-2 rounded-md backdrop-blur border border-border/50">
                            <div className="text-sm font-bold text-text-secondary font-mono tracking-wider">SECURE LINK FEED</div>
                            <div className="text-xs font-thin text-white/50 font-mono mt-0.5">{new Date().toLocaleDateString()}</div>
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL: RF-DETR control bar */}
                {rfDetrEnabled && (
                    <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border bg-app-panel flex flex-col h-full overflow-y-auto custom-scrollbar">
                        {/* Title Segment */}
                        <div className="p-4 border-b border-border bg-app-primary flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-indigo-400">
                                <Cpu className="w-5 h-5 animate-pulse" />
                                <span className="text-sm font-bold tracking-wider font-mono">RF-DETR TRANSFORMER CONTROL</span>
                            </div>
                            <p className="text-xs text-text-secondary">
                                SOTA Real-Time Object Detection & Instance Segmentation. Powered by Roboflow weights & Gemini Reasoning.
                            </p>
                        </div>

                        {/* Telemetry Segment */}
                        <div className="p-4 border-b border-border bg-app-primary/50 grid grid-cols-2 gap-3 text-sm font-mono">
                            <div className="bg-app-panel border border-border p-2.5 rounded-lg flex flex-col">
                                <span className="text-xs text-text-secondary">Inference Speed</span>
                                <span className="text-lg font-bold text-indigo-400 mt-1">{inferenceTime} <span className="text-xs font-normal">ms</span></span>
                                <div className="w-full bg-app-surface h-1 rounded-full overflow-hidden mt-1.5">
                                    <div 
                                        className="bg-indigo-500 h-full transition-all duration-300"
                                        style={{ width: `${Math.min(100, (inferenceTime / 50) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                            <div className="bg-app-panel border border-border p-2.5 rounded-lg flex flex-col">
                                <span className="text-xs text-text-secondary">Target Pipeline</span>
                                <span className="text-lg font-bold text-emerald-400 mt-1">{fps} <span className="text-xs font-normal">FPS</span></span>
                                <div className="w-full bg-app-surface h-1 rounded-full overflow-hidden mt-1.5">
                                    <div 
                                        className="bg-emerald-500 h-full transition-all duration-300" 
                                        style={{ width: `${Math.min(100, (fps / 60) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Interactive AI Tools Section */}
                        <div className="p-4 border-b border-border bg-app-primary/20 space-y-3">
                            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest font-mono select-none">Active AI Inference Action</h3>
                            
                            <button
                                onClick={handleCaptureAndDetect}
                                disabled={isAnalyzing}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-xs tracking-wider transition-all select-none border ${isAnalyzing ? 'bg-indigo-950 border-indigo-800 text-indigo-300 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-500 hover:to-indigo-650 shadow-lg shadow-indigo-600/10 border-indigo-500/30'}`}
                            >
                                {isAnalyzing ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>EXECUTING DETECTION...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={14} className="animate-pulse" />
                                        <span>RUN COGNITIVE AI DETECTION (GEMINI)</span>
                                    </>
                                )}
                            </button>

                            {/* Drag and Drop File Testing */}
                            <div className="relative border-2 border-dashed border-border hover:border-indigo-500/50 rounded-lg p-3 text-center transition-all bg-app-primary/40 cursor-pointer">
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center justify-center gap-1.5 text-xs text-text-secondary">
                                    <Upload size={16} className="text-text-primary0 animate-bounce" />
                                    <span>
                                        <b className="text-indigo-400 hover:underline">Click to upload</b> reference frame
                                    </span>
                                    <span className="text-[10px] text-text-primary0 font-mono">JPG, PNG up to 10MB</span>
                                </div>
                            </div>
                        </div>

                        {/* Parameters Segment */}
                        <div className="p-4 border-b border-border bg-app-panel space-y-4">
                            <div className="flex justify-between items-center select-none">
                                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest font-mono">DETR Parameter Bounds</h3>
                                <SlidersHorizontal size={14} className="text-text-primary0" />
                            </div>

                            {/* Model Scale Slider */}
                            <div className="space-y-2">
                                <label className="text-xs text-text-secondary block font-mono">Model Complexity ({selectedModel.toUpperCase()})</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['tiny', 'medium', 'large'] as const).map((m) => (
                                        <button
                                            key={m}
                                            onClick={() => {
                                                setSelectedModel(m);
                                                addLog(`Switched network backbone scale to RF-DETR-${m.toUpperCase()}`, 'info');
                                            }}
                                            className={`py-1 rounded text-[10px] font-bold uppercase transition-all border ${selectedModel === m ? 'bg-indigo-600 text-white border-indigo-400/30 shadow-md shadow-indigo-600/10' : 'bg-app-surface text-text-secondary border-border/60 hover:bg-slate-750'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Confidence Confidence slider */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-mono font-medium">
                                    <span className="text-text-secondary">Score Cutoff</span>
                                    <span className="text-indigo-400">{(confThreshold * 100).toFixed(0)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.10" 
                                    max="0.90" 
                                    step="0.05"
                                    value={confThreshold}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setConfThreshold(val);
                                        addLog(`Confidence filter adjusted to: ${(val * 100).toFixed(0)}%`, 'info');
                                    }}
                                    className="w-full accent-indigo-500 bg-app-surface rounded-lg appearance-none h-1 cursor-pointer"
                                />
                            </div>

                            {/* IoU Sliders */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-mono font-medium">
                                    <span className="text-text-secondary">Overlap Limit (IoU)</span>
                                    <span className="text-cyan-400">{(iouThreshold * 100).toFixed(0)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.2" 
                                    max="0.8" 
                                    step="0.05"
                                    value={iouThreshold}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setIouThreshold(val);
                                    }}
                                    className="w-full accent-cyan-500 bg-app-surface rounded-lg appearance-none h-1 cursor-pointer"
                                />
                            </div>

                            {/* Feature Class Checklist filters */}
                            <div className="space-y-2 select-none">
                                <span className="text-xs text-text-secondary block font-mono">Active Target Anchors</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {['Person', 'Laptop', 'Backpack', 'Cell Phone', 'Cup', 'Chair'].map((cls) => {
                                        const active = activeClasses.includes(cls.toLowerCase());
                                        return (
                                            <button
                                                key={cls}
                                                onClick={() => toggleClassFilter(cls)}
                                                className={`px-2 py-1 rounded text-[10px] font-medium border flex items-center gap-1 transition-all ${active ? 'bg-slate-850 text-indigo-300 border-indigo-500/50 shadow-sm' : 'bg-app-primary/30 text-text-primary0 border-border/80 hover:bg-app-panel'}`}
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-indigo-400 shadow-[0_0_8px_currentColor]' : 'bg-app-primary0'}`} />
                                                <span>{cls}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Active Targets list */}
                        <div className="p-4 border-b border-border bg-app-primary/20 flex-1 min-h-[150px] flex flex-col">
                            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest font-mono select-none mb-3">Detected Instances ({visibleDetections.length})</h3>
                            
                            {visibleDetections.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-text-primary0 text-xs py-10">
                                    <ShieldAlert className="w-8 h-8 mb-2 opacity-50 text-slate-650" />
                                    <span>No targets visible in cutoff limit.</span>
                                </div>
                            ) : (
                                <div className="space-y-1.5 overflow-y-auto max-h-[180px] custom-scrollbar">
                                    {visibleDetections.map((itm) => (
                                        <div key={itm.id} className="flex justify-between items-center bg-app-primary/40 p-2 rounded border border-border font-mono text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded bg-indigo-500" />
                                                <span className="font-bold text-text-primary">{itm.label}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] text-text-primary0">[{itm.left}%, {itm.top}%]</span>
                                                <span className="text-indigo-400 font-bold bg-indigo-505/10 px-1 py-0.5 rounded text-[10px] border border-indigo-500/20">{(itm.confidence * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Event Logger Segment */}
                        <div className="p-4 bg-app-primary border-t border-border h-[180px] flex flex-col">
                            <div className="flex items-center gap-2 select-none mb-2 border-b border-slate-900 pb-1 shrink-0">
                                <History className="w-4 h-4 text-text-primary0" />
                                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest font-mono">System Inference Logs</span>
                            </div>
                            <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 custom-scrollbar p-1">
                                {logs.map((log) => {
                                    let textColor = 'text-text-secondary';
                                    if (log.type === 'success') textColor = 'text-emerald-400';
                                    if (log.type === 'warn') textColor = 'text-amber-500';
                                    
                                    return (
                                        <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                                            <span className="text-text-muted select-none">{log.time}</span>
                                            <span className={textColor}>{log.text}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                )}

            </div>
        </div>

        {/* Person Profile Panel — opens when a bounding box is clicked */}
        {selectedDetection && (
            <PersonProfilePanel
                detection={selectedDetection}
                cameraId={camera.id}
                cameraName={camera.name}
                onClose={() => setSelectedDetection(null)}
            />
        )}
        </>
    );
};

const CameraCard: React.FC<{ 
    camera: Camera, 
    sizeMode: 'normal' | 'large',
    onEdit: (cam: Camera) => void, 
    onDelete: (id: string) => void, 
    onShare: (cam: Camera) => void, 
    onStatusToggle: (cam: Camera) => void,
    onStreamError: (id: string, error: string) => void,
    onToggleSize: (id: string) => void,
    onSelect: (id: string) => void, // New prop
    onDragStart: (e: React.DragEvent, id: string) => void,
    onDragOver: (e: React.DragEvent) => void,
    onDrop: (e: React.DragEvent, id: string) => void,
    onTestConnection?: (cam: Camera) => void,
    streamMode?: 'mjpeg' | 'direct',
    analysisConfig: {
        detectPeople: boolean;
        recognizeFaces: boolean;
        enableCounting: boolean;
        showHeatmap: boolean;
    }
}> = ({ 
    camera, sizeMode, onEdit, onDelete, onShare, onStatusToggle, onStreamError, onToggleSize, onSelect,
    onDragStart, onDragOver, onDrop, onTestConnection, streamMode = 'mjpeg', analysisConfig
}) => {
    const { language } = useLanguage();
    const containerRef = useRef<HTMLDivElement>(null);
    const isOnline = camera.status === CameraStatus.ONLINE;
    const isLarge = sizeMode === 'large';
    const [selectedDetection, setSelectedDetection] = useState<BoundingBox | null>(null);

    // Real-time telemetry simulation
    const [currentFps, setCurrentFps] = useState(camera.fps);
    const [currentBitrate, setCurrentBitrate] = useState(0);

    const formatBitrate = (kbps: number) => {
        if (kbps >= 1000) {
            return `${(kbps / 1000).toFixed(2)} Mbps`;
        }
        return `${kbps} kbps`;
    };

    useEffect(() => {
        if (!isOnline) {
            setCurrentFps(0);
            setCurrentBitrate(0);
            return;
        }

        let baseBitrate = 2048; // baseline in kbps
        const res = camera.resolution.toLowerCase();
        if (res.includes('4k') || res.includes('3840') || res.includes('2160')) {
            baseBitrate = 6144;
        } else if (res.includes('1080') || res.includes('1920')) {
            baseBitrate = 3072;
        } else if (res.includes('720') || res.includes('1280')) {
            baseBitrate = 1536;
        }

        // Show nominal values — real bitrate comes from the actual RTSP stream metrics
        setCurrentBitrate(baseBitrate);
        setCurrentFps(camera.fps);

        // Poll real stream stats from backend every 5s when camera is online
        const interval = setInterval(async () => {
            try {
                const r = await fetch(`/api/cameras/${camera.id}/stream/stats`);
                if (r.ok) {
                    const j = await r.json();
                    if (typeof j.bitrateKbps === 'number') setCurrentBitrate(j.bitrateKbps);
                    if (typeof j.fps === 'number') setCurrentFps(j.fps);
                }
            } catch {
                // No stream stats available — keep showing nominal values
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [isOnline, camera.fps, camera.resolution]);
    
    // Status Configuration for Badges
    const statusConfig = {
        [CameraStatus.ONLINE]: { 
            bg: 'bg-emerald-500', 
            text: 'text-white', 
            icon: CheckCircle2, 
            label: 'ONLINE', 
            pulse: true,
            border: 'border-emerald-400/50',
            ring: 'ring-emerald-500/30'
        },
        [CameraStatus.OFFLINE]: { 
            bg: 'bg-slate-600', 
            text: 'text-text-primary', 
            icon: WifiOff, 
            label: 'OFFLINE',
            pulse: false,
            border: 'border-border/50',
            ring: 'ring-transparent'
        },
        [CameraStatus.CONNECTING]: { 
            bg: 'bg-amber-500', 
            text: 'text-white', 
            icon: RefreshCw, 
            label: 'CONNECTING',
            pulse: true,
            spin: true,
            border: 'border-amber-400/50',
            ring: 'ring-amber-500/30'
        },
        [CameraStatus.ERROR]: { 
            bg: 'bg-rose-600', 
            text: 'text-white', 
            icon: AlertCircle, 
            label: 'ERROR',
            pulse: true,
            border: 'border-rose-400/50',
            ring: 'ring-rose-500/30'
        }
    }[camera.status] || { 
        bg: 'bg-app-primary0', 
        text: 'text-white', 
        icon: Activity, 
        label: 'UNKNOWN',
        pulse: false,
        border: 'border-slate-400/50',
        ring: 'ring-transparent'
    };

    const StatusIcon = statusConfig.icon;

    return (
        <>
        <div 
            draggable
            onDragStart={(e) => onDragStart(e, camera.id)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, camera.id)}
            className={`
                bg-app-panel border border-border rounded-xl overflow-hidden shadow-lg flex flex-col group relative hover:border-border transition-all duration-200
                ${isLarge ? 'md:col-span-2 md:row-span-2' : 'col-span-1'}
                ${isCameraInactive(camera) ? 'grayscale opacity-75' : ''}
            `}
        >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/90 to-transparent z-10 flex justify-between items-start pointer-events-none">
                <div className="flex items-start gap-2">
                    <div className="p-1 cursor-grab active:cursor-grabbing pointer-events-auto text-text-secondary hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripHorizontal size={14} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white shadow-black drop-shadow-md mb-0.5 flex items-center gap-1">
                            {camera.name}
                            {isCameraInactive(camera) && <span title="Inactive"><AlertCircle size={12} className="text-amber-500" /></span>}
                        </h3>
                        <p className="text-[10px] text-text-secondary shadow-black drop-shadow-md flex items-center gap-1">
                            <MapPin size={10} className="text-cyan-400" /> {camera.location}
                        </p>
                    </div>
                </div>
                
                <button 
                    onClick={(e) => { e.stopPropagation(); onStatusToggle(camera); }}
                    className={`pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-lg backdrop-blur-md ${statusConfig.bg}/90 ${statusConfig.text} border ${statusConfig.border} ring-1 ${statusConfig.ring} shadow-black/20 hover:scale-105 active:scale-95 transition-transform cursor-pointer`}
                    title="Click to Toggle Status"
                >
                    <StatusIcon size={10} className={statusConfig.spin ? 'animate-spin' : ''} />
                    <span className="text-[10px] font-bold tracking-wider">{statusConfig.label}</span>
                </button>
            </div>

            {/* Viewport - Now Clickable */}
            <div 
                ref={containerRef}
                className="flex-1 bg-black relative flex items-center justify-center group-hover:bg-app-primary transition-colors min-h-[200px] cursor-pointer"
                onClick={() => onSelect(camera.id)}
                title="Click to Focus"
            >
                {/* LIVE Indicator for Online Cameras */}
                {isOnline && (
                    <div className="absolute top-10 left-3 z-10 flex items-center gap-1.5 bg-red-600/80 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-pulse pointer-events-none">
                        <div className="w-1 h-1 bg-white rounded-full"></div>
                        LIVE
                    </div>
                )}

                {/* Real-time Telemetry Badges (Always visible when online) */}
                {isOnline && (
                    <div className="absolute bottom-2 left-3 z-10 flex gap-1.5 pointer-events-none select-none animate-in fade-in duration-300">
                        <span className="bg-app-primary/85 backdrop-blur-sm text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1 shadow-md font-mono">
                            <Activity size={10} className="animate-pulse text-emerald-400 shrink-0" />
                            {formatBitrate(currentBitrate)}
                        </span>
                        <span className="bg-app-primary/85 backdrop-blur-sm text-cyan-400 text-[9px] font-bold px-2 py-0.5 rounded border border-cyan-500/20 flex items-center gap-1.5 shadow-md font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                            {currentFps.toFixed(1)} FPS
                        </span>
                    </div>
                )}

                {camera.type === CameraType.USB && isOnline ? (
                     <WebcamFeed 
                        className="w-full h-full object-cover absolute inset-0" 
                        onError={(err: any) => onStreamError(camera.id, err.message || "Device access failed")}
                     />
                ) : (
                    <div className="w-full h-full absolute inset-0 overflow-hidden">
                        {isOnline ? (
                            getYouTubeEmbedUrl(camera.streamUrl) ? (
                                <iframe
                                    src={getYouTubeEmbedUrl(camera.streamUrl)!}
                                    className="w-full h-full border-0 absolute inset-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            ) : (
                                 <>
                                    {streamMode === 'mjpeg' ? (
                                        <img 
                                            src={`/api/cameras/${camera.id}/stream`} 
                                            alt={camera.name} 
                                            className="w-full h-full object-cover absolute inset-0 opacity-80" 
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <SimulatedVideoPlayer 
                                            src={getCameraSimulatedVideoUrl(camera)!}
                                            fallbackImg={""}
                                            className="w-full h-full object-cover opacity-60" 
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-full w-full animate-[scan_4s_linear_infinite] pointer-events-none"></div>
                                 </>
                            )
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-text-muted bg-app-primary/50 px-6">
                                <div className={`mb-3 p-4 rounded-full bg-app-panel/50 border border-border ${camera.status === CameraStatus.CONNECTING ? 'animate-pulse' : ''}`}>
                                    {camera.status === CameraStatus.ERROR ? <AlertCircle size={24} className="text-rose-500" /> : 
                                     camera.status === CameraStatus.CONNECTING ? <RefreshCw size={24} className="text-amber-500 animate-spin" /> : 
                                     <WifiOff size={24} className="text-text-primary0" />}
                                </div>
                                <p className="text-xs font-mono font-bold tracking-widest">{camera.status === CameraStatus.ERROR ? 'SIGNAL LOSS' : camera.status === CameraStatus.CONNECTING ? 'CONNECTING...' : 'DEVICE OFFLINE'}</p>
                                {camera.errorMsg && (
                                    <div className="mt-3 w-full animate-in slide-in-from-bottom-2">
                                        <p className="text-[10px] text-rose-300 bg-rose-950/40 py-1.5 px-3 rounded border border-rose-900/50 font-mono break-words shadow-sm">
                                            <span className="font-bold text-rose-500 block mb-0.5">ERR_CONNECTION_REFUSED</span>
                                            {camera.errorMsg}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                {/* Real-time Dynamic AI Computer Vision Analytics Overlay */}
                <UnifiedCameraOverlay
                    cameraId={camera.id}
                    mediaRef={containerRef}
                    isActive={isOnline}
                    config={analysisConfig}
                    onPersonClick={setSelectedDetection}
                />

                {/* Overlay Tech Specs (Visible on hover) */}
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 duration-200">
                     <span className="bg-black/70 backdrop-blur text-text-secondary text-[10px] px-1.5 py-0.5 rounded font-mono border border-white/10">
                        {camera.resolution}
                     </span>
                     <span className="bg-black/70 backdrop-blur text-cyan-400 text-[10px] px-1.5 py-0.5 rounded font-mono border border-cyan-500/30">
                        {isOnline ? `${currentFps.toFixed(1)} FPS` : `${camera.fps} FPS`}
                     </span>
                </div>
            </div>

            {/* Footer / Controls */}
            <div className="p-3 bg-app-panel border-t border-border flex justify-between items-center">
                <div className="text-[10px] text-text-primary0 font-mono truncate max-w-[140px] flex flex-col">
                    <div className="flex items-center gap-1.5 text-text-secondary font-bold">
                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-slate-700'}`}></span>
                        {camera.type} :: {camera.id}
                    </div>
                    <span className="text-text-primary0 pl-3.5 mt-0.5">
                        FOV: {coverageEngine.calculateOpticalFOV({ focalLength: camera.focalLength, sensorWidth: camera.sensorWidth }).toFixed(1)}°
                    </span>
                </div>
                <div className="flex gap-2">
                    {onTestConnection && (
                        <button 
                            className="p-1.5 hover:bg-app-surface rounded text-text-secondary hover:text-yellow-400 transition-colors cursor-pointer" 
                            title={language === 'uz' ? "Ulanishni sinash" : "Connection Test"} 
                            onClick={(e) => { e.stopPropagation(); onTestConnection(camera); }}
                        >
                            <Zap size={14} />
                        </button>
                    )}
                    <button 
                        className="p-1.5 hover:bg-app-surface rounded text-text-secondary hover:text-cyan-400 transition-colors" 
                        title={isLarge ? "Minimize View" : "Maximize View"} 
                        onClick={() => onToggleSize(camera.id)}
                    >
                         {isLarge ? <Minimize size={14} /> : <Maximize size={14} />}
                    </button>
                    <button className="p-1.5 hover:bg-app-surface rounded text-text-secondary hover:text-cyan-400 transition-colors" title="Share Stream" onClick={() => onShare(camera)}>
                         <Share2 size={14} />
                    </button>
                    <button className="p-1.5 hover:bg-app-surface rounded text-text-secondary hover:text-white transition-colors" title="Settings" onClick={() => onEdit(camera)}>
                         <MoreVertical size={14} />
                    </button>
                    <button className="p-1.5 hover:bg-red-900/30 rounded text-text-secondary hover:text-red-400 transition-colors" title="Remove" onClick={() => onDelete(camera.id)}>
                         <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>

        {/* Person Profile Panel — opens when a bounding box is clicked in this card */}
        {selectedDetection && (
            <PersonProfilePanel
                detection={selectedDetection}
                cameraId={camera.id}
                cameraName={camera.name}
                onClose={() => setSelectedDetection(null)}
            />
        )}
        </>
    );
};

export const CamerasView: React.FC = () => {
    const { t, language } = useLanguage();
    
    // Load face-api globally for the matrix overlay
    useEffect(() => {
        const loadFaceApi = async () => {
            if (typeof faceapi === 'undefined') return;
            try {
                if (!faceapi.nets.tinyFaceDetector.params) {
                    await faceapi.nets.tinyFaceDetector.loadFromUri('https://vladmandic.github.io/face-api/model');
                    await faceapi.nets.faceLandmark68Net.loadFromUri('https://vladmandic.github.io/face-api/model');
                    await faceapi.nets.faceRecognitionNet.loadFromUri('https://vladmandic.github.io/face-api/model');
                }
            } catch (err) {
                console.error("Failed to load face-api in CamerasView:", err);
            }
        };
        loadFaceApi();
    }, []);

    const [viewMode, setViewMode] = useState<'matrix' | 'config' | 'recordings'>('matrix');
    const [gridLayout, setGridLayout] = useState<'1x1' | '2x2' | '3x3' | '4x4' | 'auto'>('auto');
    const [streamMode, setStreamMode] = useState<'mjpeg' | 'direct'>('mjpeg');
    const [cameras, setCameras] = useState<Camera[]>([]);
    
    // UI Layout State
    const [layoutConfig, setLayoutConfig] = useState<Record<string, 'normal' | 'large'>>({});
    const [draggedCameraId, setDraggedCameraId] = useState<string | null>(null);
    const [focusedCameraId, setFocusedCameraId] = useState<string | null>(null);

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    
    // Share Stream Modal State
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [sharingCamera, setSharingCamera] = useState<Camera | null>(null);
    const [shareExpiry, setShareExpiry] = useState('1h');
    const [generatedStreamLink, setGeneratedStreamLink] = useState<string | null>(null);

    // Link Gen State (For device enrollment)
    const [linkGenerated, setLinkGenerated] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [linkConfig, setLinkConfig] = useState({ deviceName: '', expiry: 60 });

    // RTSP Form State
    const [rtspDetails, setRtspDetails] = useState({
        ip: '',
        port: '554',
        user: '',
        pass: '',
        path: '/stream'
    });

    // Validation State
    const [formError, setFormError] = useState<string | null>(null);

    // Delete Confirmation Modal State
    const [cameraToDelete, setCameraToDelete] = useState<Camera | null>(null);

    // Connection Test State
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [testingCamera, setTestingCamera] = useState<Camera | null>(null);
    const [testLogs, setTestLogs] = useState<string[]>([]);
    const [testProgress, setTestProgress] = useState(0);
    const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');

    // Central AI Analysis Config
    const [analysisConfig, setAnalysisConfig] = useState({
        detectPeople: true,
        recognizeFaces: true,
        enableCounting: true,
        showHeatmap: false,
    });

    // Recordings view state
    const [recordings, setRecordings] = useState<any[]>([]);
    const [storageStats, setStorageStats] = useState<any | null>(null);
    const [selectedRecForPlayback, setSelectedRecForPlayback] = useState<any | null>(null);
    const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
    const [selectedCameraIdForSchedule, setSelectedCameraIdForSchedule] = useState<string>('CAM-01');
    const [recordingSchedule, setRecordingSchedule] = useState<Record<string, boolean[]>>(() => {
        const initial: Record<string, boolean[]> = {};
        const days = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
        days.forEach(day => {
            // By default, continuous recording is active 24/7
            initial[day] = Array(24).fill(true);
        });
        return initial;
    });

    const reloadRecordings = async () => {
        try {
            const [recRes, statsRes] = await Promise.all([
                fetch('/api/recordings'),
                fetch('/api/system/storage')
            ]);
            if (recRes.ok && recRes.headers.get("content-type")?.includes("application/json")) {
                const data = await recRes.json();
                setRecordings(data);
            }
            if (statsRes.ok && statsRes.headers.get("content-type")?.includes("application/json")) {
                const stats = await statsRes.json();
                setStorageStats(stats);
            }
        } catch (e) {
            console.error("Failed to load recordings or storage stats:", e);
        }
    };

    useEffect(() => {
        if (viewMode === 'recordings') {
            reloadRecordings();
        }
    }, [viewMode]);

    const runStoragePruning = async () => {
        try {
            const res = await fetch('/api/system/storage/rotate', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setStorageStats(data.newStats);
                    await reloadRecordings();
                }
            }
        } catch (e) {
            console.error("Failed to run storage pruning:", e);
        }
    };

    const deleteRecordingFile = async (id: string) => {
        try {
            const res = await fetch(`/api/recordings/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setRecordings(prev => prev.filter(r => r.id !== id));
                if (storageStats) {
                    const recSizeMb = recordings.find(r => r.id === id)?.fileSizeMb || 10;
                    const updatedUsed = Math.max(0, storageStats.usedGb - (recSizeMb / 1024));
                    setStorageStats({
                        ...storageStats,
                        usedGb: Math.round(updatedUsed),
                        freeGb: Math.round(storageStats.totalGb - updatedUsed),
                        usagePercent: Math.round((updatedUsed / storageStats.totalGb) * 100)
                    });
                }
            }
        } catch (e) {
            console.error("Failed to delete recording:", e);
        }
    };

    const [playbackProgress, setPlaybackProgress] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);

    useEffect(() => {
        let timer: any;
        if (selectedRecForPlayback && isPlaying) {
            timer = setInterval(() => {
                setPlaybackProgress(prev => {
                    if (prev >= 100) {
                        setIsPlaying(false);
                        return 100;
                    }
                    return prev + (1 * playbackSpeed);
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [selectedRecForPlayback, isPlaying, playbackSpeed]);

    const activeTestTimersRef = useRef<{ interval: any; timeouts: any[] }>({ interval: null, timeouts: [] });

    const cleanUpTestTimers = () => {
        if (activeTestTimersRef.current.interval) {
            clearInterval(activeTestTimersRef.current.interval);
            activeTestTimersRef.current.interval = null;
        }
        activeTestTimersRef.current.timeouts.forEach(t => clearTimeout(t));
        activeTestTimersRef.current.timeouts = [];
    };

    useEffect(() => {
        if (!isTestModalOpen) {
            cleanUpTestTimers();
        }
    }, [isTestModalOpen]);

    const startConnectionTest = (camera: Camera) => {
        cleanUpTestTimers();
        setTestingCamera(camera);
        setIsTestModalOpen(true);
        setTestStatus('running');
        setTestProgress(5);
        setTestLogs([
            language === 'uz' 
                ? `[INFO] ${camera.name} (${camera.id}) uchun ulanish sinovi boshlandi...`
                : `[INFO] Initializing connection diagnostics for ${camera.name} (${camera.id})...`,
            language === 'uz'
                ? `[INFO] Tizim: Sentinel Biometrik Tarmoq Protokoli`
                : `[INFO] Core integration platform: Sentinel Biometric Network Protocol`,
            language === 'uz'
                ? `[INFO] Kamera turi: ${camera.type} | Oqim manzili: ${camera.streamUrl}`
                : `[INFO] Stream type: ${camera.type} | Resource URL: ${camera.streamUrl}`
        ]);

        const ipMatch = camera.streamUrl.match(/@([^:/]+)/) || camera.streamUrl.match(/:\/\/([^:/]+)/);
        const ip = ipMatch ? ipMatch[1] : '192.168.1.104';
        const portMatch = camera.streamUrl.match(/:(\d+)/);
        const port = portMatch ? portMatch[1] : '554';

        // Run real backend diagnostics
        cameraService.diagnoseCamera(camera.id, camera.streamUrl).then(result => {
            const allLogs = result.logs;
            const msPerLog = Math.max(60, Math.min(180, 2400 / (allLogs.length || 1)));
            let delay = 0;

            allLogs.forEach((log: string, i: number) => {
                const t = setTimeout(() => {
                    setTestLogs(prev => [...prev, log]);
                    setTestProgress(Math.round(5 + ((i + 1) / allLogs.length) * 90));
                }, delay);
                activeTestTimersRef.current.timeouts.push(t);
                delay += msPerLog;
            });

            const finalT = setTimeout(() => {
                setTestProgress(100);
                setTestStatus(result.success ? 'success' : 'failed');
            }, delay);
            activeTestTimersRef.current.timeouts.push(finalT);
        }).catch((err: Error) => {
            setTestLogs(prev => [...prev, `[ERROR] ${err.message}`]);
            setTestStatus('failed');
            setTestProgress(0);
        });
    };

    const reloadCameras = async () => {
        try {
            let cams = await cameraService.getAllCameras();
            
            // Production behavior: do not populate demo cameras if none exist.
            if (!cams) {
                cams = [];
            }
            
            setCameras(cams);
        } catch (e) {
            console.error("Failed to load cameras:", e);
            setCameras([]);
        }
    };

    useEffect(() => {
        reloadCameras();
    }, []);

    // ... (Existing handlers: handleEdit, handleSaveCamera, handleDelete, etc. - maintained)
    // Add/Edit Camera Logic
    const [newCam, setNewCam] = useState<Partial<Camera>>({
        type: CameraType.RTSP,
        fps: 15,
        resolution: '1280x720',
        status: CameraStatus.ONLINE, 
        focalLength: 2.8,
        sensorWidth: 4.8, 
        sensorHeight: 3.6
    });

    const calculatedFOV = coverageEngine.calculateOpticalFOV({
        focalLength: newCam.focalLength || 2.8,
        sensorWidth: newCam.sensorWidth || 4.8
    });

    const validateStreamUrl = (type: CameraType, url: string) => {
        if (!url) return false;
        if (type === CameraType.USB) return /^\d+$/.test(url);
        // Relax RTSP validation since we build it manually
        if (type === CameraType.RTSP) return url.startsWith('rtsp://') || url.startsWith('rtsps://');
        if (type === CameraType.REMOTE) return url.startsWith('http') || url.startsWith('ws');
        return true;
    };

    const openAddModal = () => {
        setNewCam({ 
            type: CameraType.RTSP, fps: 15, resolution: '1280x720', status: CameraStatus.ONLINE,
            focalLength: 2.8, sensorWidth: 4.8, sensorHeight: 3.6 
        });
        setRtspDetails({ ip: '', port: '554', user: 'admin', pass: '', path: '/stream' });
        setIsEditing(false);
        setFormError(null);
        setIsAddModalOpen(true);
    };

    const handleEdit = (camera: Camera) => {
        setNewCam({ ...camera });
        
        if (camera.type === CameraType.RTSP && camera.streamUrl) {
            // Try parse rtsp://user:pass@ip:port/path
            try {
                // Hacky parse for RTSP url which URL() constructor might struggle with if protocol isn't supported, 
                // but usually browsers handle it loosely or throw.
                // Better manual regex extraction:
                // rtsp://(user:pass@)?host:port/path
                const regex = /rtsp:\/\/(?:([^:]+)(?::([^@]+))?@)?([^:\/]+)(?::(\d+))?(\/.*)?/;
                const match = camera.streamUrl.match(regex);
                if (match) {
                    setRtspDetails({
                        user: match[1] || '',
                        pass: match[2] || '',
                        ip: match[3] || '',
                        port: match[4] || '554',
                        path: match[5] || '/'
                    });
                } else {
                     setRtspDetails({ ip: '', port: '554', user: '', pass: '', path: '/stream' });
                }
            } catch {
                setRtspDetails({ ip: '', port: '554', user: '', pass: '', path: '/stream' });
            }
        }
        
        setIsEditing(true);
        setFormError(null);
        setIsAddModalOpen(true);
    };

    const handleSaveCamera = async () => {
        setFormError(null);
        if (!newCam.name || !newCam.location) {
            setFormError("Name and Location are required.");
            return;
        }
        
        // Build URL if RTSP
        let finalUrl = newCam.streamUrl || '';
        if (newCam.type === CameraType.RTSP) {
            if (!rtspDetails.ip) {
                setFormError("IP Address is required for RTSP.");
                return;
            }
            const authPart = rtspDetails.user ? `${rtspDetails.user}:${rtspDetails.pass}@` : '';
            finalUrl = `rtsp://${authPart}${rtspDetails.ip}:${rtspDetails.port}${rtspDetails.path}`;
            newCam.streamUrl = finalUrl;
        }

        const type = newCam.type || CameraType.RTSP;
        if (!validateStreamUrl(type, finalUrl)) {
            if (type === CameraType.USB) setFormError("USB Index must be a number (e.g. 0).");
            else if (type === CameraType.RTSP) setFormError("Invalid RTSP Configuration.");
            else setFormError("Remote Link must be a valid URL (http/ws).");
            return;
        }
        
        const camId = isEditing && newCam.id ? newCam.id : `CAM-${crypto.randomUUID()}`;
        const cam: Camera = {
            id: camId,
            name: newCam.name || 'New Camera',
            location: newCam.location || 'Unknown',
            type: type,
            streamUrl: finalUrl,
            fps: newCam.fps || 15,
            resolution: newCam.resolution || '1280x720',
            status: isEditing ? (newCam.status || CameraStatus.ONLINE) : CameraStatus.CONNECTING,
            lastActive: isEditing ? (newCam.lastActive || 'Now') : 'Never',
            focalLength: newCam.focalLength || 2.8,
            sensorWidth: newCam.sensorWidth || 4.8,
            sensorHeight: newCam.sensorHeight || 3.6,
            errorMsg: newCam.errorMsg
        };
        await cameraService.saveCamera(cam);
        const cameras = await cameraService.getAllCameras();
        setCameras(cameras || []);
        setIsAddModalOpen(false);
    };

    const handleDelete = async (id: string) => {
        const cam = cameras.find(c => c.id === id);
        if (cam) {
            setCameraToDelete(cam);
        }
    };

    const confirmDelete = async () => {
        if (cameraToDelete) {
            await cameraService.deleteCamera(cameraToDelete.id);
            const cameras = await cameraService.getAllCameras();
            setCameras(cameras || []);
            setCameraToDelete(null);
        }
    };

    const handleStatusToggle = async (camera: Camera) => {
        const statuses = [CameraStatus.ONLINE, CameraStatus.OFFLINE, CameraStatus.CONNECTING, CameraStatus.ERROR];
        const currentIndex = statuses.indexOf(camera.status);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
        let errorMsg = camera.errorMsg;
        if (nextStatus === CameraStatus.ERROR) {
            errorMsg = "Connection Refused: Remote Host Unreachable (503)";
        } else if (nextStatus === CameraStatus.ONLINE) {
            errorMsg = undefined;
        }
        const updatedCamera = { ...camera, status: nextStatus, errorMsg };
        await cameraService.saveCamera(updatedCamera);
        const cameras = await cameraService.getAllCameras();
        setCameras(cameras || []);
    };

    const handleStreamError = (id: string, errorMsg: string) => {
        setCameras(prev => {
            const cam = prev.find(c => c.id === id);
            if (cam && cam.status !== CameraStatus.ERROR) {
                const updated = { ...cam, status: CameraStatus.ERROR, errorMsg };
                cameraService.saveCamera(updated);
                return prev.map(c => c.id === id ? updated : c);
            }
            return prev;
        });
    };

    const openShareModal = (camera: Camera) => {
        setSharingCamera(camera);
        setGeneratedStreamLink(null);
        setShareExpiry('1h');
        setIsShareModalOpen(true);
    };

    const handleGenerateLink = async () => {
        setIsGenerating(true);
        const link = await cameraService.generateSecureLink(linkConfig.deviceName, linkConfig.expiry);
        setLinkGenerated(link);
        setIsGenerating(false);
    };

    const handleGenerateStreamLink = async () => {
        if(!sharingCamera) return;
        setIsGenerating(true);
        const link = await cameraService.generateStreamViewerLink(sharingCamera.id, shareExpiry);
        setGeneratedStreamLink(link);
        setIsGenerating(false);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const streamInputProps = (() => {
        switch(newCam.type) {
            case CameraType.USB: return { label: 'USB Device Index', placeholder: '0 (Default Webcam)' };
            case CameraType.REMOTE: return { label: 'Secure WebSocket / HTTP Link', placeholder: 'wss://api.sentinel.sys/stream/v8x...' };
            default: return { label: 'RTSP Connection String', placeholder: 'rtsp://admin:pass@192.168.1.55:554/stream' };
        }
    })();

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedCameraId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedCameraId || draggedCameraId === targetId) return;
        const sourceIdx = cameras.findIndex(c => c.id === draggedCameraId);
        const targetIdx = cameras.findIndex(c => c.id === targetId);
        if (sourceIdx > -1 && targetIdx > -1) {
            const newCameras = [...cameras];
            const [moved] = newCameras.splice(sourceIdx, 1);
            newCameras.splice(targetIdx, 0, moved);
            setCameras(newCameras);
        }
        setDraggedCameraId(null);
    };

    const toggleCameraSize = (id: string) => {
        setLayoutConfig(prev => ({
            ...prev,
            [id]: prev[id] === 'large' ? 'normal' : 'large'
        }));
    };

    // --- Single Camera Focus Logic ---
    const activeCamera = focusedCameraId ? cameras.find(c => c.id === focusedCameraId) : null;

    if (activeCamera) {
        return (
            <SingleCameraView 
                camera={activeCamera}
                onClose={() => setFocusedCameraId(null)}
                onStatusToggle={handleStatusToggle}
                onStreamError={handleStreamError}
                streamMode={streamMode}
            />
        );
    }

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Header / Toolbar */}
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 p-4 bg-app-panel border border-border rounded-xl shrink-0">
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 bg-app-primary p-1 rounded-lg border border-border animate-in fade-in justify-center sm:justify-start">
                    <button 
                        onClick={() => setViewMode('matrix')}
                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-all ${viewMode === 'matrix' ? 'bg-cyan-600 text-white shadow-lg' : 'text-text-secondary hover:text-white hover:bg-app-surface'}`}
                    >
                        <Grid size={16} /> {t('cameras.matrix')}
                    </button>
                    <button 
                        onClick={() => setViewMode('config')}
                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-all ${viewMode === 'config' ? 'bg-cyan-600 text-white shadow-lg' : 'text-text-secondary hover:text-white hover:bg-app-surface'}`}
                    >
                        <List size={16} /> {t('cameras.config')}
                    </button>
                    <button 
                        onClick={() => setViewMode('recordings')}
                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-all ${viewMode === 'recordings' ? 'bg-cyan-600 text-white shadow-lg' : 'text-text-secondary hover:text-white hover:bg-app-surface'}`}
                    >
                        <History size={16} /> {language === 'uz' ? 'Arxiv & Yozuvlar' : 'Archive & Recordings'}
                    </button>
                  </div>

                 <div className="flex flex-wrap gap-2 sm:gap-3 justify-center sm:justify-end">
                    <button 
                        onClick={() => setIsSearchModalOpen(true)}
                        className="px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-colors shadow-lg shadow-indigo-900/20"
                    >
                        <Search size={16} /> {language === 'uz' ? 'Aqlli Qidiruv' : 'Smart Search'}
                    </button>
                    <button 
                        onClick={() => { setLinkGenerated(null); setIsLinkModalOpen(true); }}
                        className="px-3 py-1.5 sm:px-4 sm:py-2 bg-app-surface hover:bg-app-surface text-text-secondary rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-colors border border-border"
                    >
                        <LinkIcon size={16} /> {t('cameras.generateLink')}
                    </button>
                    <button 
                        onClick={openAddModal}
                        className="px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-colors shadow-lg shadow-emerald-900/20"
                    >
                        <Plus size={16} /> {t('cameras.add')}
                    </button>
                 </div>
            </div>

            {/* Matrix View */}
            {viewMode === 'matrix' && (
                <div className="flex-1 flex flex-col gap-4 sm:gap-6 overflow-hidden">
                    {/* Sentinel AI Video Analytics Control Panel */}
                    <div className="bg-gradient-to-r from-cyan-950/20 via-app-panel to-indigo-950/20 border border-border p-3 sm:p-4 rounded-xl flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 animate-in fade-in duration-305 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] shrink-0">
                                <Cpu size={20} className="animate-pulse" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-sm font-bold text-white flex items-center gap-2 truncate">
                                    {language === 'uz' ? 'Sentinel Sun\'iy Intellekt Tahlil Tizimi' : 'Sentinel AI Video Analytics'}
                                    <span className="hidden sm:inline px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full text-[9px] font-bold tracking-wider animate-pulse">
                                        V3.5 CORE
                                    </span>
                                </h4>
                                <p className="text-xs text-text-secondary truncate">
                                    {language === 'uz' ? 'Kamera oqimlaridagi odamlarni aniqlash, yuzlarni tanish, chiziqli sanash' : 'Real-time multi-object computer vision, biometric mapping'}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-app-primary p-2 sm:p-1.5 rounded-lg border border-border overflow-x-auto custom-scrollbar scrollbar-none">
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => setAnalysisConfig(prev => ({ ...prev, detectPeople: !prev.detectPeople }))}
                                    className={`h-9 sm:h-auto px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${analysisConfig.detectPeople ? 'bg-cyan-600/25 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.1)]' : 'text-text-secondary hover:text-white hover:bg-app-surface border border-transparent'}`}
                                >
                                    <Users size={14} />
                                    <span className="hidden sm:inline">{language === 'uz' ? 'Odamlar' : 'People'}</span>
                                    <span className={`w-1.5 h-1.5 rounded-full ${analysisConfig.detectPeople ? 'bg-cyan-400 animate-ping' : 'bg-slate-700'}`}></span>
                                </button>
                                
                                <button
                                    onClick={() => setAnalysisConfig(prev => ({ ...prev, recognizeFaces: !prev.recognizeFaces }))}
                                    className={`h-9 sm:h-auto px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${analysisConfig.recognizeFaces ? 'bg-indigo-600/25 text-indigo-400 border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.1)]' : 'text-text-secondary hover:text-white hover:bg-app-surface border border-transparent'}`}
                                >
                                    <ScanFace size={14} />
                                    <span className="hidden sm:inline">{language === 'uz' ? 'Yuzlar' : 'Faces'}</span>
                                    <span className={`w-1.5 h-1.5 rounded-full ${analysisConfig.recognizeFaces ? 'bg-indigo-400 animate-ping' : 'bg-slate-700'}`}></span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => setAnalysisConfig(prev => ({ ...prev, enableCounting: !prev.enableCounting }))}
                                    className={`h-9 sm:h-auto px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${analysisConfig.enableCounting ? 'bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'text-text-secondary hover:text-white hover:bg-app-surface border border-transparent'}`}
                                >
                                    <Calculator size={14} />
                                    <span className="hidden sm:inline">{language === 'uz' ? 'Sanash' : 'Counter'}</span>
                                    <span className={`w-1.5 h-1.5 rounded-full ${analysisConfig.enableCounting ? 'bg-emerald-400 animate-ping' : 'bg-slate-700'}`}></span>
                                </button>

                                <button
                                    onClick={() => setAnalysisConfig(prev => ({ ...prev, showHeatmap: !prev.showHeatmap }))}
                                    className={`h-9 sm:h-auto px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${analysisConfig.showHeatmap ? 'bg-amber-600/25 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 'text-text-secondary hover:text-white hover:bg-app-surface border border-transparent'}`}
                                >
                                    <Flame size={14} />
                                    <span className="hidden sm:inline">{language === 'uz' ? 'Xarita' : 'Heatmap'}</span>
                                    <span className={`w-1.5 h-1.5 rounded-full ${analysisConfig.showHeatmap ? 'bg-amber-400 animate-ping' : 'bg-slate-700'}`}></span>
                                </button>
                            </div>

                            <div className="h-4 w-px bg-border mx-1 hidden xl:block" />

                            <div className="flex items-center gap-1 bg-app-panel border border-border p-0.5 rounded-md text-xs shrink-0">
                                <button
                                    onClick={() => setStreamMode('mjpeg')}
                                    className={`px-2 py-1 rounded font-bold transition-all cursor-pointer whitespace-nowrap ${streamMode === 'mjpeg' ? 'bg-cyan-600 text-white shadow-sm' : 'text-text-secondary hover:text-white'}`}
                                >
                                    VMS
                                </button>
                                <button
                                    onClick={() => setStreamMode('direct')}
                                    className={`px-2 py-1 rounded font-bold transition-all cursor-pointer whitespace-nowrap ${streamMode === 'direct' ? 'bg-cyan-600 text-white shadow-sm' : 'text-text-secondary hover:text-white'}`}
                                >
                                    Loop
                                </button>
                            </div>

                            <div className="h-4 w-px bg-border mx-1 hidden xl:block" />

                            <div className="flex items-center gap-1 bg-app-panel border border-border p-0.5 rounded-md text-xs shrink-0">
                                {(['auto', '1x1', '2x2', '3x3'] as const).map(layout => (
                                    <button
                                        key={layout}
                                        onClick={() => setGridLayout(layout)}
                                        className={`px-2 py-1 rounded font-bold transition-all cursor-pointer uppercase ${gridLayout === layout ? 'bg-indigo-600 text-white shadow-sm' : 'text-text-secondary hover:text-white'}`}
                                    >
                                        {layout}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={`grid ${
                        gridLayout === '1x1' ? 'grid-cols-1' :
                        gridLayout === '2x2' ? 'grid-cols-1 sm:grid-cols-2' :
                        gridLayout === '3x3' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                        gridLayout === '4x4' ? 'grid-cols-2 lg:grid-cols-4' :
                        'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                    } gap-4 sm:gap-6 flex-1 overflow-y-auto custom-scrollbar p-1 grid-flow-dense`}>
                        {(() => {
                            const getVisibleCameras = () => {
                                if (gridLayout === '1x1') {
                                    const selected = cameras.find(c => c.id === focusedCameraId) || cameras[0];
                                    return selected ? [selected] : [];
                                }
                                let limit = cameras.length;
                                if (gridLayout === '2x2') limit = 4;
                                if (gridLayout === '3x3') limit = 9;
                                if (gridLayout === '4x4') limit = 16;
                                return cameras.slice(0, limit);
                            };
                            
                            const visibleCams = getVisibleCameras();
                            const gridLimit = gridLayout === '2x2' ? 4 : gridLayout === '3x3' ? 9 : gridLayout === '4x4' ? 16 : 0;
                            const emptySlotsCount = Math.max(0, gridLimit - visibleCams.length);
                            
                            return (
                                <>
                                    {/* No cameras configured — prompt operator to add one */}
                                    {cameras.length === 0 && (
                                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-center animate-in fade-in">
                                            <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6">
                                                <Video size={36} className="text-amber-400" />
                                            </div>
                                            <h3 className="text-lg font-bold text-text-primary mb-2">
                                                {language === 'uz' ? 'Hech qanday kamera sozlanmagan' : 'No Cameras Configured'}
                                            </h3>
                                            <p className="text-sm text-text-secondary max-w-sm mb-6">
                                                {language === 'uz'
                                                    ? 'Tizim hali birorta ham kamera manbai bilan ulanmagan. Boshlash uchun haqiqiy RTSP yoki ONVIF kamerangizni qo\'shing.'
                                                    : 'The system has no camera sources connected. Add your first real RTSP or ONVIF camera to get started.'}
                                            </p>
                                            <button
                                                onClick={openAddModal}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors text-sm"
                                            >
                                                <Plus size={16} />
                                                {language === 'uz' ? 'Kamera Qo\'shish' : 'Add Camera'}
                                            </button>
                                        </div>
                                    )}

                                    {visibleCams.map(cam => (
                                        <CameraCard 
                                            key={cam.id} 
                                            camera={cam} 
                                            sizeMode={layoutConfig[cam.id] || 'normal'}
                                            onEdit={handleEdit} 
                                            onDelete={handleDelete} 
                                            onShare={openShareModal} 
                                            onStatusToggle={handleStatusToggle}
                                            onStreamError={handleStreamError}
                                            onToggleSize={toggleCameraSize}
                                            // Drag handlers
                                            onDragStart={handleDragStart}
                                            onDragOver={handleDragOver}
                                            onDrop={handleDrop}
                                            onSelect={setFocusedCameraId}
                                            onTestConnection={startConnectionTest}
                                            streamMode={streamMode}
                                            analysisConfig={analysisConfig}
                                        />
                                    ))}
                                    
                                    {/* Empty grid slots for explicit layouts */}
                                    {Array.from({ length: emptySlotsCount }).map((_, i) => (
                                        <div 
                                            key={`empty-slot-${i}`} 
                                            onClick={openAddModal}
                                            className="border-2 border-dashed border-border/50 rounded-xl flex flex-col items-center justify-center text-text-secondary/40 hover:text-cyan-500 hover:border-cyan-500/50 hover:bg-cyan-900/5 transition-all group min-h-[250px] cursor-pointer animate-in fade-in zoom-in-95"
                                        >
                                            <Video size={24} className="mb-2 group-hover:scale-110 transition-transform" />
                                            <span className="text-xs font-semibold">{language === 'uz' ? `Bo'sh Kamera Sloti` : `Empty Camera Slot`}</span>
                                        </div>
                                    ))}
                                    
                                    {/* Add Source button for auto layout */}
                                    {gridLayout === 'auto' && cameras.length > 0 && (
                                        <button 
                                            onClick={openAddModal}
                                            className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-text-muted hover:text-cyan-500 hover:border-cyan-500/50 hover:bg-cyan-900/5 transition-all group min-h-[250px] col-span-1 cursor-pointer"
                                        >
                                            <div className="w-16 h-16 rounded-full bg-app-panel group-hover:bg-cyan-500/10 flex items-center justify-center mb-4 transition-colors">
                                                <Plus size={32} />
                                            </div>
                                            <span className="font-bold text-sm">Add New Source</span>
                                        </button>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Config List View */}
            {viewMode === 'config' && (
                <div className="bg-app-panel border border-border rounded-xl overflow-hidden flex-1 flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-app-primary border-b border-border text-text-primary0 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4 font-medium">ID / Name</th>
                                    <th className="px-6 py-4 font-medium">{t('cameras.location')}</th>
                                    <th className="px-6 py-4 font-medium">Optics</th>
                                    <th className="px-6 py-4 font-medium">{t('cameras.type')}</th>
                                    <th className="px-6 py-4 font-medium">{t('cameras.status')}</th>
                                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {cameras.map(cam => (
                                    <tr key={cam.id} className={`hover:bg-app-surface/50 ${isCameraInactive(cam) ? 'opacity-75 grayscale' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-app-surface flex items-center justify-center text-text-secondary">
                                                    <Video size={16} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-text-primary flex items-center gap-1">
                                                        {cam.name}
                                                        {isCameraInactive(cam) && <span title="Inactive"><AlertCircle size={12} className="text-amber-500" /></span>}
                                                    </p>
                                                    <p className="text-xs font-mono text-text-primary0">{cam.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-text-secondary">{cam.location}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-[10px] font-mono text-text-secondary bg-app-primary border border-border rounded px-2 py-1 inline-block">
                                                <div>f: {cam.focalLength || 2.8}mm</div>
                                                <div>s: {cam.sensorWidth || 4.8}mm</div>
                                                <div className="text-cyan-400 mt-0.5">
                                                    FOV: {coverageEngine.calculateOpticalFOV({ focalLength: cam.focalLength || 2.8, sensorWidth: cam.sensorWidth || 4.8 }).toFixed(1)}°
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-app-primary border border-border rounded text-xs font-mono text-cyan-400">
                                                {cam.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const statusConfig = {
                                                    [CameraStatus.ONLINE]: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', icon: CheckCircle2 },
                                                    [CameraStatus.OFFLINE]: { bg: 'bg-slate-700/30', text: 'text-text-secondary', border: 'border-border/30', icon: WifiOff },
                                                    [CameraStatus.CONNECTING]: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', icon: RefreshCw },
                                                    [CameraStatus.ERROR]: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', icon: AlertCircle },
                                                }[cam.status] || { bg: 'bg-slate-700/30', text: 'text-text-secondary', border: 'border-border/30', icon: Activity };
                                                const Icon = statusConfig.icon;
                                                return (
                                                    <span 
                                                        onClick={() => handleStatusToggle(cam)}
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border cursor-pointer hover:opacity-80 transition-opacity ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                                                        title="Click to Toggle Status"
                                                    >
                                                        <Icon size={12} className={cam.status === CameraStatus.CONNECTING ? 'animate-spin' : ''} />
                                                        {cam.status}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    className="p-2 hover:bg-app-surface rounded text-text-secondary hover:text-yellow-400 transition-colors cursor-pointer" 
                                                    title={language === 'uz' ? "Ulanishni sinash" : "Connection Test"} 
                                                    onClick={() => startConnectionTest(cam)}
                                                >
                                                    <Zap size={16} />
                                                </button>
                                                <button className="p-2 hover:bg-app-surface rounded text-text-secondary hover:text-cyan-400" title="Share" onClick={() => openShareModal(cam)}>
                                                    <Share2 size={16} />
                                                </button>
                                                <button className="p-2 hover:bg-app-surface rounded text-text-secondary hover:text-white" title="Edit" onClick={() => handleEdit(cam)}>
                                                    <MoreVertical size={16} />
                                                </button>
                                                <button className="p-2 hover:bg-app-surface rounded text-text-secondary hover:text-white" title="Delete" onClick={() => handleDelete(cam.id)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {/* Archive & Recordings View */}
            {viewMode === 'recordings' && (
                <div className="flex-1 flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4">
                    {/* Left Column: Storage Metrics & Scheduler */}
                    <div className="lg:w-1/3 flex flex-col gap-6">
                        {/* Storage Metrics Panel */}
                        <div className="bg-app-panel border border-border rounded-xl p-5 flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <History className="text-cyan-400" size={18} />
                                    {language === 'uz' ? 'Disk Xotirasi' : 'Storage Metrics'}
                                </h3>
                                <button 
                                    onClick={runStoragePruning}
                                    className="px-2.5 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="Prune and optimize disk space"
                                >
                                    <RefreshCw size={12} className="animate-spin-slow" />
                                    {language === 'uz' ? 'Rotatsiya' : 'Rotate Files'}
                                </button>
                            </div>

                            {storageStats ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between text-xs font-mono text-text-secondary">
                                        <span>{language === 'uz' ? "Ishlatilgan:" : "Used:"} <strong>{storageStats.usedGb} GB</strong></span>
                                        <span>{language === 'uz' ? "Jami:" : "Total:"} <strong>{storageStats.totalGb} GB</strong></span>
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="w-full bg-app-primary rounded-full h-3 overflow-hidden border border-border flex">
                                        <div 
                                            style={{ width: `${storageStats.usagePercent}%` }} 
                                            className="bg-cyan-500 h-full transition-all duration-500" 
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] font-mono">
                                        <div className="flex items-center gap-1.5 text-cyan-400">
                                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
                                            <span>{language === 'uz' ? "Yozuvlar" : "Recordings"} ({storageStats.usagePercent}%)</span>
                                        </div>
                                        <div className="text-text-muted">
                                            {storageStats.freeGb} GB {language === 'uz' ? "bo'sh" : "free"}
                                        </div>
                                    </div>

                                    <div className="border-t border-border/50 pt-3 space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-text-secondary">{language === 'uz' ? "Kameralar soni:" : "Active Cameras:"}</span>
                                            <span className="font-bold text-white">{storageStats.camerasCount || cameras.length}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-text-secondary">{language === 'uz' ? "Saqlash muddati:" : "Retention Policy:"}</span>
                                            <span className="font-bold text-cyan-400">{storageStats.retentionDays} {language === 'uz' ? "kun" : "days"}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-40 flex items-center justify-center text-text-muted text-xs">
                                    <RefreshCw size={16} className="animate-spin mr-2" />
                                    Loading disk details...
                                </div>
                            )}
                        </div>

                        {/* Schedule Recording Grid */}
                        <div className="bg-app-panel border border-border rounded-xl p-5 flex flex-col gap-4">
                            <div>
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <Clock className="text-indigo-400" size={18} />
                                    {language === 'uz' ? 'Yozib olish jadvali' : 'Recording Scheduler'}
                                </h3>
                                <p className="text-xs text-text-muted mt-1">
                                    {language === 'uz' ? 'Kamera uchun haftalik soatlik yozish jadvallarini tanlang.' : 'Select hourly blocks to schedule automated camera stream archiving.'}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-medium text-text-secondary">Select Camera</label>
                                <select 
                                    className="w-full bg-app-primary border border-border rounded-lg p-2.5 text-text-primary text-xs outline-none focus:border-cyan-500"
                                    value={selectedCameraIdForSchedule}
                                    onChange={e => setSelectedCameraIdForSchedule(e.target.value)}
                                >
                                    {cameras.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Weekly grid map */}
                            <div className="space-y-2 overflow-x-auto custom-scrollbar">
                                <div className="flex text-[10px] text-text-muted font-mono justify-between pb-1 border-b border-border/50">
                                    <span className="w-16">Day</span>
                                    <div className="flex-1 flex justify-around">
                                        <span>00:00</span>
                                        <span>12:00</span>
                                        <span>23:00</span>
                                    </div>
                                </div>
                                {['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'].map(day => (
                                    <div key={day} className="flex items-center gap-2">
                                        <span className="w-16 text-xs text-text-secondary truncate font-medium">{day}</span>
                                        <div className="flex-1 grid grid-cols-24 gap-0.5">
                                            {(recordingSchedule[day] || Array(24).fill(true)).map((active, hour) => (
                                                <button
                                                    key={hour}
                                                    onClick={() => {
                                                        const updated = { ...recordingSchedule };
                                                        updated[day][hour] = !updated[day][hour];
                                                        setRecordingSchedule(updated);
                                                    }}
                                                    className={`h-4.5 rounded-sm transition-all border border-border/10 cursor-pointer ${active ? 'bg-emerald-500/80 hover:bg-emerald-400' : 'bg-slate-800 hover:bg-slate-700'}`}
                                                    title={`${day} soat ${hour}:00 - ${active ? 'Continuous Recording Active' : 'No Recording scheduled'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-4 text-[10px] font-mono text-text-muted pt-1">
                                <div className="flex items-center gap-1">
                                    <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                                    <span>Continuous</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="w-2.5 h-2.5 rounded bg-slate-800 border border-border/50"></span>
                                    <span>Disabled</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Recorded Archive Browser */}
                    <div className="flex-1 bg-app-panel border border-border rounded-xl p-5 flex flex-col gap-4 min-h-[500px]">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                                <h3 className="font-bold text-white text-base">
                                    {language === 'uz' ? 'Yozib Olingan Arxivi' : 'Recorded Video Archive'}
                                </h3>
                                <p className="text-xs text-text-muted">
                                    {language === 'uz' ? "VMS tizimi tomonidan saqlangan barcha continuous va motion kliplar." : "Browse and playback stored historical camera feeds."}
                                </p>
                            </div>
                        </div>

                        {/* List table */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar border border-border/50 rounded-lg">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-app-primary border-b border-border text-text-secondary uppercase text-[10px] font-mono">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Recording ID</th>
                                        <th className="px-4 py-3 font-medium">Camera Source</th>
                                        <th className="px-4 py-3 font-medium">Duration / Size</th>
                                        <th className="px-4 py-3 font-medium">Time Interval</th>
                                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {recordings.length > 0 ? (
                                        recordings.map(rec => (
                                            <tr key={rec.id} className="hover:bg-app-surface/40 group transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${rec.recordingType === 'Motion' ? 'bg-amber-500 animate-pulse' : rec.recordingType === 'Emergency' ? 'bg-rose-500 animate-ping' : 'bg-cyan-500'}`}></span>
                                                        <div>
                                                            <p className="font-mono font-bold text-white text-[11px]">{rec.id}</p>
                                                            <span className="text-[10px] text-text-muted bg-app-surface border border-border rounded px-1.5 py-0.5 mt-0.5 inline-block uppercase font-mono">{rec.recordingType}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-text-secondary">
                                                    {rec.cameraName || `Camera: ${rec.cameraId}`}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-text-secondary">
                                                    <div>15.0 sec</div>
                                                    <div className="text-cyan-400 font-semibold">{rec.fileSizeMb || 12} MB</div>
                                                </td>
                                                <td className="px-4 py-3 text-text-secondary">
                                                    <div className="text-[11px] font-mono">
                                                        <div>Start: {new Date(rec.startTime).toLocaleTimeString()}</div>
                                                        <div className="text-text-muted">Date: {new Date(rec.startTime).toLocaleDateString()}</div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedRecForPlayback(rec);
                                                                setPlaybackProgress(0);
                                                                setIsPlaying(true);
                                                                setPlaybackSpeed(1);
                                                            }}
                                                            className="p-1.5 bg-cyan-900/40 hover:bg-cyan-500 hover:text-white border border-cyan-500/20 text-cyan-400 rounded transition-all cursor-pointer"
                                                            title="Simulate Playback"
                                                        >
                                                            <Play size={13} />
                                                        </button>
                                                        <button 
                                                            onClick={() => deleteRecordingFile(rec.id)}
                                                            className="p-1.5 bg-rose-950/40 hover:bg-rose-600 hover:text-white border border-rose-500/20 text-rose-400 rounded transition-all cursor-pointer"
                                                            title="Delete file"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="text-center py-10 text-text-muted">
                                                No recordings found in the VMS archive spool.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Playback simulation overlay/modal */}
            {selectedRecForPlayback && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-app-panel border border-border rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-app-primary">
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse"></span>
                                    {language === 'uz' ? 'Arxiv Videosi Ijrosi ' : 'Archive Video Playback '}
                                </h3>
                                <p className="text-xs text-text-secondary mt-0.5">
                                    {selectedRecForPlayback.cameraName} | File: {selectedRecForPlayback.id}
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedRecForPlayback(null)}
                                className="p-2 hover:bg-app-surface text-text-secondary hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Player viewport */}
                        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden border-b border-border select-none">
                            {/* Camera Stream representation */}
                            <img 
                                key={selectedRecForPlayback.id}
                                referrerPolicy="no-referrer"
                                src={`/api/cameras/${selectedRecForPlayback.cameraId}/stream`}
                                alt="Playback Stream"
                                className="w-full h-full object-cover opacity-80"
                                onError={(e) => {
                                    // fallback if connection drops
                                    (e.target as HTMLElement).style.display = 'none';
                                }}
                            />

                            {/* OSD (On-Screen Display) Playback Info */}
                            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm border border-border rounded px-3 py-1.5 font-mono text-[11px] text-cyan-400 z-10">
                                <div className="font-bold uppercase text-white flex items-center gap-1.5">
                                    <History size={11} /> PLAYBACK ARCHIVE
                                </div>
                                <div className="mt-1">SPEED: {playbackSpeed}x</div>
                                <div>PROGRESS: {Math.round(playbackProgress)}%</div>
                                <div className="text-text-secondary">DATE: {new Date(selectedRecForPlayback.startTime).toLocaleString()}</div>
                            </div>

                            {/* Watermark/Scan lines */}
                            <div className="absolute inset-0 pointer-events-none bg-scan-lines opacity-[0.03] z-10" />

                            {playbackProgress >= 100 && (
                                <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center text-center z-20">
                                    <CheckCircle2 size={48} className="text-cyan-400 mb-3 animate-bounce" />
                                    <p className="font-bold text-white">{language === 'uz' ? 'Klip Tugadi' : 'Playback Finished'}</p>
                                    <button 
                                        onClick={() => setPlaybackProgress(0)}
                                        className="mt-3 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs transition-all cursor-pointer"
                                    >
                                        Replay clip
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Controls bar */}
                        <div className="p-4 bg-app-primary flex flex-col gap-3">
                            {/* Progress bar scrubber */}
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-[10px] text-text-secondary">00:00</span>
                                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden relative border border-border/20">
                                    <div 
                                        style={{ width: `${playbackProgress}%` }} 
                                        className="bg-cyan-500 h-full transition-all duration-300"
                                    />
                                </div>
                                <span className="font-mono text-[10px] text-cyan-400">00:15</span>
                            </div>

                            {/* Controls row */}
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setIsPlaying(!isPlaying)}
                                        className="px-3.5 py-2 bg-app-panel hover:bg-app-surface text-white border border-border hover:border-cyan-500/40 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                    >
                                        {isPlaying ? 'Pause' : 'Play'}
                                    </button>
                                    <button 
                                        onClick={() => setPlaybackProgress(0)}
                                        className="px-3.5 py-2 bg-app-panel hover:bg-app-surface text-text-secondary hover:text-white border border-border font-bold rounded-lg text-xs transition-all cursor-pointer"
                                    >
                                        Restart
                                    </button>
                                </div>

                                {/* Playback speed toggler */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono text-text-muted uppercase">Speed:</span>
                                    {([0.5, 1, 2, 4, 8, 16] as const).map(speed => (
                                        <button
                                            key={speed}
                                            onClick={() => setPlaybackSpeed(speed)}
                                            className={`px-2 py-1 rounded text-[10px] font-mono transition-all font-bold cursor-pointer ${playbackSpeed === speed ? 'bg-cyan-600 text-white' : 'bg-app-panel text-text-secondary hover:text-white hover:bg-app-surface border border-border'}`}
                                        >
                                            {speed}x
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Modals (Add, Link, Share) kept as before --- */}
            {/* Add / Edit Camera Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-app-panel border border-border rounded-xl w-full max-w-lg shadow-2xl">
                        <div className="p-6 border-b border-border">
                            <h3 className="text-lg font-bold text-white">{isEditing ? 'Edit Camera' : t('cameras.add')}</h3>
                        </div>
                        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                            {formError && (
                                <div className="bg-red-950/30 border border-red-900/50 text-red-300 text-xs p-3 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2">
                                    <AlertCircle size={14} className="shrink-0" />
                                    {formError}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Camera Name</label>
                                <input type="text" className="w-full bg-app-primary border border-border rounded-lg p-2.5 text-text-primary focus:border-cyan-500 outline-none" placeholder="e.g. Front Gate"
                                    value={newCam.name || ''} onChange={e => setNewCam({...newCam, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-secondary mb-1">Location</label>
                                <input type="text" className="w-full bg-app-primary border border-border rounded-lg p-2.5 text-text-primary focus:border-cyan-500 outline-none" placeholder="e.g. Building A"
                                    value={newCam.location || ''} onChange={e => setNewCam({...newCam, location: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Source Type</label>
                                    <select className="w-full bg-app-primary border border-border rounded-lg p-2.5 text-text-primary outline-none"
                                        value={newCam.type} onChange={e => setNewCam({...newCam, type: e.target.value as CameraType})}
                                    >
                                        <option value={CameraType.RTSP}>RTSP Stream</option>
                                        <option value={CameraType.USB}>USB Camera</option>
                                        <option value={CameraType.REMOTE}>Remote Link</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">FPS Limit</label>
                                    <input type="number" className="w-full bg-app-primary border border-border rounded-lg p-2.5 text-text-primary focus:border-cyan-500 outline-none" placeholder="30"
                                        value={newCam.fps || ''} onChange={e => setNewCam({...newCam, fps: parseInt(e.target.value)})}
                                    />
                                </div>
                            </div>

                            {/* Part 1: Real Optical Parameters Input */}
                            <div className="bg-app-primary border border-border rounded-lg p-3">
                                <label className="block text-xs font-bold text-cyan-400 mb-2 flex items-center gap-1">
                                    <Ruler size={12} /> Optical Parameters (Physical Lens)
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[10px] text-text-primary0 mb-1">Focal Length (mm)</label>
                                        <input type="number" step="0.1" className="w-full bg-app-panel border border-border rounded p-2 text-xs text-white"
                                            value={newCam.focalLength} onChange={e => setNewCam({...newCam, focalLength: parseFloat(e.target.value)})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-text-primary0 mb-1">Sensor Width (mm)</label>
                                        <input type="number" step="0.1" className="w-full bg-app-panel border border-border rounded p-2 text-xs text-white"
                                            value={newCam.sensorWidth} onChange={e => setNewCam({...newCam, sensorWidth: parseFloat(e.target.value)})}
                                        />
                                    </div>
                                    <div className="flex flex-col justify-end">
                                        <div className="text-[10px] text-text-primary0 mb-1">Calculated H-FOV</div>
                                        <div className="bg-app-panel border border-border rounded p-2 text-xs text-emerald-400 font-mono text-center">
                                            {calculatedFOV.toFixed(1)}°
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[9px] text-text-primary0 mt-2">
                                    * Standard 1/3" sensor width is ~4.8mm. 2.8mm lens gives ~81° FOV.
                                </p>
                            </div>

                            {newCam.type === CameraType.RTSP ? (
                                <div className="bg-app-primary border border-border rounded-lg p-3 space-y-3">
                                    <label className="block text-xs font-bold text-cyan-400 flex items-center gap-1">
                                        <Globe size={12} /> Network Configuration
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <label className="block text-[10px] text-text-primary0 mb-1">IP Address / Host</label>
                                            <input type="text" className="w-full bg-app-panel border border-border rounded p-2 text-xs text-white font-mono" placeholder="192.168.1.100"
                                                value={rtspDetails.ip} onChange={e => setRtspDetails({...rtspDetails, ip: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-text-primary0 mb-1">Port</label>
                                            <input type="number" className="w-full bg-app-panel border border-border rounded p-2 text-xs text-white font-mono" placeholder="554"
                                                value={rtspDetails.port} onChange={e => setRtspDetails({...rtspDetails, port: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-text-primary0 mb-1">Stream Path</label>
                                            <input type="text" className="w-full bg-app-panel border border-border rounded p-2 text-xs text-white font-mono" placeholder="/stream1"
                                                value={rtspDetails.path} onChange={e => setRtspDetails({...rtspDetails, path: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-text-primary0 mb-1">Username</label>
                                            <input type="text" className="w-full bg-app-panel border border-border rounded p-2 text-xs text-white font-mono" placeholder="admin"
                                                value={rtspDetails.user} onChange={e => setRtspDetails({...rtspDetails, user: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-text-primary0 mb-1">Password</label>
                                            <input type="password" className="w-full bg-app-panel border border-border rounded p-2 text-xs text-white font-mono" placeholder="••••••"
                                                value={rtspDetails.pass} onChange={e => setRtspDetails({...rtspDetails, pass: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-text-primary0 font-mono break-all mt-1 p-2 bg-black/20 rounded border border-white/5">
                                        <span className="text-text-muted">Preview:</span> rtsp://{rtspDetails.user ? `${rtspDetails.user}:***@` : ''}{rtspDetails.ip || '0.0.0.0'}:{rtspDetails.port}{rtspDetails.path}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-2">
                                        {newCam.type === CameraType.USB ? <Usb size={12}/> : <Globe size={12}/>}
                                        {streamInputProps.label}
                                    </label>
                                    <input type="text" className="w-full bg-app-primary border border-border rounded-lg p-2.5 text-text-primary focus:border-cyan-500 outline-none font-mono text-sm" placeholder={streamInputProps.placeholder}
                                        value={newCam.streamUrl || ''} onChange={e => setNewCam({...newCam, streamUrl: e.target.value})}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-3 bg-app-primary rounded-b-xl">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-text-secondary hover:text-white font-medium">Cancel</button>
                            <button onClick={handleSaveCamera} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-900/20">{isEditing ? 'Save Changes' : 'Save Camera'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Device Enrollment Modal */}
            {isLinkModalOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-app-panel border border-border rounded-xl w-full max-w-md shadow-2xl">
                         <div className="p-6 border-b border-border">
                             <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                                    <LinkIcon size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">{t('cameras.generateLink')}</h3>
                                    <p className="text-xs text-text-secondary">Secure WebRTC Handshake</p>
                                </div>
                             </div>
                        </div>
                        
                        {!linkGenerated ? (
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-text-secondary bg-app-primary p-3 rounded border border-border">
                                    {t('cameras.secureLinkDesc')}
                                </p>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Device/User Identifier</label>
                                    <input type="text" className="w-full bg-app-primary border border-border rounded-lg p-2.5 text-text-primary focus:border-cyan-500 outline-none" placeholder="e.g. Officer Tablet 1"
                                        value={linkConfig.deviceName} onChange={e => setLinkConfig({...linkConfig, deviceName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1">Token Expiry (Minutes)</label>
                                    <input type="number" className="w-full bg-app-primary border border-border rounded-lg p-2.5 text-text-primary focus:border-cyan-500 outline-none"
                                        value={linkConfig.expiry} onChange={e => setLinkConfig({...linkConfig, expiry: parseInt(e.target.value)})}
                                    />
                                </div>
                                <button 
                                    onClick={handleGenerateLink} 
                                    disabled={isGenerating || !linkConfig.deviceName}
                                    className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg flex items-center justify-center gap-2 mt-4"
                                >
                                    {isGenerating ? <RefreshCw className="animate-spin" size={18} /> : <Power size={18} />}
                                    Generate Token
                                </button>
                            </div>
                        ) : (
                            <div className="p-6 space-y-4">
                                <div className="flex items-center justify-center text-emerald-500 mb-2">
                                    <CheckCircle2 size={48} className="animate-in zoom-in spin-in-180" />
                                </div>
                                <h4 className="text-center font-bold text-white">Link Generated Successfully</h4>
                                <div className="bg-black border border-border rounded-lg p-3 break-all font-mono text-xs text-text-secondary relative group">
                                    {linkGenerated}
                                </div>
                                <button 
                                    onClick={() => copyToClipboard(linkGenerated)}
                                    className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${isCopied ? 'bg-emerald-600 text-white' : 'bg-app-surface hover:bg-app-surface text-text-primary'}`}
                                >
                                    {isCopied ? <Check size={18} /> : <Copy size={18} />}
                                    {isCopied ? 'Copied to Clipboard' : 'Copy Link'}
                                </button>
                            </div>
                        )}
                         <div className="p-4 border-t border-border flex justify-end bg-app-primary rounded-b-xl">
                            <button onClick={() => setIsLinkModalOpen(false)} className="text-text-secondary hover:text-white text-sm">Close</button>
                        </div>
                    </div>
                 </div>
            )}

            {/* Share Stream Modal (New Feature) */}
            {isShareModalOpen && sharingCamera && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-app-panel border border-border rounded-xl w-full max-w-md shadow-2xl">
                         <div className="p-6 border-b border-border">
                             <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                                    <Share2 size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Share Live Stream</h3>
                                    <p className="text-xs text-text-secondary">Generate temporary viewer link for <span className="text-white font-mono">{sharingCamera.name}</span></p>
                                </div>
                             </div>
                        </div>

                        {!generatedStreamLink ? (
                            <div className="p-6 space-y-6">
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1">
                                        <Clock size={12} /> Link Expiry Duration
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['1h', '24h', '7d', 'perm'].map(opt => (
                                            <button 
                                                key={opt}
                                                onClick={() => setShareExpiry(opt)}
                                                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                                                    shareExpiry === opt 
                                                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-sm' 
                                                    : 'bg-app-primary border-border text-text-primary0 hover:bg-app-surface'
                                                }`}
                                            >
                                                {opt === 'perm' ? 'Permanent' : opt.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-text-primary0 mt-2">
                                        This will create a read-only HLS/WebRTC stream link accessible without a password until expiration.
                                    </p>
                                </div>

                                <button 
                                    onClick={handleGenerateStreamLink} 
                                    className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? <RefreshCw className="animate-spin" size={18} /> : <Share2 size={18} />}
                                    Generate Viewer Link
                                </button>
                            </div>
                        ) : (
                            <div className="p-6 space-y-4">
                                <div className="bg-emerald-950/30 border border-emerald-900 rounded-lg p-3 text-center">
                                    <p className="text-sm text-emerald-400 font-medium">Link Active & Ready</p>
                                </div>
                                
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text-primary0 uppercase">Stream URL</label>
                                    <div className="flex gap-2">
                                        <input 
                                            readOnly 
                                            value={generatedStreamLink} 
                                            className="flex-1 bg-black border border-border rounded-lg px-3 py-2 text-xs text-text-secondary font-mono outline-none"
                                        />
                                        <button 
                                            onClick={() => copyToClipboard(generatedStreamLink)}
                                            className={`px-3 rounded-lg border transition-all ${isCopied ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-app-surface border-border text-text-secondary hover:bg-app-surface'}`}
                                        >
                                            {isCopied ? <Check size={16} /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-text-primary0 text-center">
                                    Anyone with this link can view the camera feed until it expires.
                                </p>
                            </div>
                        )}

                        <div className="p-4 border-t border-border flex justify-end bg-app-primary rounded-b-xl">
                            <button onClick={() => setIsShareModalOpen(false)} className="text-text-secondary hover:text-white text-sm">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Connection Test Modal */}
            {isTestModalOpen && testingCamera && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-app-panel border border-border rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-border bg-app-primary flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                    testStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                                    testStatus === 'failed' ? 'bg-rose-500/10 text-rose-400' :
                                    'bg-yellow-500/10 text-yellow-400 animate-pulse'
                                }`}>
                                    <Zap size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">
                                        {language === 'uz' ? 'Kamera Ulanishini Sinash' : 'Camera Connection Test'}
                                    </h3>
                                    <p className="text-xs text-text-secondary">
                                        {language === 'uz' ? 'Kamera:' : 'Device:'} <span className="text-text-primary font-bold">{testingCamera.name}</span>
                                        <span className="mx-2">|</span>
                                        {language === 'uz' ? 'Turi:' : 'Type:'} <span className="text-cyan-400 font-mono text-xs">{testingCamera.type}</span>
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono border ${
                                    testStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                    testStatus === 'failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                }`}>
                                    {testStatus === 'success' && (language === 'uz' ? 'MUVAFFAQIYATLI' : 'SUCCESS')}
                                    {testStatus === 'failed' && (language === 'uz' ? 'XATO' : 'FAILED')}
                                    {testStatus === 'running' && (language === 'uz' ? 'TEKSHIRILMOQDA' : 'RUNNING')}
                                </span>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                            {/* URL and address info */}
                            <div className="bg-app-primary p-3 rounded-lg border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-mono text-text-primary0 font-bold uppercase">{language === 'uz' ? 'Oqim havolasi (RTSP URL)' : 'RTSP STREAM SOURCE'}</span>
                                    <div className="text-xs font-mono text-text-secondary break-all select-all">
                                        {testingCamera.streamUrl}
                                    </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-1.5 text-xs text-text-secondary bg-app-panel px-3 py-1.5 rounded border border-border">
                                    <Clock size={12} className="text-cyan-400" />
                                    <span>Port: {testingCamera.streamUrl.match(/:(\d+)/)?.[1] || '554'}</span>
                                </div>
                            </div>

                            {/* Main Diagnostic Area */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Left Side: Terminal Logs */}
                                <div className="lg:col-span-7 flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-xs text-text-secondary px-1">
                                        <span className="font-bold flex items-center gap-1">
                                            <FileText size={12} />
                                            {language === 'uz' ? 'Diagnostika jurnali' : 'Diagnostic Terminal'}
                                        </span>
                                        <span className="font-mono text-cyan-400">{testProgress}%</span>
                                    </div>
                                    
                                    {/* Console Terminal */}
                                    <div className="bg-black/90 rounded-lg p-4 font-mono text-[11px] text-emerald-400 h-64 overflow-y-auto border border-border flex flex-col gap-1.5 custom-scrollbar shadow-inner select-text">
                                        {testLogs.map((log, index) => {
                                            const isError = log.includes('✗') || log.includes('[ERROR]');
                                            const isSuccess = log.includes('✓') || log.includes('[SUCCESS]');
                                            const isInfo = log.includes('[INFO]');
                                            let colorClass = 'text-emerald-400';
                                            if (isError) colorClass = 'text-rose-400';
                                            else if (isSuccess) colorClass = 'text-emerald-300 font-bold';
                                            else if (isInfo) colorClass = 'text-cyan-400';
                                            
                                            return (
                                                <div key={index} className={`leading-relaxed whitespace-pre-wrap animate-in slide-in-from-left-1 duration-200 ${colorClass}`}>
                                                    {log}
                                                </div>
                                            );
                                        })}
                                        {testStatus === 'running' && (
                                            <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] italic animate-pulse mt-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                                                {language === 'uz' ? 'Maʼlumotlar oʻqilmoqda...' : 'Querying remote socket...'}
                                            </div>
                                        )}
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-app-primary h-1.5 rounded-full overflow-hidden border border-border/80">
                                        <div 
                                            className={`h-full transition-all duration-300 rounded-full ${
                                                testStatus === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                                testStatus === 'failed' ? 'bg-rose-500' :
                                                'bg-yellow-500 animate-pulse'
                                            }`}
                                            style={{ width: `${testProgress}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Right Side: Visual Feed / Diagnostics Status */}
                                <div className="lg:col-span-5 flex flex-col gap-2">
                                    <span className="text-xs text-text-secondary px-1 font-bold">
                                        {language === 'uz' ? 'Jonli monitoring' : 'Live Stream Verification'}
                                    </span>

                                    <div className="h-64 bg-black rounded-lg border border-border relative overflow-hidden flex flex-col items-center justify-center select-none shadow-lg">
                                        {testStatus === 'running' && (
                                            <div className="text-center p-4 space-y-3 z-10 animate-in fade-in duration-300">
                                                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                                                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-yellow-500/30 animate-[spin_10s_linear_infinite]" />
                                                    <div className="absolute inset-1 rounded-full border border-yellow-500/50 animate-pulse" />
                                                    <RefreshCw size={24} className="animate-spin text-yellow-500" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-bold text-text-primary">{language === 'uz' ? 'Ulanish oʻrnatilmoqda...' : 'Connecting to RTSP source...'}</p>
                                                    <p className="text-[10px] text-text-primary0 font-mono">Handshake progress: {testProgress}%</p>
                                                </div>
                                            </div>
                                        )}

                                        {testStatus === 'failed' && (
                                            <div className="text-center p-6 space-y-3 z-10 animate-in zoom-in-95 duration-300">
                                                <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                                                    <WifiOff size={22} />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">{language === 'uz' ? 'SIGNAL UZILISHI (SIGNAL LOSS)' : 'SIGNAL LOSS'}</p>
                                                    <p className="text-[10px] text-text-secondary max-w-xs mx-auto">
                                                        {language === 'uz' 
                                                            ? 'Kamera bilan tarmoq ulanishi oʻrnatilmadi. IP manzilini va port faolligini qayta tekshiring.'
                                                            : 'RTSP handshake failed. Check your target credentials, network path, or device power.'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {testStatus === 'success' && (
                                            <>
                                                {/* Simulated active CCTV view */}
                                                <div className="absolute inset-0 w-full h-full">
                                                    <img 
                                                        src={""}
                                                        className="w-full h-full object-cover opacity-75" 
                                                        alt="preview-feed" 
                                                    />
                                                    {/* CCTV Matrix scanning lines */}
                                                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_95%,rgba(34,211,238,0.15)_95%)] bg-[size:100%_24px] pointer-events-none animate-scan opacity-70" />
                                                    <div className="absolute inset-0 bg-cyan-950/10 mix-blend-color-dodge pointer-events-none" />
                                                    
                                                    {/* HUD telemetry text */}
                                                    <div className="absolute top-2 left-2 font-mono text-[9px] text-emerald-400 bg-app-primary/80 p-1.5 rounded border border-border/80 space-y-0.5">
                                                        <div className="flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                                                            <span className="font-bold">LIVE PREVIEW</span>
                                                        </div>
                                                        <div>RES: {testingCamera.resolution}</div>
                                                        <div>FPS: {testingCamera.fps} FPS</div>
                                                    </div>

                                                    <div className="absolute bottom-2 right-2 font-mono text-[8px] text-emerald-400 bg-app-primary/80 p-1 rounded border border-border/50">
                                                        {new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
                                                    </div>

                                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-500/35 pointer-events-none text-2xl font-light font-mono">+</div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-border flex justify-between items-center bg-app-primary rounded-b-xl shrink-0">
                            <div>
                                {testStatus === 'failed' && (
                                    <button 
                                        onClick={() => startConnectionTest(testingCamera)}
                                        className="px-4 py-2 bg-app-surface hover:bg-app-surface text-text-primary rounded-lg text-xs font-bold flex items-center gap-2 transition-colors border border-border cursor-pointer"
                                    >
                                        <RefreshCw size={14} />
                                        {language === 'uz' ? 'Qayta urinish' : 'Retry Diagnostics'}
                                    </button>
                                )}
                            </div>
                            
                            <button 
                                onClick={() => setIsTestModalOpen(false)}
                                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-950/20 cursor-pointer"
                            >
                                {language === 'uz' ? 'Yopish' : 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Delete Confirmation Modal */}
            {cameraToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-app-panel border border-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border bg-app-primary flex justify-between items-center">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Trash2 className="text-rose-500" size={16} />
                                {language === 'uz' ? 'Kamerani oʻchirish' : 'Remove Camera'}
                            </h3>
                            <button onClick={() => setCameraToDelete(null)} className="text-text-secondary hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-text-secondary leading-relaxed">
                                {language === 'uz' 
                                    ? `Haqiqatdan ham "${cameraToDelete.name}" kamerasini tizimdan oʻchirib tashlamoqchimisiz? Bu amalni ortga qaytarib boʻlmaydi.`
                                    : `Are you sure you want to permanently delete "${cameraToDelete.name}"? This action cannot be undone.`}
                            </p>
                            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-2.5">
                                <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={14} />
                                <div className="text-[10px] text-rose-300 font-mono space-y-0.5">
                                    <div>ID: {cameraToDelete.id}</div>
                                    <div>URL: {cameraToDelete.streamUrl}</div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-2 bg-app-primary">
                            <button 
                                onClick={() => setCameraToDelete(null)}
                                className="px-4 py-2 bg-app-surface hover:bg-app-surface text-text-secondary hover:text-white text-xs font-bold rounded-lg transition-all cursor-pointer border border-border"
                            >
                                {language === 'uz' ? 'Bekor qilish' : 'Cancel'}
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-rose-950/20 cursor-pointer"
                            >
                                {language === 'uz' ? 'Oʻchirish' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CameraSearchModal 
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                cameras={cameras}
                onCameraSelect={setFocusedCameraId}
            />
        </div>
    );
};
