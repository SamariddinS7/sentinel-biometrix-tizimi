import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { Camera, AlertCircle } from 'lucide-react';
import { settingsService } from '../services/settingsService';

interface WebcamFeedProps {
  onStreamReady?: () => void;
  onError?: (error: any) => void;
  className?: string;
  overlay?: React.ReactNode;
}

export const WebcamFeed = forwardRef<HTMLVideoElement, WebcamFeedProps>(({ onStreamReady, onError, className, overlay }, ref) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Expose the video element to the parent component
  useImperativeHandle(ref, () => internalVideoRef.current!);

  useEffect(() => {
    let active = true;
    let localStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch User Settings
        let settings;
        try {
          const sysSettings = await settingsService.getSettings();
          settings = sysSettings.camera;
        } catch (e) {
          console.warn("Failed to get system settings, using defaults:", e);
        }

        const width = settings?.resolution ? Number(settings.resolution.split('x')[0]) : 1280;
        const height = settings?.resolution ? Number(settings.resolution.split('x')[1]) : 720;
        const fps = settings?.fpsLimit || 30;

        // Sequence of constraints from most specific/preferred to most generic
        const constraintOptions = [
          // Preferred configuration
          {
            video: {
              width: { ideal: width },
              height: { ideal: height },
              frameRate: { max: fps },
              facingMode: 'user'
            }
          },
          // Drop facingMode
          {
            video: {
              width: { ideal: width },
              height: { ideal: height },
              frameRate: { max: fps }
            }
          },
          // Drop frameRate
          {
            video: {
              width: { ideal: width },
              height: { ideal: height }
            }
          },
          // Standard HD fallback
          {
            video: {
              width: 1280,
              height: 720
            }
          },
          // Absolutely minimal generic video fallback
          {
            video: true
          }
        ];

        let success = false;
        let lastError = null;

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          for (const constraints of constraintOptions) {
            try {
              if (!active) return;
              console.log("Attempting getUserMedia with constraints:", constraints);
              const streamInstance = await navigator.mediaDevices.getUserMedia(constraints);
              
              if (!active) {
                streamInstance.getTracks().forEach(track => track.stop());
                return;
              }
              
              localStream = streamInstance;
              success = true;
              console.log("getUserMedia succeeded with constraints:", constraints);
              break; // Success! Exit loop
            } catch (err) {
              console.warn("Constraint attempt failed:", constraints, err);
              lastError = err;
            }
          }
        } else {
          lastError = new Error("navigator.mediaDevices.getUserMedia is not supported or accessible in this context.");
        }

        if (!active) return;

        if (!success) {
          console.warn("All real camera constraints failed. Triggering canvas mock feed.", lastError);
          // Fall back to Canvas Mock Feed
          const canvas = document.createElement('canvas');
          canvas.width = width || 1280;
          canvas.height = height || 720;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            const captureStream = (canvas as any).captureStream || (canvas as any).webkitCaptureStream;
            if (captureStream) {
              const streamInstance = captureStream.call(canvas, 30);
              
              if (!active) {
                streamInstance.getTracks().forEach((track: any) => track.stop());
                return;
              }
              
              localStream = streamInstance;
              
              let frame = 0;
              const drawMockFeed = () => {
                if (!active || !localStream) return;
                ctx.fillStyle = '#1e293b'; // slate-800
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw some moving elements to simulate video
                ctx.fillStyle = '#334155'; // slate-700
                ctx.font = '48px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('MOCK CAMERA FEED', canvas.width / 2, canvas.height / 2 - 50);
                
                ctx.font = '24px monospace';
                ctx.fillStyle = '#64748b'; // slate-500
                ctx.fillText('Camera access denied or unavailable.', canvas.width / 2, canvas.height / 2 + 20);
                
                // Moving indicator
                ctx.fillStyle = '#0ea5e9'; // sky-500
                const x = (frame * 5) % canvas.width;
                ctx.fillRect(x, canvas.height / 2 + 60, 50, 10);
                
                frame++;
                requestAnimationFrame(drawMockFeed);
              };
              drawMockFeed();
            } else {
              throw lastError || new Error("Canvas captureStream is not supported.");
            }
          } else {
            throw lastError || new Error("Canvas context is not available.");
          }
        }

        if (internalVideoRef.current && localStream && active) {
          internalVideoRef.current.srcObject = localStream;
          
          internalVideoRef.current.onloadedmetadata = () => {
            if (active) {
              setIsLoading(false);
              if (onStreamReady) onStreamReady();
            }
          };

          // Backup timeout to clear loading state if browser takes too long
          setTimeout(() => {
            if (active && internalVideoRef.current && internalVideoRef.current.srcObject === localStream) {
              setIsLoading(false);
              if (onStreamReady) onStreamReady();
            }
          }, 1500);
        }
      } catch (err: any) {
        if (active) {
          console.error("Error accessing camera:", err);
          setError(err.message || "Could not access camera");
          setIsLoading(false);
          if (onError) onError(err);
        }
      }
    };

    startCamera();

    return () => {
      active = false;
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
      }
      if (internalVideoRef.current) {
        internalVideoRef.current.srcObject = null;
      }
    };
  }, []);

  return (
    <div className={`relative bg-black overflow-hidden flex items-center justify-center ${className}`}>
      <video
        ref={internalVideoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />
      
      {/* Loading State */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-slate-400">
           <Camera className="w-12 h-12 mb-4 animate-pulse opacity-50" />
           <p className="text-sm font-medium">Initializing Camera Feed...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-rose-500 px-6 text-center">
           <AlertCircle className="w-12 h-12 mb-4" />
           <h3 className="text-lg font-bold text-white mb-2">Camera Access Failed</h3>
           <p className="text-sm opacity-80">{error}</p>
           <p className="text-xs text-slate-500 mt-4">Please check permissions and try again.</p>
        </div>
      )}

      {/* Custom Overlay (e.g. Scanning UI) */}
      {!isLoading && !error && overlay}
    </div>
  );
});

WebcamFeed.displayName = 'WebcamFeed';