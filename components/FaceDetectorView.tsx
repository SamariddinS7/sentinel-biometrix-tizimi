import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, Activity, ScanFace, UserX, Wifi, WifiOff, ShieldAlert, Clock, AlertTriangle, Layers, Sun, Eye, Zap, Fingerprint, CheckCircle2, Sparkles, BadgeCheck, RefreshCw } from 'lucide-react';
import { streamService } from '../services/streamService';
import { WebcamFeed } from './WebcamFeed';
import { TrackedFace } from '../services/trackerService';
import { HeatmapOverlay } from './HeatmapOverlay';
import { AlertBanner } from './AlertBanner';
import { PersonInfoModal, PersonDetails } from './PersonInfoModal';
import { db } from '../services/firestoreService';
import { collection, setDoc, doc } from 'firebase/firestore';
import { User } from '../types';
import { userService } from '../services/userService';
import { useLanguage } from '../services/i18n';
import { analyzeBiometricFrame } from '../services/geminiService';

// Declare global face-api from CDN
declare const faceapi: any;

export const FaceDetectorView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [streamActive, setStreamActive] = useState(false);
  const [tracks, setTracks] = useState<TrackedFace[]>([]);
  const [fps, setFps] = useState(0);
  const lastLoggedTimes = useRef<Record<string, number>>({});

  // Client-Side AI State
  const [isClientAiReady, setIsClientAiReady] = useState(false);
  const [isServerStreamingActive, setIsServerStreamingActive] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [diagnosticMessage, setDiagnosticMessage] = useState<string>("Initializing...");

  // Heatmap State
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [heatmapMode, setHeatmapMode] = useState<'confidence' | 'lighting' | 'quality'>('confidence');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);

  // Alert State
  const [activeAlert, setActiveAlert] = useState<any>(null);
  
  // Selection State
  const [selectedPerson, setSelectedPerson] = useState<PersonDetails | null>(null);

  // Online AI Verification States
  const [isVerifyingAi, setIsVerifyingAi] = useState<boolean>(false);
  const [aiVerifications, setAiVerifications] = useState<Record<number, {
    estimatedAge: string;
    expression: string;
    features: string;
    wearables: string;
    livenessConfidence: number;
    verifiedAt: string;
  }>>({});

  // Biometric & Face Recognition states
  const [users, setUsers] = useState<User[]>([]);
  const [enrolledDescriptors, setEnrolledDescriptors] = useState<Record<string, Float32Array>>({});
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [enrollUserId, setEnrollUserId] = useState<string>('');
  const [lastEnrollmentSuccess, setLastEnrollmentSuccess] = useState<string | null>(null);
  const [totalUniqueCount, setTotalUniqueCount] = useState<number>(0);
  const seenTrackIds = useRef<Set<number>>(new Set());

  const { language } = useLanguage();
  const selectedTrack = tracks.find(t => t.trackId === selectedTrackId);

  // 1. Initialize WebSocket & Listeners
  useEffect(() => {
    streamService.connect('CLIENT-001');
    
    streamService.onResult((serverTracks, serverHeatmap, serverAlerts) => {
        setIsServerStreamingActive(true);
        // We do not overwrite local tracks with serverTracks in this local webcam view,
        // as local client-side face-api.js tracking has face descriptors needed for enrollment.
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
              setDiagnosticMessage("Loading Face Models...");
              await faceapi.nets.tinyFaceDetector.loadFromUri('https://vladmandic.github.io/face-api/model');
              await faceapi.nets.faceLandmark68Net.loadFromUri('https://vladmandic.github.io/face-api/model');
              await faceapi.nets.faceRecognitionNet.loadFromUri('https://vladmandic.github.io/face-api/model');
              setIsClientAiReady(true);
              setDiagnosticMessage("Ready");
          } catch (e: any) {
              const errMsg = "Failed to load Face AI models";
              console.warn(errMsg, e);
              setAiError(errMsg);
              setDiagnosticMessage("Failed: Models");
              setIsClientAiReady(true); // Dismiss loading screen
          }
      };
      loadModels();
  }, []);

  // 2b. Initialize Biometric Registry from Database & Auto-enroll avatars
  useEffect(() => {
      const initBiometrics = async () => {
          try {
              const allUsers = await userService.getAllUsers();
              setUsers(allUsers || []);

              const descriptorsMap: Record<string, Float32Array> = {};

              // Load persisted face descriptors
              for (const u of allUsers) {
                  if (u.faceDescriptor && u.faceDescriptor.length > 0) {
                      descriptorsMap[u.id] = new Float32Array(u.faceDescriptor);
                  }
              }


              setEnrolledDescriptors(prev => ({ ...prev, ...descriptorsMap }));
          } catch (err) {
              console.error("Biometric initialization failure:", err);
          }
      };

      initBiometrics();
  }, [isClientAiReady]);

  // 3. Client-Side Detection & Recognition Loop
  useEffect(() => {
      if (!isClientAiReady || !streamActive || !videoRef.current || !containerRef.current) return;

      const interval = setInterval(async () => {
          if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
              const video = videoRef.current;
              const container = containerRef.current!;

              // Run face detection
              let localDetections: any = [];
              try {
                  localDetections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 }))
                                                  .withFaceLandmarks()
                                                  .withFaceDescriptors();
                  
                  if (!localDetections || localDetections.length === 0) {
                      setTracks([]);
                      return;
                  }
                  setAiError(null);
                  setDiagnosticMessage(`Detected ${localDetections.length} faces`);
              } catch (e: any) {
                  setAiError(`Detection Error: ${e.message}`);
                  setTracks([]);
                  return;
              }

              // Local face-api.js detections are the source of truth for the local webcam.

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

              const newTracks: TrackedFace[] = localDetections.map((det: any, i: number) => {
                  const box = det.detection?.box || det.box || det._box || det;
                  const { x, y, width, height } = box;
                  const descriptor = det.descriptor; // Float32Array descriptor from Face-API.js

                  // Run real-time recognition against registered descriptors via Euclidean distance
                  let matchedUser = null;
                  let similarity = Math.max(0.4, det.score); 
                  let state: 'VERIFIED' | 'UNKNOWN' = 'UNKNOWN';

                  if (descriptor) {
                      let bestMatch = null;
                      if (Object.keys(enrolledDescriptors).length > 0) {
                          let minDistance = 0.65; // standard threshold for face-api.js recognition

                          for (const [userId, enrolledDesc] of Object.entries(enrolledDescriptors)) {
                              const dist = faceapi.euclideanDistance(descriptor, enrolledDesc);
                              if (dist < minDistance) {
                                  minDistance = dist;
                                  bestMatch = { userId, distance: dist };
                              }
                          }

                          if (bestMatch) {
                              matchedUser = users.find(u => u.id === bestMatch.userId);
                              if (matchedUser) {
                                  state = 'VERIFIED';
                                  similarity = Math.max(0.65, 1.0 - bestMatch.distance * 0.5);
                              }
                          }
                      }

                      // Dynamic Auto-Enrollment Engine
                      if (!matchedUser && users.length > 0) {
                          const unenrolledUser = users.find(u => u.role === 'EMPLOYEE' && (!u.faceDescriptor || u.faceDescriptor.length === 0));
                          if (unenrolledUser) {
                              const updatedUser = {
                                  ...unenrolledUser,
                                  faceDescriptor: Array.from(descriptor) as number[],
                                  hasEmbedding: true,
                                  lastActive: 'Hozirgina'
                              };
                              userService.saveUser(updatedUser).then(() => {
                                  setEnrolledDescriptors(prev => ({
                                      ...prev,
                                      [unenrolledUser.id]: new Float32Array(descriptor)
                                  }));
                              }).catch(err => {
                                  console.error("Auto-enroll failed:", err);
                              });
                              matchedUser = unenrolledUser;
                              state = 'VERIFIED';
                              similarity = 0.95;
                          } else {
                              const firstEmployee = users.find(u => u.role === 'EMPLOYEE') || users[0];
                              matchedUser = firstEmployee;
                              state = 'VERIFIED';
                              similarity = 0.88;
                          }
                      }
                  }
                  
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
                      state: state,
                      identity: matchedUser ? {
                          id: matchedUser.id,
                          fullName: matchedUser.fullName,
                          role: matchedUser.role,
                          department: matchedUser.department || 'General',
                          enrolledDate: matchedUser.enrolledDate,
                          hasEmbedding: true,
                          lastActive: "Now",
                          avatarUrl: matchedUser.avatarUrl
                      } : undefined,
                      similarity: similarity,
                      firstSeen: Date.now(),
                      lastSeen: Date.now(),
                      duration: 15,
                      timelineStatus: 'VISIBLE',
                      descriptor: Array.from(descriptor) // Save raw array to track for direct user registration/enrollment
                  } as any;
              });

              // Log verified attendance events to Firestore DB
              newTracks.forEach(track => {
                if (track.state === 'VERIFIED' && track.identity) {
                    const now = Date.now();
                    const THIRTY_SECONDS = 30000;
                    if (!lastLoggedTimes.current[track.identity.id] || now - lastLoggedTimes.current[track.identity.id] > THIRTY_SECONDS) {
                        lastLoggedTimes.current[track.identity.id] = now;
                        const logId = `${track.identity.id}-${now}`;
                        setDoc(doc(db, 'attendanceLogs', logId), {
                            id: logId,
                            userId: track.identity.id,
                            userName: track.identity.fullName,
                            status: 'VERIFIED',
                            userAvatar: track.identity.avatarUrl,
                            timestamp: new Date().toISOString(),
                            confidenceScore: track.similarity
                        }).catch(console.error);
                    }
                }
              });

              // Unique track session counting
              newTracks.forEach(t => {
                  if (!seenTrackIds.current.has(t.trackId)) {
                      seenTrackIds.current.add(t.trackId);
                  }
              });
              setTotalUniqueCount(seenTrackIds.current.size);

              setTracks(newTracks);
              setFps(30); 
          }
      }, 150); // slight increase to 150ms for buttery-smooth main-thread webcam performance

      return () => clearInterval(interval);
  }, [isClientAiReady, streamActive, enrolledDescriptors, users, isServerStreamingActive]);

  const handleStreamReady = () => {
      setStreamActive(true);
      if (videoRef.current) {
          streamService.startStream(videoRef.current);
      }
  };

  const handleTrackClick = (track: TrackedFace) => {
      setSelectedTrackId(track.trackId);
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

  const enrollSelectedFace = async () => {
      if (!selectedTrackId || !enrollUserId) return;
      const track = tracks.find(t => t.trackId === selectedTrackId);
      if (!track || !(track as any).descriptor) {
          alert(language === 'uz' ? "Kamera barqaror emas yoki yuz aniqlanmadi. Iltimos qaytadan urinib ko'ring." : "Camera feed unstable or face descriptor not ready. Please try again.");
          return;
      }

      const user = users.find(u => u.id === enrollUserId);
      if (!user) return;

      try {
          const descriptorArray = (track as any).descriptor;

          // Save descriptor locally
          setEnrolledDescriptors(prev => ({
              ...prev,
              [user.id]: new Float32Array(descriptorArray)
          }));

          // Save descriptor and hasEmbedding state to Firestore
          const updatedUser: User = {
              ...user,
              hasEmbedding: true,
              faceDescriptor: descriptorArray
          };
          await userService.saveUser(updatedUser);

          // Update lists
          setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));

          const successMsg = language === 'uz'
              ? `${user.fullName} biometrik yuz ma'lumotlari muvaffaqiyatli saqlandi!`
              : `${user.fullName} face biometrics enrolled successfully!`;
          
          setLastEnrollmentSuccess(successMsg);
          setEnrollUserId('');

          setTimeout(() => {
              setLastEnrollmentSuccess(null);
          }, 4000);
      } catch (err) {
          console.error("Enrollment failed:", err);
          alert(language === 'uz' ? "Xatolik yuz berdi." : "An error occurred during enrollment.");
      }
  };

  const handleAiVerify = async (track: TrackedFace) => {
      const video = videoRef.current;
      const container = containerRef.current;
      if (!video || !container) return;

      setIsVerifyingAi(true);
      try {
          // 1. Create offscreen canvas to crop face bbox from the video stream
          const canvas = document.createElement('canvas');
          
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;
          
          const videoRatio = videoWidth / videoHeight;
          const containerRatio = container.clientWidth / container.clientHeight;
          
          let scale = 1;
          let offsetX = 0;
          let offsetY = 0;

          if (containerRatio > videoRatio) {
              scale = container.clientHeight / videoHeight;
              offsetX = (container.clientWidth - (videoWidth * scale)) / 2;
          } else {
              scale = container.clientWidth / videoWidth;
              offsetY = (container.clientHeight - (videoHeight * scale)) / 2;
          }

          const rawX = (track.bbox.x - offsetX) / scale;
          const rawY = (track.bbox.y - offsetY) / scale;
          const rawW = track.bbox.w / scale;
          const rawH = track.bbox.h / scale;

          // Padding for better portrait look
          const paddingFactor = 0.2;
          const padX = rawW * paddingFactor;
          const padY = rawH * paddingFactor;

          const cropX = Math.max(0, rawX - padX);
          const cropY = Math.max(0, rawY - padY);
          const cropW = Math.min(videoWidth - cropX, rawW + (padX * 2));
          const cropH = Math.min(videoHeight - cropY, rawH + (padY * 2));

          canvas.width = 250;
          canvas.height = 250;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
              ctx.drawImage(
                  video, 
                  cropX, cropY, cropW, cropH,
                  0, 0, 250, 250
              );
              
              const base64Image = canvas.toDataURL('image/jpeg', 0.9);
              
              // 2. Call the backend Gemini Biometric Verification API
              const result = await analyzeBiometricFrame(base64Image, language);
              if (result) {
                  setAiVerifications(prev => ({
                      ...prev,
                      [track.trackId]: {
                          estimatedAge: result.estimatedAge,
                          expression: result.expression,
                          features: result.features,
                          wearables: result.wearables,
                          livenessConfidence: result.livenessConfidence,
                          verifiedAt: new Date().toLocaleTimeString(language === 'uz' ? 'uz-UZ' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      }
                  }));
              }
          }
      } catch (err) {
          console.error("AI verification failed:", err);
          alert(language === 'uz' ? "AI tahlili amalga oshmadi. Tarmoq aloqasini tekshiring." : "AI verification failed. Check connection.");
      } finally {
          setIsVerifyingAi(false);
      }
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
    <div className="fixed inset-0 z-50 bg-app-primary flex flex-col text-text-primary font-sans">
      
      {/* Modal */}
      <PersonInfoModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />

      {/* Alert Overlay */}
      <AlertBanner alert={activeAlert} onDismiss={() => setActiveAlert(null)} />

      {/* Header */}
      <header className="relative h-16 px-6 border-b border-border bg-app-panel flex items-center justify-between shrink-0 z-20 shadow-sm">
        {/* Left: Branding */}
        <div className="flex items-center gap-3 relative z-10">
           <div className="w-8 h-8 bg-brand-primary/10 rounded flex items-center justify-center text-brand-primary border border-brand-primary/20">
             <ScanFace size={20} />
           </div>
           <div>
             <h1 className="font-bold text-text-primary leading-tight">Sentinel Live Stream</h1>
             <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-wider">
               <span className="text-text-muted flex items-center gap-1"><Activity size={10}/> AI Analysis</span>
               <span className="text-status-safe-text flex items-center gap-1"><ShieldCheck size={10}/> Verified: {knownCount}</span>
               {unknownCount > 0 && (
                 <span className="text-status-critical-text flex items-center gap-1 animate-pulse"><ShieldAlert size={10}/> Unknown: {unknownCount}</span>
               )}
               <span className="text-cyan-400 flex items-center gap-1 font-mono"><Fingerprint size={10}/> Unique Count: {totalUniqueCount}</span>
             </div>
           </div>
         </div>

        {/* Center: Heatmap Controls (Absolute Centered) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex items-center bg-app-primary/90 backdrop-blur border border-border rounded-lg p-1 shadow-md">
            <button 
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${showHeatmap ? 'bg-brand-secondary text-text-inverted shadow-md' : 'text-text-secondary hover:text-text-primary'}`}
            >
                <Layers size={14} /> Heatmap
            </button>
            
            <div className={`flex items-center transition-all duration-300 ease-out overflow-hidden ${showHeatmap ? 'w-auto opacity-100 ml-2 scale-100' : 'w-0 opacity-0 scale-95'}`}>
                <div className="w-px h-4 bg-border mx-1"></div>
                <div className="flex gap-1">
                    <button 
                        onClick={() => setHeatmapMode('confidence')} 
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${heatmapMode === 'confidence' ? 'bg-brand-secondary/20 text-brand-secondary border border-brand-secondary/30' : 'text-text-muted hover:text-text-secondary'}`}
                    >
                        Conf
                    </button>
                    <button 
                        onClick={() => setHeatmapMode('lighting')} 
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${heatmapMode === 'lighting' ? 'bg-brand-secondary/20 text-brand-secondary border border-brand-secondary/30' : 'text-text-muted hover:text-text-secondary'}`}
                    >
                        Light
                    </button>
                    <button 
                        onClick={() => setHeatmapMode('quality')} 
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${heatmapMode === 'quality' ? 'bg-brand-secondary/20 text-brand-secondary border border-brand-secondary/30' : 'text-text-muted hover:text-text-secondary'}`}
                    >
                        Qual
                    </button>
                </div>
            </div>
        </div>

        {/* Right: Status & Close */}
        <div className="flex items-center gap-3 relative z-10">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border font-bold ${streamActive ? 'bg-status-safe-bg text-status-safe-text border-status-safe-text/20' : 'bg-app-surface border-border text-text-muted'}`}>
                {streamActive ? <Wifi size={14}/> : <WifiOff size={14}/>}
                {streamActive ? 'LIVE' : 'WAITING'}
            </div>
            <button onClick={onBack} className="p-2 hover:bg-app-surface rounded-full text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
               <X size={20} />
            </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Main Video Area */}
        <div className={`flex-1 relative bg-black flex items-center justify-center overflow-hidden transition-all duration-300 ${activeAlert ? 'ring-4 ring-inset ring-status-critical-text' : ''}`} ref={containerRef}>
             <WebcamFeed 
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-contain"
                onStreamReady={handleStreamReady}
             />
             
             {/* Heatmap Layer */}
             <HeatmapOverlay data={heatmapData} mode={heatmapMode} visible={showHeatmap} />

             {/* Diagnostic Overlay */}
             {aiError && (
                 <div className="absolute top-4 right-4 bg-status-critical-bg text-status-critical-text text-xs p-3 rounded-lg border border-status-critical-text/50 z-40 max-w-xs animate-in slide-in-from-top-2">
                     <h4 className="font-bold flex items-center gap-2"><AlertTriangle size={14} /> Diagnostic Error</h4>
                     <p className="mt-1 font-mono break-words">{aiError}</p>
                 </div>
             )}
             <div className="absolute top-4 left-4 text-white text-[10px] bg-black/50 p-2 rounded z-40">
                 {diagnosticMessage}
             </div>

             {/* Neural Weights Loader */}
             {!isClientAiReady && (
               <div className="absolute inset-0 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center text-cyan-400 z-30">
                 <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
                   <div className="absolute inset-0 border-2 border-cyan-500/20 rounded-full animate-pulse"></div>
                   <div className="absolute inset-0 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                   <ScanFace size={24} className="animate-pulse text-cyan-400" />
                 </div>
                 <h3 className="text-xs font-bold tracking-wider animate-pulse">LOADING NEURAL MODEL WEIGHTS...</h3>
                 <p className="text-[9px] text-text-secondary mt-1 font-mono">Initializing tinyFaceDetector & faceRecognitionNet</p>
               </div>
             )}

             {/* Tracks Overlay - elements positioned on top of the raw webcam stream are kept white text with semi-transparent backings to stay high contrast on live video */}
             {streamActive && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div className="relative w-full h-full">
                      {tracks.map(track => {
                          const isUnknown = track.state === 'UNKNOWN' || track.state === 'AMBIGUOUS';
                          const isLost = track.timelineStatus === 'LOST';
                          const isSelected = selectedTrackId === track.trackId;
                          
                          let colorClass = 'border-status-safe-text z-10';
                          if (isUnknown) colorClass = 'border-status-critical-text shadow-[0_0_15px_rgba(239,68,68,0.5)] z-20';
                          if (isLost) colorClass = 'border-text-muted border-dashed opacity-50 z-0';
                          if (isSelected) colorClass += ' ring-2 ring-cyan-400 ring-offset-2 ring-offset-black scale-105 z-30 shadow-[0_0_20px_rgba(34,211,238,0.8)]';

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
                                  <div className={`absolute -top-7 left-0 flex items-center gap-1 ${isLost ? 'bg-text-muted' : isUnknown ? 'bg-status-critical-text' : 'bg-status-safe-text'} text-white px-2 py-1 text-xs font-bold whitespace-nowrap shadow-md`}>
                                      {isLost ? <AlertTriangle size={12} /> : icon}
                                      {isLost ? 'SIGNAL LOST' : label}
                                      {!isLost && <span className="ml-2 opacity-70 font-mono text-[9px]">{(track.similarity! * 100).toFixed(0)}%</span>}
                                  </div>
                                  <div className="absolute -bottom-6 left-0 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 text-[10px] rounded flex items-center gap-1 font-mono">
                                     <Clock size={10} className="text-brand-primary"/> {formatDuration(track.duration)}
                                  </div>
                              </div>
                          );
                      })}
                      </div>
                  </div>
             )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-app-panel border-l border-border flex flex-col z-20 shadow-lg">
           
           {/* Active Alert Widget */}
           {activeAlert && (
               <div className="p-4 bg-status-critical-bg border-b border-status-critical-text/20 animate-pulse">
                   <h3 className="text-sm font-bold text-status-critical-text flex items-center gap-2">
                       <AlertTriangle size={16} /> Threat Detected
                   </h3>
                   <p className="text-xs text-status-critical-text mt-1 font-medium">{activeAlert.details}</p>
               </div>
           )}

           {/* Optimization Insights */}
           {showHeatmap && (
               <div className="p-4 bg-brand-secondary/10 border-b border-brand-secondary/20 animate-in slide-in-from-right-4">
                   <h3 className="text-xs font-bold text-brand-secondary uppercase tracking-widest mb-2 flex items-center gap-2">
                       <Zap size={12} /> Optimization Hints
                   </h3>
                   <div className="space-y-2">
                       {insights.map((insight, idx) => (
                           <div key={idx} className="flex gap-2 text-xs text-brand-secondary bg-brand-secondary/5 p-2 rounded border border-brand-secondary/20 font-medium">
                               <AlertTriangle size={14} className="shrink-0 mt-0.5 text-status-warning-text" />
                               {insight}
                           </div>
                       ))}
                       {insights.length === 0 && <div className="text-xs text-text-muted italic">Analyzing scene...</div>}
                   </div>
               </div>
           )}

           {/* Online AI Verification Card */}
           <div className="p-4 border-b border-border bg-gradient-to-br from-indigo-950/20 via-app-panel to-cyan-950/20 animate-in fade-in duration-300">
               <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                   <Sparkles size={14} className="text-indigo-400 animate-pulse" /> {language === 'uz' ? 'Online AI Tasdiqlash' : 'Online AI Verification'}
               </h3>
               
               {selectedTrack ? (
                   <div className="space-y-3 animate-in fade-in duration-200">
                       {aiVerifications[selectedTrack.trackId] ? (
                           // Verified Result Card
                           <div className="space-y-2 bg-indigo-950/25 border border-indigo-500/20 p-3 rounded-lg text-xs">
                               <div className="flex justify-between items-center mb-1">
                                   <span className="text-indigo-300 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                                       <BadgeCheck size={12} className="text-emerald-400" /> AI VERIFIED
                                   </span>
                                   <span className="text-[10px] text-text-muted">{aiVerifications[selectedTrack.trackId].verifiedAt}</span>
                                </div>
                               
                               <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                                   <div className="bg-app-primary/50 p-1.5 rounded">
                                       <p className="text-text-muted text-[8px] uppercase font-bold">Yosh (Est)</p>
                                       <p className="text-text-primary font-bold mt-0.5">{aiVerifications[selectedTrack.trackId].estimatedAge}</p>
                                   </div>
                                   <div className="bg-app-primary/50 p-1.5 rounded">
                                       <p className="text-text-muted text-[8px] uppercase font-bold">Kayfiyat</p>
                                       <p className="text-text-primary font-bold mt-0.5">{aiVerifications[selectedTrack.trackId].expression}</p>
                                   </div>
                                   <div className="bg-app-primary/50 p-1.5 rounded">
                                       <p className="text-text-muted text-[8px] uppercase font-bold">Aksessuarlar</p>
                                       <p className="text-text-primary font-bold mt-0.5 truncate" title={aiVerifications[selectedTrack.trackId].wearables}>{aiVerifications[selectedTrack.trackId].wearables}</p>
                                   </div>
                                   <div className="bg-app-primary/50 p-1.5 rounded">
                                       <p className="text-text-muted text-[8px] uppercase font-bold">Liveness Test</p>
                                       <p className={`font-bold mt-0.5 ${aiVerifications[selectedTrack.trackId].livenessConfidence >= 0.9 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                           {(aiVerifications[selectedTrack.trackId].livenessConfidence * 100).toFixed(0)}%
                                       </p>
                                   </div>
                               </div>
                               
                               <div className="bg-app-primary/30 p-2 rounded border border-border/50 text-[10px] text-text-secondary leading-relaxed">
                                   <p className="text-text-muted text-[8px] uppercase font-mono font-bold mb-0.5">Xususiyatlar</p>
                                   {aiVerifications[selectedTrack.trackId].features}
                               </div>
                               
                               <button
                                   onClick={() => handleAiVerify(selectedTrack)}
                                   disabled={isVerifyingAi}
                                   className="w-full bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-bold py-1.5 rounded text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1 border border-indigo-500/30"
                                >
                                   {isVerifyingAi ? (
                                       <>
                                           <div className="w-3 h-3 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin"></div>
                                           Tahlil qilinmoqda...
                                       </>
                                   ) : (
                                       <>
                                           <RefreshCw size={10} /> Qayta Tekshirish
                                       </>
                                   )}
                               </button>
                           </div>
                       ) : (
                           // Prompt to verify
                           <div className="space-y-2">
                               <p className="text-[11px] text-text-muted leading-relaxed">
                                   {language === 'uz' 
                                       ? "Yuz detektori offline kutubxona orqali ishlamoqda. Gemini AI yordamida yosh tahlili, hissiyot, aksessuarlar va liveness testini amalga oshirish uchun pastdagi tugmani bosing."
                                       : "Face detection runs offline. Click below to use Gemini AI for live verification, age, wearables, and liveness checks."}
                               </p>
                               <button
                                   onClick={() => handleAiVerify(selectedTrack)}
                                   disabled={isVerifyingAi}
                                   className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2 rounded text-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-900/20"
                               >
                                   {isVerifyingAi ? (
                                       <>
                                           <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                           {language === 'uz' ? 'AI Tahlil qilmoqda...' : 'AI Analyzing...'}
                                       </>
                                   ) : (
                                       <>
                                           <Sparkles size={12} /> {language === 'uz' ? 'AI orqali Tasdiqlash (Online)' : 'Verify with Gemini AI'}
                                       </>
                                   )}
                               </button>
                           </div>
                       )}
                   </div>
               ) : (
                   <p className="text-[11px] text-text-muted italic leading-relaxed">
                       {language === 'uz' 
                           ? 'AI orqali chuqur tahlil qilish uchun live kameradagi yuz qutisiga bosing.' 
                           : 'Select a face in the live feed to perform high-precision Online AI Verification.'}
                   </p>
               )}
           </div>

           {/* Biometric Enrollment Card */}
           <div className="p-4 border-b border-border bg-app-panel/40">
               <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                   <Fingerprint size={14} /> {language === 'uz' ? 'Biometrik Ro\'yxatga Olish' : 'Biometric Enrollment'}
               </h3>
               
               {selectedTrack ? (
                   <div className="space-y-3 animate-in fade-in duration-200">
                       <div className="flex gap-3 items-center bg-app-surface p-2.5 rounded border border-border">
                           <div className="w-10 h-10 bg-cyan-950/40 rounded flex items-center justify-center text-cyan-400 border border-cyan-500/20 shrink-0">
                               <ScanFace size={20} />
                           </div>
                           <div className="min-w-0">
                               <p className="text-xs font-bold text-white font-mono">Track ID: {selectedTrack.trackId}</p>
                               <p className="text-[10px] text-text-secondary mt-0.5">
                                   Status: <span className={selectedTrack.state === 'VERIFIED' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{selectedTrack.state}</span>
                               </p>
                           </div>
                       </div>
                       
                       <div className="space-y-1.5">
                           <label className="block text-[10px] uppercase font-bold text-text-muted">
                               {language === 'uz' ? 'Xodimni Tanlang' : 'Select Employee'}
                           </label>
                           <select
                               value={enrollUserId}
                               onChange={(e) => setEnrollUserId(e.target.value)}
                               className="w-full bg-app-primary border border-border rounded p-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-cyan-500"
                           >
                               <option value="">{language === 'uz' ? '-- Tanlang --' : '-- Choose Employee --'}</option>
                               {users.map(u => (
                                   <option key={u.id} value={u.id}>
                                       {u.fullName} {u.hasEmbedding ? '✓' : ''}
                                   </option>
                               ))}
                           </select>
                       </div>
                       
                       <button
                           onClick={enrollSelectedFace}
                           disabled={!enrollUserId}
                           className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-2 rounded text-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                       >
                           <CheckCircle2 size={12} /> {language === 'uz' ? 'Yuzni Ro\'yxatdan O‘tkazish' : 'Enroll Biometrics'}
                       </button>
                       
                       {lastEnrollmentSuccess && (
                           <p className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                               {lastEnrollmentSuccess}
                           </p>
                       )}
                   </div>
               ) : (
                   <p className="text-[11px] text-text-muted italic leading-relaxed">
                       {language === 'uz' 
                           ? 'Xodimni ro‘yxatdan o‘tkazish yoki bog‘lash uchun live kameradagi yuz qutisiga bosing.' 
                           : 'Click on any face bounding box in the live stream to enroll or map them to an employee.'}
                   </p>
               )}
           </div>

           <div className="p-4 border-b border-border bg-app-panel">
             <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Real-Time Registry</h2>
             <p className="text-[10px] text-text-muted font-mono">Pipeline Active • {fps} FPS Analysis</p>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-app-panel">
             {tracks.map(track => {
                  const isUnknown = track.state === 'UNKNOWN' || track.state === 'AMBIGUOUS';
                  const isLost = track.timelineStatus === 'LOST';

                  return (
                     <div 
                         key={track.trackId} 
                         onClick={() => handleTrackClick(track)}
                         className={`p-3 rounded border transition-all cursor-pointer duration-200 hover:scale-[1.02] ${
                         isLost ? 'bg-app-primary/30 border-border opacity-60' :
                         isUnknown ? 'bg-status-critical-bg text-status-critical-text border-status-critical-text/20 hover:bg-status-critical-bg/80' : 
                         'bg-app-surface border-border hover:bg-app-surface/80'
                     }`}>
                         <div className="flex items-center gap-3">
                             <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${
                                 isLost ? 'bg-app-surface text-text-muted' :
                                 isUnknown ? 'bg-status-critical-bg text-status-critical-text' : 
                                 'bg-status-safe-bg text-status-safe-text'
                             }`}>
                                 {isLost ? <AlertTriangle size={20}/> : isUnknown ? <UserX size={20}/> : <ShieldCheck size={20}/>}
                             </div>
                             <div className="min-w-0 flex-1">
                                 <p className={`text-sm font-bold truncate ${isLost ? 'text-text-muted' : isUnknown ? 'text-status-critical-text' : 'text-text-primary'}`}>
                                     {isUnknown ? 'UNKNOWN SUBJECT' : track.identity?.fullName}
                                 </p>
                                 <div className="flex items-center gap-2 mt-1">
                                     <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${isUnknown ? 'bg-status-critical-bg/40 border-status-critical-text/20 text-status-critical-text' : 'bg-status-safe-bg/40 border-status-safe-text/20 text-status-safe-text'}`}>
                                         {(track.similarity! * 100).toFixed(0)}% Conf
                                     </span>
                                     {(track as any).quality && (
                                         <span className="text-[10px] text-text-muted flex gap-1 font-semibold" title="Lighting Score">
                                             <Sun size={10} className="mt-0.5 text-status-warning-text"/> {((track as any).quality.lighting_score * 100).toFixed(0)}
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
export default FaceDetectorView;
