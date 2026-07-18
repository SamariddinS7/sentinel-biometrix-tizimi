import React, { useState, useEffect, useCallback } from 'react';
import {
  Monitor, LayoutGrid, EyeOff, PlusCircle, Settings2, Maximize2,
  ChevronDown, RefreshCw, Wifi, WifiOff, AlertTriangle, Video
} from 'lucide-react';
import { authService } from '../../services/authService';

interface Camera {
  id: string;
  name: string;
  location: string;
  status: string;
  fps: number;
  resolution: string;
  streamUrl?: string;
}

type WallLayout = '1x1' | '2x2' | '3x3' | '4x4' | '1+5' | '2+8';

const LAYOUTS: { key: WallLayout; label: string; slots: number; cols: number }[] = [
  { key: '1x1',  label: '1×1',   slots: 1,  cols: 1 },
  { key: '2x2',  label: '2×2',   slots: 4,  cols: 2 },
  { key: '3x3',  label: '3×3',   slots: 9,  cols: 3 },
  { key: '4x4',  label: '4×4',   slots: 16, cols: 4 },
  { key: '1+5',  label: '1+5',   slots: 6,  cols: 3 },
  { key: '2+8',  label: '2+8',   slots: 10, cols: 4 },
];

interface SOCVideoWallProps {
  isLockdown?: boolean;
}

export const SOCVideoWall: React.FC<SOCVideoWallProps> = ({ isLockdown = false }) => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [layout, setLayout] = useState<WallLayout>('2x2');
  const [slots, setSlots] = useState<(string | null)[]>(Array(4).fill(null));
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showCameraPanel, setShowCameraPanel] = useState(true);
  const [fullscreenSlot, setFullscreenSlot] = useState<number | null>(null);

  const headers = useCallback(() => {
    const token = authService.getToken?.() || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/cameras', { headers: headers() });
        if (res.ok) {
          const data = await res.json();
          const list: Camera[] = Array.isArray(data) ? data : (data.cameras || []);
          setCameras(list);
          // Auto-populate first N slots
          const currentLayout = LAYOUTS.find(l => l.key === layout)!;
          const initial = Array(currentLayout.slots).fill(null).map((_, i) =>
            list[i]?.id ?? null
          );
          setSlots(initial);
        }
      } catch {}
      setLoading(false);
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  const currentLayout = LAYOUTS.find(l => l.key === layout)!;

  const handleLayoutChange = (lk: WallLayout) => {
    const lyt = LAYOUTS.find(l => l.key === lk)!;
    setLayout(lk);
    // Preserve existing slot assignments where possible
    setSlots(prev => {
      const next = Array(lyt.slots).fill(null);
      for (let i = 0; i < Math.min(prev.length, lyt.slots); i++) next[i] = prev[i];
      return next;
    });
    setSelectedSlot(0);
  };

  const assignCamera = (cameraId: string) => {
    setSlots(prev => {
      const next = [...prev];
      next[selectedSlot] = cameraId;
      return next;
    });
  };

  const clearSlot = (idx: number) => {
    setSlots(prev => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  };

  const getCam = (id: string | null) => cameras.find(c => c.id === id) ?? null;

  const statusColor = (status: string) => {
    if (status === 'ONLINE') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (status === 'OFFLINE') return 'text-red-400 bg-red-500/10 border-red-500/20';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  };

  // Render a single video slot
  const renderSlot = (idx: number, large = false) => {
    const camId = slots[idx] ?? null;
    const cam = getCam(camId);
    const isSelected = selectedSlot === idx;

    return (
      <div
        key={idx}
        onClick={() => setSelectedSlot(idx)}
        className={`relative flex flex-col aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-150 group
          ${isSelected
            ? 'border-brand-primary shadow-lg shadow-brand-primary/20'
            : 'border-border/50 hover:border-border'
          }
          ${isLockdown ? 'ring-2 ring-red-500/30' : ''}
        `}
      >
        {cam ? (
          <div className="flex-1 bg-slate-950 relative">
            {/* Status bar */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-2 py-1 bg-black/60 backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${cam.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className="text-[9px] font-bold text-white font-mono uppercase">{cam.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono text-slate-400">{cam.resolution}</span>
                <span className="text-[9px] font-mono text-slate-400">·</span>
                <span className="text-[9px] font-mono text-slate-400">{cam.fps}fps</span>
              </div>
            </div>

            {/* Camera offline state */}
            {cam.status !== 'ONLINE' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90">
                <WifiOff size={20} className="text-red-400 mb-1" />
                <span className="text-[9px] font-bold text-red-400 uppercase">{cam.status}</span>
              </div>
            )}

            {/* Camera online: dark area with live indicator */}
            {cam.status === 'ONLINE' && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900">
                <div className="text-center opacity-20">
                  <Video size={large ? 32 : 20} className="text-slate-500 mx-auto mb-1" />
                  <span className="text-[8px] text-slate-500 font-mono">RTSP STREAM</span>
                </div>
              </div>
            )}

            {/* Lockdown overlay */}
            {isLockdown && (
              <div className="absolute inset-0 bg-red-950/20 flex items-center justify-center pointer-events-none z-20">
                <div className="text-[9px] font-bold text-red-400 border border-red-500/30 bg-red-950/80 px-2 py-1 rounded animate-pulse uppercase tracking-wider">
                  LOCKDOWN
                </div>
              </div>
            )}

            {/* Slot number */}
            <div className="absolute bottom-2 right-2 z-10 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-mono text-slate-400">
              {idx + 1}
            </div>

            {/* Location */}
            <div className="absolute bottom-2 left-2 z-10 text-[8px] font-mono text-slate-500 bg-black/50 px-1.5 py-0.5 rounded truncate max-w-[50%]">
              {cam.location}
            </div>

            {/* Clear button on hover */}
            <button
              onClick={e => { e.stopPropagation(); clearSlot(idx); }}
              className="absolute top-7 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 p-0.5 rounded hover:bg-red-900/80"
            >
              <EyeOff size={10} className="text-red-400" />
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-app-primary gap-1 text-text-muted">
            <EyeOff size={16} className="opacity-30" />
            <span className="text-[9px] font-bold uppercase">Slot {idx + 1}</span>
            <span className="text-[8px] opacity-50">Click camera below to assign</span>
          </div>
        )}

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute inset-0 border-2 border-brand-primary rounded-xl pointer-events-none" />
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <RefreshCw size={16} className="animate-spin mr-2" />
        <span className="text-sm">Loading cameras...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 bg-app-panel border border-border rounded-xl p-3">
        <div className="flex items-center gap-1.5">
          <Monitor size={14} className="text-brand-primary" />
          <span className="text-xs font-bold text-text-primary">Video Wall</span>
        </div>

        {/* Layout selector */}
        <div className="flex bg-app-primary border border-border rounded-lg p-0.5 gap-0.5">
          {LAYOUTS.map(l => (
            <button
              key={l.key}
              onClick={() => handleLayoutChange(l.key)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all
                ${layout === l.key ? 'bg-brand-primary text-white' : 'text-text-muted hover:text-text-secondary'}`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="ml-auto flex items-center gap-3 text-[10px] font-mono">
          <span className="text-emerald-400">
            {cameras.filter(c => c.status === 'ONLINE').length} online
          </span>
          <span className="text-red-400">
            {cameras.filter(c => c.status !== 'ONLINE').length} offline
          </span>
          <span className="text-text-muted">
            {slots.filter(Boolean).length}/{currentLayout.slots} assigned
          </span>
        </div>

        <button
          onClick={() => setShowCameraPanel(p => !p)}
          className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary border border-border px-2 py-1 rounded transition-all"
        >
          <Settings2 size={11} />
          {showCameraPanel ? 'Hide' : 'Show'} cameras
        </button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Video grid */}
        <div className="flex-1 min-w-0">
          {/* Special layout: 1+5 — one large + 5 small */}
          {layout === '1+5' ? (
            <div className="grid grid-cols-3 grid-rows-2 gap-2 h-full">
              <div className="col-span-2 row-span-2">{renderSlot(0, true)}</div>
              {renderSlot(1)}
              {renderSlot(2)}
              {renderSlot(3)}
              {renderSlot(4)}
              {renderSlot(5)}
            </div>
          ) : layout === '2+8' ? (
            <div className="grid grid-cols-4 gap-2 h-full" style={{ gridTemplateRows: '2fr 1fr' }}>
              <div className="col-span-2">{renderSlot(0, true)}</div>
              <div className="col-span-2">{renderSlot(1, true)}</div>
              {[2, 3, 4, 5, 6, 7, 8, 9].map(i => renderSlot(i))}
            </div>
          ) : (
            <div
              className="grid gap-2 h-full"
              style={{ gridTemplateColumns: `repeat(${currentLayout.cols}, 1fr)` }}
            >
              {Array.from({ length: currentLayout.slots }).map((_, i) => renderSlot(i, currentLayout.cols <= 2))}
            </div>
          )}
        </div>

        {/* Camera assignment panel */}
        {showCameraPanel && (
          <div className="w-56 flex-shrink-0 bg-app-panel border border-border rounded-xl p-3 overflow-y-auto custom-scrollbar">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">
              Assign to Slot {selectedSlot + 1}
            </div>
            <div className="space-y-1.5">
              {cameras.length === 0 && (
                <p className="text-[10px] text-text-muted italic">No cameras configured</p>
              )}
              {cameras.map(cam => {
                const onWall = slots.includes(cam.id);
                const isOnSelectedSlot = slots[selectedSlot] === cam.id;
                return (
                  <button
                    key={cam.id}
                    onClick={() => assignCamera(cam.id)}
                    className={`w-full text-left p-2 rounded-lg border text-xs transition-all
                      ${isOnSelectedSlot
                        ? 'bg-brand-primary/10 border-brand-primary/40 text-white'
                        : onWall
                          ? 'bg-app-surface border-border/50 text-text-secondary'
                          : 'bg-app-primary border-border hover:border-brand-primary/30 text-text-secondary'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold truncate flex-1">{cam.name}</span>
                      <span className={`text-[8px] px-1 py-0.5 rounded border ml-1 shrink-0 ${statusColor(cam.status)}`}>
                        {cam.status === 'ONLINE' ? '●' : '○'}
                      </span>
                    </div>
                    <span className="text-[9px] text-text-muted font-mono block truncate">{cam.location}</span>
                    {onWall && !isOnSelectedSlot && (
                      <span className="text-[8px] text-brand-primary/60">On wall slot {slots.indexOf(cam.id) + 1}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
