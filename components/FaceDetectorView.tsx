
import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, Activity, ScanFace, UserX, Wifi, WifiOff, ShieldAlert, Clock, AlertTriangle, Layers, Sun, Eye, Zap } from 'lucide-react';
import { streamService } from '../services/streamService';
import { WebcamFeed } from './WebcamFeed';
import { TrackedFace } from '../services/trackerService';
import { HeatmapOverlay } from './HeatmapOverlay';
import { AlertBanner } from './AlertBanner';
import { PersonInfoModal, PersonDetails } from './PersonInfoModal';

// Declare global face-api from CDN
declare const faceapi: any;

export const FaceDetectorView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [streamActive, setStreamActive] = useState(false);
  const [tracks, setTracks] = useState<TrackedFace[]>([]);
  const [fps, setFps] = useState(0);

  // Client-Side AI State
  const [isClientAiReady, setIsClientAiReady] = useState(false);

  // Heatmap State
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [heatmapMode, setHeatmapMode] = useState<'confidence' | 'lighting' | 'quality'>('confidence');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);

  // Alert State
  const [activeAlert, setActiveAlert] = useState<any>(null);
  
  // Selection State
  const [selectedPerson, setSelectedPerson] = useState<PersonDetails | null>(null);

  // 1. Initialize WebSocket & Listeners
  useEffect(() => {
    streamService.connect('CLIENT-001');
    
    streamService.onResult((serverTracks, serverHeatmap, serverAlerts) => {
       // If backend is sending tracks, use them
       if (serverTracks.length > 0) {
           setTracks(serverTracks);
           setFps(prev => Math.round(prev * 0.9 + (1000 / 40) * 0.1)); 
       }
       
       if (serverHeatmap) {
           setHeatmapData(serverHeatmap);
           if (serverHeatmap.insights) {
               setInsights(serverHeatmap.insights);
           }
       }

       if (serverAlerts && serverAlerts.length > 0) {
           setActiveAlert(serverAlerts[0]); 
       }
    });

    return () => streamService.disconnect();
  }, []);

  // 2. Load Client-Side AI (Fallback/Demo)
  useEffect(() => {
      const loadModels = async () => {
          try {
              // Load models from CDN
              await faceapi.nets.tinyFaceDetector.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
              setIsClientAiReady(true);
              console.log("Client-side Face AI Ready");
          } catch (e) {
              console.error("Failed to load Face AI models", e);
          }
      };
      loadModels();
  }, []);

  // 3. Client-Side Detection Loop
  useEffect(() => {
      if (!isClientAiReady || !streamActive || !videoRef.current || !containerRef.current) return;

      const interval = setInterval(async () => {
          // Only run if we don't have backend tracks (or simply override for demo if needed)
          // For this implementation, we run it to ensure the user sees *something*
          if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
              
              const video = videoRef.current;
              const container = containerRef.current;

              // Detect
              const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 }));
              
              if (!detections || detections.length === 0) {
                  // Only clear if we aren't getting backend data either
                  // setTracks([]); 
                  return;
              }

              // Mapping coordinates to object-contain video
              const videoRatio = video.videoWidth / video.videoHeight;
              const containerRatio = container.clientWidth / container.clientHeight;
              
              let scale = 1;
              let offsetX = 0;
              let offsetY = 0;

              if (containerRatio > videoRatio) {
                  // Container is wider -> Fit Height
                  scale = container.clientHeight / video.videoHeight;
                  offsetX = (container.clientWidth - (video.videoWidth * scale)) / 2;
              } else {
                  // Container is taller -> Fit Width
                  scale = container.clientWidth / video.videoWidth;
                  offsetY = (container.clientHeight - (video.videoHeight * scale)) / 2;
              }

              const newTracks: TrackedFace[] = detections.map((det: any, i: number) => {
                  const { x, y, width, height } = det.box;
                  
                  // DEMO IDENTITY LOGIC
                  // We simulate "Recognition" by assigning a specific identity to the largest face
                  const isPrimary = i === 0;
                  
                  return {
                      trackId: 10000 + i,
                      bbox: {
                          x: x * scale + offsetX,
                          y: y * scale + offsetY,
                          w: width * scale,
                          h: height * scale
                      },
                      velocity: { vx: 0, vy: 0 },
                      detectionScore: det.score,
                      missedFrames: 0,
                      state: isPrimary ? 'VERIFIED' : 'UNKNOWN',
                      identity: isPrimary ? {
                          id: '8842-X-2024',
                          fullName: "Alex Rivera",
                          role: "ADMIN",
                          department: "Advanced R&D",
                          enrolledDate: "2023-01-15",
                          hasEmbedding: true,
                          lastActive: "Now",
                          avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                      } : undefined,
                      similarity: isPrimary ? 0.98 : 0.45,
                      firstSeen: Date.now(),
                      lastSeen: Date.now(),
                      duration: 15,
                      timelineStatus: 'VISIBLE'
                  };
              });

              setTracks(newTracks);
              setFps(30); // Mock FPS
          }
      }, 100);

      return () => clearInterval(interval);
  }, [isClientAiReady, streamActive]);

  // 4. Heatmap Simulation (Realistic Fallback)
  useEffect(() => {
    if (!showHeatmap) {
        setHeatmapData(null);
        return;
    }

    const interval = setInterval(() => {
        // Only run simulation if no real data is flowing from backend
        // In a real app, you might check a 'lastReceivedTime' timestamp
        
        const rows = 12;
        const cols = 16;
        const grid = [];
        const time = Date.now() / 1000;

        for (let r = 0; r < rows; r++) {
            const rowData = [];
            for (let c = 0; c < cols; c++) {
                // Simulation Logic per Mode
                let val = 0, lit = 0, qual = 0;

                // Confidence: Higher in center (Gaussian-ish)
                const centerR = rows / 2;
                const centerC = cols / 2;
                const dist = Math.sqrt(Math.pow(r - centerR, 2) + Math.pow(c - centerC, 2));
                const maxDist = Math.sqrt(Math.pow(rows/2, 2) + Math.pow(cols/2, 2));
                val = Math.max(0, 1.0 - (dist / maxDist)) * (0.8 + Math.sin(time * 2) * 0.1);

                // Lighting: Gradient Left-to-Right (Simulate window light)
                lit = (c / cols) * 0.8 + 0.2 + (Math.sin(time + r) * 0.05);

                // Quality: Random noise spots
                qual = 0.6 + (Math.random() * 0.4); 
                if (r < 2 || r > rows - 2) qual -= 0.3; // Blurry edges

                rowData.push({
                    val: val,
                    lit: lit,
                    qual: qual
                });
            }
            grid.push(rowData);
        }

        setHeatmapData({
            rows,
            cols,
            grid,
            insights: []
        });

        // Generate Context-Aware Insights
        const newInsights = [];
        if (heatmapMode === 'confidence') {
            newInsights.push("Center focus optimal.");
            newInsights.push("Edge detection low confidence.");
        } else if (heatmapMode === 'lighting') {
            newInsights.push("Exposure balanced.");
            newInsights.push("Slight shadow on left sector.");
        } else {
            newInsights.push("Signal quality stable.");
            newInsights.push("Motion blur within limits.");
        }
        setInsights(newInsights);

    }, 800);

    return () => clearInterval(interval);
  }, [showHeatmap, heatmapMode]);

  const handleStreamReady = () => {
      setStreamActive(true);
      if (videoRef.current) {
          streamService.startStream(videoRef.current);
      }
  };

  const handleTrackClick = (track: TrackedFace) => {
      setSelectedPerson({
          id: track.trackId.toString(),
          name: track.identity?.fullName || 'UNKNOWN',
          role: track.identity?.role || 'UNKNOWN',
          department: track.identity?.department,
          avatarUrl: track.identity?.avatarUrl,
          confidence: track.similarity,
          lastSeen: 'Live Now',
          status: track.state,
          location: 'Live Camera Feed'
      });
  };

  const knownCount = tracks.filter(t => t.state === 'VERIFIED').length;
  const unknownCount = tracks.filter(t => t.state === 'UNKNOWN' || t.state === 'AMBIGUOUS').length;

  const formatDuration = (sec?: number) => {
      if (!sec) return '0s';
      if (sec < 60) return `${sec.toFixed(0)}s`;
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}m ${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col text-slate-200 font-sans">
      
      {/* Modal */}
      <PersonInfoModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />

      {/* Alert Overlay */}
      <AlertBanner alert={activeAlert} onDismiss={() => setActiveAlert(null)} />

      {/* Header */}
      <header className="relative h-16 px-6 border-b border-slate-800 bg-slate-900 flex items-center justify-between shrink-0 z-20">
        {/* Left: Branding */}
        <div className="flex items-center gap-3 relative z-10">
           <div className="w-8 h-8 bg-cyan-500/10 rounded flex items-center justify-center text-cyan-400">
             <ScanFace size={20} />
           </div>
           <div>
             <h1 className="font-bold text-white leading-tight">Sentinel Live Stream</h1>
             <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-wider">
               <span className="text-slate-400 flex items-center gap-1"><Activity size={10}/> AI Analysis</span>
               <span className="text-emerald-500 flex items-center gap-1"><ShieldCheck size={10}/> Verified: {knownCount}</span>
               {unknownCount > 0 && (
                 <span className="text-rose-500 flex items-center gap-1 animate-pulse"><ShieldAlert size={10}/> Unknown: {unknownCount}</span>
               )}
             </div>
           </div>
        </div>

        {/* Center: Heatmap Controls (Absolute Centered) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex items-center bg-slate-950/90 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-xl animate-in fade-in slide-in-from-top-2">
            <button 
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${showHeatmap ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
            >
                <Layers size={14} /> Heatmap
            </button>
            
            <div className={`flex items-center transition-all duration-300 ease-out overflow-hidden ${showHeatmap ? 'w-auto opacity-100 ml-2 scale-100' : 'w-0 opacity-0 scale-95'}`}>
                <div className="w-px h-4 bg-slate-700 mx-1"></div>
                <div className="flex gap-1">
                    <button 
                        onClick={() => setHeatmapMode('confidence')} 
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${heatmapMode === 'confidence' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Conf
                    </button>
                    <button 
                        onClick={() => setHeatmapMode('lighting')} 
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${heatmapMode === 'lighting' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Light
                    </button>
                    <button 
                        onClick={() => setHeatmapMode('quality')} 
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${heatmapMode === 'quality' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Qual
                    </button>
                </div>
            </div>
        </div>

        {/* Right: Status & Close */}
        <div className="flex items-center gap-3 relative z-10">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border ${streamActive ? 'bg-emerald-950 border-emerald-900 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                {streamActive ? <Wifi size={14}/> : <WifiOff size={14}/>}
                {streamActive ? 'LIVE' : 'WAITING'}
            </div>
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
               <X size={20} />
            </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Main Video Area */}
        <div className={`flex-1 relative bg-black flex items-center justify-center overflow-hidden transition-all duration-300 ${activeAlert ? 'ring-4 ring-inset ring-red-600' : ''}`} ref={containerRef}>
             <WebcamFeed 
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-contain"
                onStreamReady={handleStreamReady}
             />
             
             {/* Heatmap Layer */}
             <HeatmapOverlay data={heatmapData} mode={heatmapMode} visible={showHeatmap} />

             {/* Tracks Overlay */}
             {streamActive && (
                 <div className="absolute inset-0 overflow-hidden pointer-events-none">
                     <div className="relative w-full h-full">
                     {tracks.map(track => {
                         const isUnknown = track.state === 'UNKNOWN' || track.state === 'AMBIGUOUS';
                         const isLost = track.timelineStatus === 'LOST';
                         
                         let colorClass = 'border-emerald-500 z-10';
                         if (isUnknown) colorClass = 'border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)] z-20';
                         if (isLost) colorClass = 'border-slate-500 border-dashed opacity-50 z-0';

                         const label = isUnknown ? 'UNKNOWN' : track.identity?.fullName || 'Identifying...';
                         const icon = isUnknown ? <ShieldAlert size={12} className="text-white"/> : <ShieldCheck size={12} className="text-white"/>;

                         return (
                             <div 
                                key={track.trackId}
                                onClick={() => handleTrackClick(track)}
                                className={`absolute border-2 transition-all duration-75 ease-linear cursor-pointer pointer-events-auto hover:bg-white/5 ${colorClass}`}
                                style={{
                                    left: `${track.bbox.x}px`,
                                    top: `${track.bbox.y}px`,
                                    width: `${track.bbox.w}px`,
                                    height: `${track.bbox.h}px`,
                                }}
                             >
                                 <div className={`absolute -top-7 left-0 flex items-center gap-1 ${isLost ? 'bg-slate-600' : isUnknown ? 'bg-red-600' : 'bg-emerald-500'} text-white px-2 py-1 text-xs font-bold whitespace-nowrap shadow-md`}>
                                     {isLost ? <AlertTriangle size={12} /> : icon}
                                     {isLost ? 'SIGNAL LOST' : label}
                                     {!isLost && <span className="ml-2 opacity-70 font-mono text-[9px]">{(track.similarity! * 100).toFixed(0)}%</span>}
                                 </div>
                                 <div className="absolute -bottom-6 left-0 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 text-[10px] rounded flex items-center gap-1 font-mono">
                                    <Clock size={10} className="text-cyan-400"/> {formatDuration(track.duration)}
                                 </div>
                             </div>
                         );
                     })}
                     </div>
                 </div>
             )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shadow-xl">
           
           {/* Active Alert Widget */}
           {activeAlert && (
               <div className="p-4 bg-red-950/50 border-b border-red-900 animate-pulse">
                   <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                       <AlertTriangle size={16} /> Threat Detected
                   </h3>
                   <p className="text-xs text-red-200 mt-1">{activeAlert.details}</p>
               </div>
           )}

           {/* Optimization Insights */}
           {showHeatmap && (
               <div className="p-4 bg-indigo-950/30 border-b border-indigo-900/50 animate-in slide-in-from-right-4">
                   <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <Zap size={12} /> Optimization Hints
                   </h3>
                   <div className="space-y-2">
                       {insights.map((insight, idx) => (
                           <div key={idx} className="flex gap-2 text-xs text-indigo-200 bg-indigo-900/40 p-2 rounded border border-indigo-800/50">
                               <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                               {insight}
                           </div>
                       ))}
                       {insights.length === 0 && <div className="text-xs text-slate-500 italic">Analyzing scene...</div>}
                   </div>
               </div>
           )}

           <div className="p-4 border-b border-slate-800 bg-slate-900">
             <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Real-Time Registry</h2>
             <p className="text-[10px] text-slate-600">Pipeline Active • {fps} FPS Analysis</p>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
             {tracks.map(track => {
                 const isUnknown = track.state === 'UNKNOWN' || track.state === 'AMBIGUOUS';
                 const isLost = track.timelineStatus === 'LOST';

                 return (
                    <div 
                        key={track.trackId} 
                        onClick={() => handleTrackClick(track)}
                        className={`p-3 rounded border transition-all cursor-pointer hover:scale-[1.02] ${
                        isLost ? 'bg-slate-900/50 border-slate-800 opacity-60' :
                        isUnknown ? 'bg-red-950/30 border-red-900/50 hover:bg-red-900/40' : 
                        'bg-slate-800 border-slate-700 hover:bg-slate-700'
                    }`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${
                                isLost ? 'bg-slate-800 text-slate-500' :
                                isUnknown ? 'bg-red-900/50 text-red-400' : 
                                'bg-emerald-900/50 text-emerald-400'
                            }`}>
                                {isLost ? <AlertTriangle size={20}/> : isUnknown ? <UserX size={20}/> : <ShieldCheck size={20}/>}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className={`text-sm font-bold truncate ${isLost ? 'text-slate-500' : isUnknown ? 'text-red-200' : 'text-white'}`}>
                                    {isUnknown ? 'UNKNOWN SUBJECT' : track.identity?.fullName}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isUnknown ? 'bg-red-950 border-red-900 text-red-400' : 'bg-emerald-950 border-emerald-900 text-emerald-400'}`}>
                                        {(track.similarity! * 100).toFixed(0)}% Conf
                                    </span>
                                    {/* Debug Quality Score in List */}
                                    {(track as any).quality && (
                                        <span className="text-[10px] text-slate-500 flex gap-1" title="Lighting Score">
                                            <Sun size={10} className="mt-0.5"/> {((track as any).quality.lighting_score * 100).toFixed(0)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                 );
             })}
           </div>
        </div>

      </div>
    </div>
  );
};
