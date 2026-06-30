
import React, { useEffect, useState } from 'react';
import { AlertOctagon, X, EyeOff } from 'lucide-react';

interface SecurityAlert {
    type?: string;
    severity: string;
    camera_id?: string;
    track_id?: number | string;
    details?: string;
    message?: string; // Support both details (backend) and message (frontend sim)
    timestamp: string | number;
    snapshot?: string; // Base64 WebP
}

interface AlertBannerProps {
    alert: SecurityAlert | null;
    onDismiss: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ alert, onDismiss }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (alert) {
            setIsVisible(true);
            const timer = setTimeout(() => {
               // Auto-dismiss optional
            }, 10000);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [alert]);

    if (!isVisible || !alert) return null;

    // Safe accessors for mixed backend/frontend alert shapes
    const displayType = alert.type ? alert.type.replace(/_/g, ' ') : 'SECURITY ALERT';
    const displayDetails = alert.details || alert.message || 'Unknown Event';
    const displayTime = typeof alert.timestamp === 'number' 
        ? new Date(alert.timestamp).toLocaleTimeString() 
        : new Date(alert.timestamp).toLocaleTimeString();

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
            <div className="bg-red-950/90 backdrop-blur-md border border-red-500 rounded-lg shadow-[0_0_30px_rgba(220,38,38,0.5)] overflow-hidden">
                <div className="p-4 flex items-start gap-4">
                    <div className="bg-red-600 rounded-full p-2 shrink-0 animate-pulse">
                        <AlertOctagon className="text-white" size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-white font-bold text-lg leading-tight mb-1">SECURITY ALERT</h4>
                        <p className="text-red-200 text-sm font-medium uppercase tracking-wide">{displayType}</p>
                        <p className="text-red-300 text-xs mt-1">{displayDetails}</p>
                        <div className="flex gap-4 mt-2 text-[10px] text-red-400 font-mono uppercase">
                            {alert.camera_id && <span>CAM: {alert.camera_id}</span>}
                            {alert.track_id && <span>TRK: {alert.track_id}</span>}
                            <span>{displayTime}</span>
                        </div>
                    </div>
                    
                    {/* Privacy Snapshot Thumbnail */}
                    {alert.snapshot ? (
                        <div className="relative w-16 h-16 rounded overflow-hidden border border-red-500/50 shrink-0 bg-black">
                            <img src={alert.snapshot} alt="Evidence" className="w-full h-full object-cover opacity-80" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <EyeOff size={12} className="text-white/50" />
                            </div>
                        </div>
                    ) : null}

                    <button 
                        onClick={() => { setIsVisible(false); onDismiss(); }}
                        className="text-red-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="h-1 bg-red-800 w-full">
                    <div className="h-full bg-red-500 animate-[progress_10s_linear_forward]" style={{width: '100%'}}></div>
                </div>
            </div>
        </div>
    );
};
