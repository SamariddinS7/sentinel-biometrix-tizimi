import React, { useState } from 'react';
import { Search, Loader2, X, Camera as CameraIcon, CheckCircle2, ChevronRight } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { Camera, CameraStatus, CameraType } from '../types';
import { semanticCameraSearch, CameraFrame, SearchResult } from '../services/geminiService';

interface CameraSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    cameras: Camera[];
    onCameraSelect: (id: string) => void;
}

export const CameraSearchModal: React.FC<CameraSearchModalProps> = ({ isOpen, onClose, cameras, onCameraSelect }) => {
    const { t, language } = useLanguage();
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [result, setResult] = useState<SearchResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const convertUrlToBase64 = async (url: string): Promise<string | null> => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Failed to fetch image for search:", e);
            return null;
        }
    };

    const runSearch = async () => {
        if (!query.trim()) return;
        setIsSearching(true);
        setError(null);
        setResult(null);

        // Filter online cameras
        const onlineCameras = cameras.filter(c => c.status === CameraStatus.ONLINE);
        
        if (onlineCameras.length === 0) {
            setError(language === 'uz' ? 'Tizimda faol kameralar topilmadi.' : 'No active cameras found in the system.');
            setIsSearching(false);
            return;
        }

        const frames: CameraFrame[] = [];

        // Try to get frames
        for (const cam of onlineCameras) {
            // Use real streamUrl if present, otherwise fall back to stable reference images
            const url = cam.streamUrl || (cam.id === 'CAM-02' 
                ? "https://images.unsplash.com/photo-1518770660439-4636190af475?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80" 
                : "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80&grayscale");
            
            // In a real app, we'd grab from canvas/WebRTC if cam type is USB/Remote.
            if (cam.type !== CameraType.USB) {
                const base64 = await convertUrlToBase64(url);
                if (base64) {
                    frames.push({ cameraId: cam.id, cameraName: cam.name, base64Image: base64 });
                }
            }
        }

        if (frames.length === 0) {
            // Provide a fallback static 1x1 pixel image just to let Gemini know this camera exists but we couldn't get the frame
            for (const cam of onlineCameras) {
                frames.push({
                    cameraId: cam.id,
                    cameraName: cam.name,
                    base64Image: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//aAAgBAQABPxA="
                });
            }
        }

        const searchRes = await semanticCameraSearch(query, frames, language);
        if (searchRes) {
            setResult(searchRes);
        } else {
            setError(language === 'uz' ? 'Qidiruv jarayonida xatolik yuz berdi.' : 'An error occurred during the search process.');
        }

        setIsSearching(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
            <div className="bg-app-panel border border-border rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-4 border-b border-border flex justify-between items-center bg-app-primary/50 rounded-t-xl">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Search className="text-cyan-400" size={20} />
                        {language === 'uz' ? 'Aqlli Kamera Qidiruvi' : 'Smart Camera Search'}
                    </h2>
                    <button onClick={onClose} className="p-2 bg-app-surface hover:bg-app-surface rounded-full text-text-secondary transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                    {/* Search Input */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder={language === 'uz' ? "Masalan: Qizil futbolkali odam qayerda? Yoki mashina bormi?" : "E.g. Where is the person with a red shirt? Or is there a car?"}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && runSearch()}
                            className="w-full bg-app-primary border border-border rounded-xl px-4 py-4 pl-12 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-primary0" size={20} />
                        
                        <button 
                            onClick={runSearch}
                            disabled={isSearching || !query.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
                        >
                            {isSearching ? <Loader2 size={16} className="animate-spin" /> : <span>{language === 'uz' ? 'Qidirish' : 'Search'}</span>}
                        </button>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div className="p-4 bg-red-950/30 border border-red-900/50 text-red-400 rounded-lg text-sm bg-opacity-50 text-center">
                            {error}
                        </div>
                    )}

                    {/* Instructions / Loading */}
                    {!result && !isSearching && !error && (
                        <div className="flex-1 flex flex-col items-center justify-center text-text-primary0 py-12">
                            <CameraIcon size={48} className="mb-4 opacity-20" />
                            <p className="text-sm max-w-md text-center">
                                {language === 'uz' 
                                    ? "Sun'iy intellekt barcha faol kameralardan olingan kadrlarni tahlil qilib, so'rovingizga mos obyekt yoki hodisani topadi." 
                                    : "AI will analyze frames from all active cameras to find the object or event that matches your query."}
                            </p>
                        </div>
                    )}

                    {isSearching && (
                        <div className="flex-1 flex flex-col items-center justify-center text-cyan-500 py-12">
                            <Loader2 size={48} className="mb-4 animate-spin opacity-50" />
                            <p className="text-sm font-bold animate-pulse">
                                {language === 'uz' ? 'Kameralar tahlil qilinmoqda...' : 'Analyzing cameras...'}
                            </p>
                        </div>
                    )}

                    {/* Results */}
                    {result && !isSearching && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4">
                            <div className="bg-app-primary border border-border p-4 rounded-xl">
                                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">
                                    {language === 'uz' ? 'Xulosa' : 'Summary'}
                                </h3>
                                <p className="text-text-primary text-sm leading-relaxed">{result.summary}</p>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
                                    {language === 'uz' ? 'Mos keluvchi kameralar' : 'Matching Cameras'}
                                </h3>
                                
                                {result.matches.length === 0 ? (
                                    <div className="text-text-primary0 text-sm text-center py-4 bg-app-panel rounded-lg border border-border">
                                        {language === 'uz' ? "Hech qanday mos o'xshashlik topilmadi." : "No matches found."}
                                    </div>
                                ) : (
                                    result.matches.sort((a,b) => b.confidence - a.confidence).map((match, idx) => {
                                        const camDetails = cameras.find(c => c.id === match.cameraId);
                                        return (
                                            <div key={idx} className="bg-app-surface/50 hover:bg-app-surface border border-border hover:border-cyan-500/50 rounded-xl p-4 transition-all flex items-start gap-4">
                                                <div className="bg-app-primary p-3 rounded-lg flex flex-col items-center justify-center min-w-[80px] border border-border text-cyan-400 font-mono">
                                                    <span className="text-xl font-bold">{(match.confidence * 100).toFixed(0)}%</span>
                                                    <span className="text-[10px] uppercase">{language === 'uz' ? 'Moslik' : 'Match'}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="font-bold text-white flex items-center gap-2">
                                                            {camDetails?.name || match.cameraId}
                                                            {camDetails && <span className="text-[10px] font-mono text-text-primary0 bg-app-primary px-2 py-0.5 rounded">{camDetails.id}</span>}
                                                        </h4>
                                                    </div>
                                                    <p className="text-sm text-text-secondary mb-3">{match.explanation}</p>
                                                    <button 
                                                        onClick={() => {
                                                            onCameraSelect(match.cameraId);
                                                            onClose();
                                                        }}
                                                        className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                                                    >
                                                        {language === 'uz' ? 'Kamerani ochish' : 'View Camera'} <ChevronRight size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
