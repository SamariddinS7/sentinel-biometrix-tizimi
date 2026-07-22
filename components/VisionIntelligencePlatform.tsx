/**
 * Vision Intelligence Platform — Unified UI
 *
 * Eight capability tabs:
 *   1. Jonli Tahlil   — Live scene understanding (frame analysis)
 *   2. Tekshiruv      — Video investigation engine
 *   3. Shaxs Attr.    — Person attribute extraction
 *   4. Transport      — Vehicle intelligence
 *   5. OCR            — Text / license plate extraction
 *   6. Xulq-Atvor     — Scene & behavior analysis
 *   7. Vaqt Chizig'i  — Timeline reconstruction
 *   8. Dalillar       — Visual evidence store
 *
 * Every result panel shows the full VisualObservation fields:
 * observationId, timestamp, cameraId, frameId, confidence,
 * evidenceReference, modelVersion.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Eye, Search, User, Car, FileText, Activity, Clock, Shield,
  Upload, Image as ImageIcon, Video, Loader2, CheckCircle2,
  AlertTriangle, X, ChevronDown, ChevronRight, Copy, Check,
  Sparkles, Camera, ZoomIn, Hash, MapPin, Layers, BarChart2,
  Package, Tag, BookOpen, RefreshCw, Download, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Types (mirrors backend) ──────────────────────────────────────────────────

interface BoundingBox { x: number; y: number; width: number; height: number }
interface DetectedObject {
  id: string; label: string; subType?: string; confidence: number;
  boundingBox?: BoundingBox; attributes: Record<string, unknown>; trackId?: string;
}
interface PersonAttributes {
  upperClothingColor?: string; lowerClothingColor?: string; shoes?: string;
  hasHelmet: boolean; hasSafetyVest: boolean; hasMask: boolean;
  hasBackpack: boolean; hasHandbag: boolean; hasUmbrella: boolean;
  hasReflectiveClothing: boolean; estimatedHeightRange?: string;
  bodyBuild?: string; movementDirection?: string; movementType?: string;
  carryingObject?: string; hasBicycle: boolean; hasWheelchair: boolean;
  confidence: number; camera: string;
}
interface VehicleAttributes {
  type: string; color?: string; approximateSize?: string;
  licensePlate?: string; licensePlateConfidence?: number;
  movementDirection?: string; confidence: number;
}
interface OCRResult {
  text: string; confidence: number; language?: string;
  sourceType: string; boundingBox?: BoundingBox; timestamp: string;
}
interface BehaviorObservation {
  type: string; description: string; confidence: number;
  alternativeInterpretations?: string[];
}
interface EvidenceAttachment {
  id: string; type: string; cameraId: string; timestamp: string; modelVersion: string;
}
interface VisualObservation {
  observationId: string; timestamp: string; cameraId: string; frameId: string;
  sourceType: string; objectList: DetectedObject[]; sceneDescription: string;
  confidence: number; evidenceReference: EvidenceAttachment[]; modelVersion: string;
  personAttributes?: PersonAttributes[]; vehicleAttributes?: VehicleAttributes[];
  ocrResults?: OCRResult[]; behaviorObservations?: BehaviorObservation[];
  crowdDensity?: number; occupancyCount?: number; unusualEvents?: string[];
  missingInformation?: string[]; alternativeInterpretations?: string[];
  processingMs: number;
}
interface TimelineEntry {
  id: string; timestamp: string; cameraId: string; eventType: string;
  description: string; objectIds: string[]; confidence: number; evidenceRef: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader(): Record<string, string> {
  const tok = localStorage.getItem('sentinel_token') ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` };
}

async function visionPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/vision/${endpoint}`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'API xatolik');
  }
  return res.json();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PCT = (v: number) => `${Math.round(v * 100)}%`;
const CONF_COLOR = (v: number) =>
  v >= 0.8 ? 'text-emerald-400' : v >= 0.5 ? 'text-yellow-400' : 'text-orange-400';

// ─── Reusable sub-components ──────────────────────────────────────────────────

const ObservationMeta: React.FC<{ obs: VisualObservation }> = ({ obs }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 border border-white/8 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white/3 hover:bg-white/5 text-xs text-white/40 transition-colors">
        <span className="flex items-center gap-2"><Info size={12} />Kuzatuv meta-ma'lumotlari</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="px-4 py-3 space-y-1.5 bg-white/2">
          {[
            ['Observation ID', obs.observationId],
            ['Camera ID',      obs.cameraId],
            ['Frame ID',       obs.frameId],
            ['Source Type',    obs.sourceType],
            ['Model Version',  obs.modelVersion],
            ['Timestamp',      new Date(obs.timestamp).toLocaleString('uz-UZ')],
            ['Processing',     `${obs.processingMs}ms`],
            ['Confidence',     PCT(obs.confidence)],
            ['Evidence refs',  obs.evidenceReference.length.toString()],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-[11px]">
              <span className="text-white/30">{k}</span>
              <span className="text-white/60 font-mono text-right max-w-[60%] truncate">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ConfidenceBadge: React.FC<{ value: number; label?: string }> = ({ value, label }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${CONF_COLOR(value)}`}>
    {label && <span className="text-white/30">{label}:</span>}
    {PCT(value)}
  </span>
);

const SectionTitle: React.FC<{ children: React.ReactNode; count?: number }> = ({ children, count }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-xs font-bold text-white/60 uppercase tracking-wider">{children}</span>
    {count !== undefined && (
      <span className="px-1.5 py-0.5 bg-cyan-500/15 text-cyan-400 text-[10px] font-bold rounded-full">{count}</span>
    )}
  </div>
);

const UploadZone: React.FC<{
  accept: string; label: string; icon: React.ReactNode;
  onFile: (file: File) => void; preview?: string; mimeType?: string;
  onClear: () => void;
}> = ({ accept, label, icon, onFile, preview, mimeType, onClear }) => {
  const ref = useRef<HTMLInputElement>(null);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };
  return preview ? (
    <div className="relative rounded-xl overflow-hidden border border-white/15 bg-black aspect-video mb-4">
      {mimeType?.startsWith('video')
        ? <video src={preview} controls className="w-full h-full object-contain" />
        : <img src={preview} alt="preview" className="w-full h-full object-contain" />}
      <button onClick={onClear}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-red-500 flex items-center justify-center text-white transition-colors">
        <X size={14} />
      </button>
    </div>
  ) : (
    <label
      onDrop={onDrop} onDragOver={e => e.preventDefault()}
      className="flex flex-col items-center justify-center border-2 border-dashed border-white/15 hover:border-cyan-500/40 rounded-xl p-8 mb-4 cursor-pointer transition-all bg-white/2 hover:bg-white/4 text-center"
    >
      <span className="text-white/20 mb-2">{icon}</span>
      <span className="text-xs text-white/40 font-medium">{label}</span>
      <span className="text-[10px] text-white/20 mt-1">yoki bu yerga tashlang</span>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); if (ref.current) ref.current.value = ''; }} />
    </label>
  );
};

const ObjectCard: React.FC<{ obj: DetectedObject }> = ({ obj }) => (
  <div className="flex items-center gap-3 px-3 py-2 bg-white/3 rounded-lg border border-white/8">
    <div className="w-6 h-6 rounded-md bg-cyan-500/15 flex items-center justify-center shrink-0">
      <Package size={12} className="text-cyan-400" />
    </div>
    <div className="flex-1 min-w-0">
      <span className="text-xs font-semibold text-white/80">{obj.label}</span>
      {obj.subType && <span className="text-[10px] text-white/30 ml-1.5">({obj.subType})</span>}
    </div>
    <ConfidenceBadge value={obj.confidence} />
  </div>
);

const MissingInfo: React.FC<{ items?: string[] }> = ({ items }) => {
  if (!items?.length) return null;
  return (
    <div className="mt-3 flex items-start gap-2 p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-xl">
      <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
      <div className="text-[11px] text-yellow-300/70 space-y-0.5">
        {items.map((m, i) => <div key={i}>{m}</div>)}
      </div>
    </div>
  );
};

// ─── TAB DEFINITIONS ──────────────────────────────────────────────────────────

type TabId = 'live' | 'investigate' | 'person' | 'vehicle' | 'ocr' | 'behavior' | 'timeline' | 'evidence';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'live',        label: 'Jonli Tahlil',    icon: <Eye size={14} /> },
  { id: 'investigate', label: 'Tekshiruv',        icon: <Search size={14} /> },
  { id: 'person',      label: "Shaxs Attr.",      icon: <User size={14} /> },
  { id: 'vehicle',     label: 'Transport',         icon: <Car size={14} /> },
  { id: 'ocr',         label: 'OCR / Matn',        icon: <FileText size={14} /> },
  { id: 'behavior',    label: "Xulq-Atvor",        icon: <Activity size={14} /> },
  { id: 'timeline',    label: "Vaqt Chizig'i",     icon: <Clock size={14} /> },
  { id: 'evidence',    label: 'Dalillar',           icon: <Shield size={14} /> },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export const VisionIntelligencePlatform: React.FC = () => {
  const [tab, setTab] = useState<TabId>('live');

  // ── Shared upload state ──────────────────────────────────────────────────────
  const [file, setFile] = useState<{ raw: File; preview: string; base64: string; mime: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Result state ─────────────────────────────────────────────────────────────
  const [liveResult, setLiveResult]           = useState<any>(null);
  const [investResult, setInvestResult]       = useState<any>(null);
  const [personResult, setPersonResult]       = useState<any>(null);
  const [vehicleResult, setVehicleResult]     = useState<any>(null);
  const [ocrResult, setOcrResult]             = useState<any>(null);
  const [behaviorResult, setBehaviorResult]   = useState<any>(null);
  const [timelineResult, setTimelineResult]   = useState<any>(null);
  const [evidenceList, setEvidenceList]       = useState<any[]>([]);

  // ── Per-tab input state ───────────────────────────────────────────────────────
  const [liveQuery, setLiveQuery]             = useState('');
  const [investQuery, setInvestQuery]         = useState('');
  const [ocrSearch, setOcrSearch]             = useState('');
  const [timelineType, setTimelineType]       = useState<string>('chronological');
  const [cameraIds, setCameraIds]             = useState('cam-01,cam-02');
  const [evidenceQuery, setEvidenceQuery]     = useState('');

  const clearFile = useCallback(() => setFile(null), []);

  const loadFile = useCallback(async (f: File) => {
    const preview = URL.createObjectURL(f);
    const base64  = await fileToBase64(f);
    setFile({ raw: f, preview, base64, mime: f.type });
    setError(null);
  }, []);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  // ── API calls ─────────────────────────────────────────────────────────────────

  const doLive = () => run(async () => {
    const res = await visionPost<any>('live-scene', {
      imageData: file?.base64, mimeType: file?.mime,
      cameraId: 'uploaded', operatorQuery: liveQuery || undefined,
    });
    setLiveResult(res);
  });

  const doInvestigate = () => run(async () => {
    const res = await visionPost<any>('investigate', {
      query: investQuery, cameraId: 'uploaded',
      mediaData: file?.base64, mimeType: file?.mime,
    });
    setInvestResult(res);
  });

  const doPerson = () => run(async () => {
    if (!file) throw new Error('Rasm yuklang');
    const res = await visionPost<any>('person-attributes', { imageData: file.base64, mimeType: file.mime, cameraId: 'uploaded' });
    setPersonResult(res);
  });

  const doVehicle = () => run(async () => {
    if (!file) throw new Error('Rasm yuklang');
    const res = await visionPost<any>('vehicle-intel', { imageData: file.base64, mimeType: file.mime, cameraId: 'uploaded' });
    setVehicleResult(res);
  });

  const doOCR = () => run(async () => {
    if (!file) throw new Error('Rasm yuklang');
    const res = await visionPost<any>('ocr', {
      imageData: file.base64, mimeType: file.mime, cameraId: 'uploaded',
      searchText: ocrSearch || undefined,
    });
    setOcrResult(res);
  });

  const doBehavior = () => run(async () => {
    if (!file) throw new Error('Rasm yuklang');
    const res = await visionPost<any>('behavior', { imageData: file.base64, mimeType: file.mime, cameraId: 'uploaded' });
    setBehaviorResult(res);
  });

  const doTimeline = () => run(async () => {
    const ids = cameraIds.split(',').map(s => s.trim()).filter(Boolean);
    const res = await visionPost<any>('timeline/reconstruct', { type: timelineType, cameraIds: ids });
    setTimelineResult(res.timeline);
  });

  const doEvidenceQuery = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/vision/evidence/query', {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify(evidenceQuery ? { objectLabel: evidenceQuery } : {}),
      });
      const data = await res.json();
      setEvidenceList(data.evidence ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-app-bg text-white overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-white/8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
            <Eye size={18} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white/90">Vision Intelligence Platform</h1>
            <p className="text-[11px] text-white/35">Real-vaqt va oflayn vizual tahlil · Gemini 2.0 Flash</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 mt-4 overflow-x-auto pb-0.5 scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(null); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold whitespace-nowrap rounded-lg transition-all shrink-0 ${
                tab === t.id
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/5 border border-transparent'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-sm text-red-300">
                <AlertTriangle size={15} className="shrink-0" />{error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 1 — LIVE SCENE ANALYSIS
          ══════════════════════════════════════════════════════════════════ */}
          {tab === 'live' && (
            <div className="space-y-4">
              <p className="text-xs text-white/35">Kamera tasvirini yuklang va to'liq sahna tahlilini oling: ob'ektlar, xulq-atvor, zichlik, g'ayritabiiy hodisalar.</p>
              <UploadZone accept="image/*" label="Rasm yuklash (JPEG, PNG, WebP)" icon={<ImageIcon size={28} />}
                onFile={loadFile} preview={file?.preview} mimeType={file?.mime} onClear={clearFile} />
              <input value={liveQuery} onChange={e => setLiveQuery(e.target.value)}
                placeholder="Operator so'rovi (ixtiyoriy): masalan, 'Omborda nima bo'lyapti?'"
                className="w-full bg-white/5 border border-white/10 focus:border-cyan-500/40 rounded-xl px-4 py-3 text-sm text-white/80 outline-none transition-all placeholder:text-white/20" />
              <button onClick={doLive} disabled={!file || loading}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? 'Sahna tahlil qilinmoqda...' : 'Sahna tahlilini boshlash'}
              </button>

              {liveResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* Scene description */}
                  <div className="p-4 bg-white/4 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye size={14} className="text-cyan-400" />
                      <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Sahna Tavsifi</span>
                      <ConfidenceBadge value={liveResult.observation?.confidence ?? 0} />
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed">{liveResult.observation?.sceneDescription}</p>
                    {liveResult.activitySummary && (
                      <p className="text-[12px] text-white/50 mt-2 italic">{liveResult.activitySummary}</p>
                    )}
                  </div>

                  {/* Unusual events */}
                  {liveResult.unusualEvents?.length > 0 && (
                    <div className="p-3 bg-orange-500/8 border border-orange-500/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={13} className="text-orange-400" />
                        <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">G'ayritabiiy Hodisalar</span>
                      </div>
                      <ul className="space-y-1">
                        {liveResult.unusualEvents.map((e: string, i: number) => (
                          <li key={i} className="text-[12px] text-orange-300/80 flex items-start gap-2">
                            <span className="text-orange-400 mt-0.5">•</span>{e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Objects */}
                  {liveResult.observation?.objectList?.length > 0 && (
                    <div>
                      <SectionTitle count={liveResult.observation.objectList.length}>Aniqlangan Ob'ektlar</SectionTitle>
                      <div className="grid grid-cols-2 gap-2">
                        {liveResult.observation.objectList.map((o: DetectedObject) => <ObjectCard key={o.id} obj={o} />)}
                      </div>
                    </div>
                  )}

                  {/* Crowd / occupancy */}
                  {(liveResult.observation?.crowdDensity > 0 || liveResult.observation?.occupancyCount > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/4 border border-white/10 rounded-xl text-center">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Olomonlar Zichligi</p>
                        <p className="text-2xl font-bold text-cyan-400">{PCT(liveResult.observation.crowdDensity ?? 0)}</p>
                      </div>
                      <div className="p-3 bg-white/4 border border-white/10 rounded-xl text-center">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Odamlar Soni</p>
                        <p className="text-2xl font-bold text-emerald-400">{liveResult.observation.occupancyCount ?? 0}</p>
                      </div>
                    </div>
                  )}

                  {/* Behaviors */}
                  {liveResult.observation?.behaviorObservations?.length > 0 && (
                    <div>
                      <SectionTitle count={liveResult.observation.behaviorObservations.length}>Xulq-Atvor</SectionTitle>
                      <div className="space-y-2">
                        {liveResult.observation.behaviorObservations.map((b: BehaviorObservation, i: number) => (
                          <div key={i} className="p-3 bg-white/4 border border-white/10 rounded-xl">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-bold text-cyan-400 capitalize">{b.type.replace(/_/g, ' ')}</span>
                              <ConfidenceBadge value={b.confidence} />
                            </div>
                            <p className="text-[12px] text-white/60">{b.description}</p>
                            {b.alternativeInterpretations?.length > 0 && (
                              <p className="text-[11px] text-white/30 mt-1 italic">
                                Muqobil: {b.alternativeInterpretations.join('; ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <MissingInfo items={liveResult.observation?.missingInformation} />
                  <ObservationMeta obs={liveResult.observation} />
                </motion.div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2 — VIDEO INVESTIGATION
          ══════════════════════════════════════════════════════════════════ */}
          {tab === 'investigate' && (
            <div className="space-y-4">
              <p className="text-xs text-white/35">Yozib olingan video yoki rasm bo'yicha tekshiruv so'rovini bajaring. Misol: "Kim kirdi?", "Ryukzakli shaxsni top."</p>
              <UploadZone accept="image/*,video/mp4" label="Rasm yoki MP4 video yuklash" icon={<Video size={28} />}
                onFile={loadFile} preview={file?.preview} mimeType={file?.mime} onClear={clearFile} />
              <textarea value={investQuery} onChange={e => setInvestQuery(e.target.value)} rows={3}
                placeholder="Tekshiruv so'rovi: masalan, 'Kim kirib-chiqdi?', 'Sariq kiyimli shaxsni top'"
                className="w-full bg-white/5 border border-white/10 focus:border-cyan-500/40 rounded-xl px-4 py-3 text-sm text-white/80 outline-none transition-all resize-none placeholder:text-white/20" />
              <button onClick={doInvestigate} disabled={!investQuery.trim() || loading}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {loading ? 'Tekshiruv amalga oshirilmoqda...' : 'Tekshiruvni boshlash'}
              </button>

              {investResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="p-4 bg-white/4 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Search size={14} className="text-cyan-400" />
                      <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Tekshiruv Xulosasi</span>
                      <span className="text-[10px] bg-white/10 text-white/40 px-2 py-0.5 rounded-full">{investResult.queryType}</span>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed">{investResult.investigationSummary}</p>
                  </div>

                  {investResult.findings?.length > 0 && (
                    <div>
                      <SectionTitle count={investResult.findings.length}>Topilmalar</SectionTitle>
                      <div className="space-y-2">
                        {investResult.findings.map((f: any, i: number) => (
                          <div key={i} className="p-3 bg-white/4 border border-white/10 rounded-xl">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[13px] text-white/75 leading-relaxed">{f.finding}</p>
                              <ConfidenceBadge value={f.confidence} />
                            </div>
                            {f.timestamp && <p className="text-[11px] text-white/30 mt-1">Vaqt: {f.timestamp}</p>}
                            {f.alternatives?.length > 0 && (
                              <p className="text-[11px] text-white/25 mt-1 italic">
                                Muqobil: {f.alternatives.join('; ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {investResult.timelineEntries?.length > 0 && (
                    <div>
                      <SectionTitle count={investResult.timelineEntries.length}>Vaqt Chizig'i Yozuvlari</SectionTitle>
                      <div className="space-y-1.5">
                        {investResult.timelineEntries.map((te: TimelineEntry) => (
                          <div key={te.id} className="flex items-start gap-3 px-3 py-2.5 bg-white/3 border border-white/8 rounded-lg">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-white/60 capitalize">{te.eventType.replace(/_/g, ' ')}</span>
                                <ConfidenceBadge value={te.confidence} />
                              </div>
                              <p className="text-[12px] text-white/50 mt-0.5">{te.description}</p>
                            </div>
                            <span className="text-[10px] text-white/20 shrink-0">{te.timestamp}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <MissingInfo items={investResult.observation?.missingInformation} />
                  <ObservationMeta obs={investResult.observation} />
                </motion.div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3 — PERSON ATTRIBUTES
          ══════════════════════════════════════════════════════════════════ */}
          {tab === 'person' && (
            <div className="space-y-4">
              <p className="text-xs text-white/35">Rasmdagi shaxslarning kuzatiluvchi jismoniy atributlarini chiqarib bering. Identifikatsiya amalga oshirilmaydi.</p>
              <UploadZone accept="image/*" label="Rasm yuklash" icon={<User size={28} />}
                onFile={loadFile} preview={file?.preview} mimeType={file?.mime} onClear={clearFile} />
              <button onClick={doPerson} disabled={!file || loading}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <User size={16} />}
                {loading ? 'Atributlar aniqlanmoqda...' : 'Shaxs Atributlarini Chiqarish'}
              </button>

              {personResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-white/4 border border-white/10 rounded-xl">
                    <User size={16} className="text-cyan-400" />
                    <span className="text-sm text-white/70">
                      <strong className="text-white">{personResult.totalPersonsDetected}</strong> ta shaxs aniqlandi
                    </span>
                  </div>
                  {(personResult.persons ?? []).map((p: PersonAttributes, idx: number) => (
                    <div key={idx} className="p-4 bg-white/4 border border-white/10 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cyan-400">Shaxs #{idx + 1}</span>
                        <ConfidenceBadge value={p.confidence} label="ishonch" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['Yuqori kiyim rangi', p.upperClothingColor],
                          ['Pastki kiyim rangi', p.lowerClothingColor],
                          ['Oyoq kiyim', p.shoes],
                          ["Bo'y diapazoni", p.estimatedHeightRange],
                          ['Gavda qurishi', p.bodyBuild],
                          ['Harakat yo\'nalishi', p.movementDirection],
                          ['Harakat turi', p.movementType],
                          ['Ko\'tarayotgan narsa', p.carryingObject],
                        ].filter(([, v]) => v).map(([k, v]) => (
                          <div key={k as string} className="px-3 py-2 bg-white/3 rounded-lg">
                            <p className="text-[10px] text-white/30">{k}</p>
                            <p className="text-xs text-white/70 font-medium capitalize">{v as string}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          ['Dubulg\'a', p.hasHelmet],
                          ['Xavfsizlik vesti', p.hasSafetyVest],
                          ['Niqob', p.hasMask],
                          ['Ryukzak', p.hasBackpack],
                          ['Sumka', p.hasHandbag],
                          ['Soyabon', p.hasUmbrella],
                          ['Aks ettiruvchi', p.hasReflectiveClothing],
                          ['Velosiped', p.hasBicycle],
                          ['Nogironlar aravasi', p.hasWheelchair],
                        ].filter(([, v]) => v).map(([k]) => (
                          <span key={k as string} className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/25 rounded-full text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 size={10} />{k}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  <MissingInfo items={personResult.observation?.missingInformation} />
                  <ObservationMeta obs={personResult.observation} />
                </motion.div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 4 — VEHICLE INTELLIGENCE
          ══════════════════════════════════════════════════════════════════ */}
          {tab === 'vehicle' && (
            <div className="space-y-4">
              <p className="text-xs text-white/35">Transport vositalarini aniqlang va ularning atributlarini chiqarib bering: tur, rang, davlat raqami, harakat yo'nalishi.</p>
              <UploadZone accept="image/*" label="Rasm yuklash" icon={<Car size={28} />}
                onFile={loadFile} preview={file?.preview} mimeType={file?.mime} onClear={clearFile} />
              <button onClick={doVehicle} disabled={!file || loading}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Car size={16} />}
                {loading ? 'Transport tahlil qilinmoqda...' : 'Transport Intellektini Boshlash'}
              </button>

              {vehicleResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-white/4 border border-white/10 rounded-xl">
                    <Car size={16} className="text-cyan-400" />
                    <span className="text-sm text-white/70">
                      <strong className="text-white">{vehicleResult.totalVehiclesDetected}</strong> ta transport vositasi aniqlandi
                    </span>
                  </div>
                  {(vehicleResult.vehicles ?? []).map((v: VehicleAttributes, i: number) => (
                    <div key={i} className="p-4 bg-white/4 border border-white/10 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cyan-400 capitalize">{v.type}</span>
                        <ConfidenceBadge value={v.confidence} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['Rang', v.color],
                          ['Taxminiy o\'lchov', v.approximateSize],
                          ['Davlat raqami', v.licensePlate],
                          ['Harakat yo\'nalishi', v.movementDirection],
                        ].filter(([, val]) => val).map(([k, val]) => (
                          <div key={k as string} className="px-3 py-2 bg-white/3 rounded-lg">
                            <p className="text-[10px] text-white/30">{k}</p>
                            <p className="text-xs text-white/70 font-medium">{val as string}</p>
                          </div>
                        ))}
                      </div>
                      {v.licensePlate && v.licensePlateConfidence !== undefined && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/8 border border-yellow-500/20 rounded-lg">
                          <Hash size={12} className="text-yellow-400" />
                          <span className="text-sm font-mono font-bold text-yellow-300">{v.licensePlate}</span>
                          <ConfidenceBadge value={v.licensePlateConfidence} />
                        </div>
                      )}
                    </div>
                  ))}
                  <MissingInfo items={vehicleResult.observation?.missingInformation} />
                  <ObservationMeta obs={vehicleResult.observation} />
                </motion.div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 5 — OCR INTELLIGENCE
          ══════════════════════════════════════════════════════════════════ */}
          {tab === 'ocr' && (
            <div className="space-y-4">
              <p className="text-xs text-white/35">Tasvirdan barcha matnlarni chiqarib bering: belgilar, yorliqlar, nishonlar, hujjatlar, ekranlar, davlat raqamlari.</p>
              <UploadZone accept="image/*" label="Rasm yuklash" icon={<FileText size={28} />}
                onFile={loadFile} preview={file?.preview} mimeType={file?.mime} onClear={clearFile} />
              <input value={ocrSearch} onChange={e => setOcrSearch(e.target.value)}
                placeholder="Qidirish matni (ixtiyoriy): masalan, 'EXIT', 'DANGER'"
                className="w-full bg-white/5 border border-white/10 focus:border-cyan-500/40 rounded-xl px-4 py-3 text-sm text-white/80 outline-none transition-all placeholder:text-white/20" />
              <button onClick={doOCR} disabled={!file || loading}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {loading ? 'Matn chiqarilmoqda...' : 'OCR Tahlilini Boshlash'}
              </button>

              {ocrResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* Search result */}
                  {ocrResult.searchResult && (
                    <div className={`p-3 border rounded-xl text-sm ${ocrResult.searchResult.matched ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-white/4 border-white/10 text-white/50'}`}>
                      {ocrResult.searchResult.matched
                        ? `✓ Topildi: ${ocrResult.searchResult.matchedTexts.join(', ')}`
                        : '✗ Qidirilgan matn topilmadi'}
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-3 bg-white/4 border border-white/10 rounded-xl">
                    <FileText size={16} className="text-cyan-400" />
                    <span className="text-sm text-white/70">
                      <strong className="text-white">{ocrResult.totalTextRegions}</strong> ta matn sohasi aniqlandi
                      {ocrResult.dominantLanguage && (
                        <span className="text-white/30 ml-2">· Asosiy til: {ocrResult.dominantLanguage}</span>
                      )}
                    </span>
                  </div>

                  {(ocrResult.ocrResults ?? []).map((r: OCRResult, i: number) => (
                    <div key={i} className="p-3 bg-white/4 border border-white/10 rounded-xl">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Tag size={11} className="text-cyan-400" />
                          <span className="text-[11px] text-white/40 capitalize">{r.sourceType}</span>
                          {r.language && <span className="text-[10px] bg-white/8 text-white/30 px-1.5 py-0.5 rounded-full">{r.language}</span>}
                        </div>
                        <ConfidenceBadge value={r.confidence} />
                      </div>
                      <p className="text-sm font-mono text-white/85 bg-white/5 rounded-lg px-3 py-2 leading-relaxed">{r.text}</p>
                    </div>
                  ))}
                  <MissingInfo items={ocrResult.observation?.missingInformation} />
                  <ObservationMeta obs={ocrResult.observation} />
                </motion.div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 6 — BEHAVIOR ANALYSIS
          ══════════════════════════════════════════════════════════════════ */}
          {tab === 'behavior' && (
            <div className="space-y-4">
              <p className="text-xs text-white/35">Ko'zatiluvchi xulq-atvorlarni va muhitni tahlil qiling. Hech qachon niyat yoki tuyg'ular taxmin qilinmaydi.</p>
              <UploadZone accept="image/*" label="Rasm yuklash" icon={<Activity size={28} />}
                onFile={loadFile} preview={file?.preview} mimeType={file?.mime} onClear={clearFile} />
              <button onClick={doBehavior} disabled={!file || loading}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                {loading ? 'Xulq-atvor tahlil qilinmoqda...' : 'Xulq-Atvor Tahlilini Boshlash'}
              </button>

              {behaviorResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="p-4 bg-white/4 border border-white/10 rounded-xl space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ['Sahna turi', behaviorResult.sceneType],
                        ['Yorug\'lik', behaviorResult.lightingConditions],
                        ['Ob-havo', behaviorResult.weatherConditions ?? '—'],
                        ['Zichlik', PCT(behaviorResult.crowdDensity ?? 0)],
                        ['Odamlar soni', String(behaviorResult.occupancyCount ?? 0)],
                      ].map(([k, v]) => (
                        <div key={k} className="px-3 py-2 bg-white/3 rounded-lg">
                          <p className="text-[10px] text-white/30">{k}</p>
                          <p className="text-xs text-white/70 font-medium">{v}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-white/70 mt-2 pt-2 border-t border-white/8">
                      {behaviorResult.observation?.sceneDescription}
                    </p>
                  </div>

                  {behaviorResult.unusualEvents?.length > 0 && (
                    <div className="p-3 bg-orange-500/8 border border-orange-500/20 rounded-xl">
                      <div className="text-xs font-bold text-orange-400 mb-2 flex items-center gap-2">
                        <AlertTriangle size={12} />G'ayritabiiy hodisalar
                      </div>
                      {behaviorResult.unusualEvents.map((e: string, i: number) => (
                        <p key={i} className="text-[12px] text-orange-300/70">{e}</p>
                      ))}
                    </div>
                  )}

                  {behaviorResult.behaviors?.length > 0 && (
                    <div>
                      <SectionTitle count={behaviorResult.behaviors.length}>Aniqlangan Xulq-Atvorlar</SectionTitle>
                      <div className="space-y-2">
                        {behaviorResult.behaviors.map((b: BehaviorObservation, i: number) => (
                          <div key={i} className="p-3 bg-white/4 border border-white/10 rounded-xl">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-bold text-white/70 capitalize">{b.type.replace(/_/g, ' ')}</span>
                              <ConfidenceBadge value={b.confidence} />
                            </div>
                            <p className="text-[12px] text-white/55 leading-relaxed">{b.description}</p>
                            {b.alternativeInterpretations?.length > 0 && (
                              <div className="mt-1.5 text-[11px] text-white/25 italic">
                                Muqobil talqin: {b.alternativeInterpretations.join('; ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <MissingInfo items={behaviorResult.observation?.missingInformation} />
                  <ObservationMeta obs={behaviorResult.observation} />
                </motion.div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 7 — TIMELINE RECONSTRUCTION
          ══════════════════════════════════════════════════════════════════ */}
          {tab === 'timeline' && (
            <div className="space-y-4">
              <p className="text-xs text-white/35">Bir yoki bir nechta kameradagi voqealar xronologiyasini qayta qurib chiqing.</p>

              <div>
                <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-2 block">Vaqt Chizig'i Turi</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'chronological', label: 'Xronologik' },
                    { v: 'movement',      label: 'Harakat' },
                    { v: 'cross_camera',  label: 'Ko\'p Kamera' },
                    { v: 'evidence',      label: 'Dalillar' },
                    { v: 'incident',      label: 'Hodisa' },
                  ].map(opt => (
                    <button key={opt.v} onClick={() => setTimelineType(opt.v)}
                      className={`py-2 rounded-lg text-[11px] font-semibold transition-all border ${
                        timelineType === opt.v
                          ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25'
                          : 'bg-white/4 text-white/40 border-white/10 hover:text-white/60'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-2 block">Kamera IDlari (vergul bilan ajratilgan)</label>
                <input value={cameraIds} onChange={e => setCameraIds(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-cyan-500/40 rounded-xl px-4 py-3 text-sm text-white/80 outline-none transition-all placeholder:text-white/20"
                  placeholder="cam-01, cam-02, cam-03" />
              </div>

              <button onClick={doTimeline} disabled={loading}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
                {loading ? 'Vaqt chizig\'i qurilmoqda...' : "Vaqt Chizig'ini Qayta Qurish"}
              </button>

              {timelineResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="p-4 bg-white/4 border border-white/10 rounded-xl">
                    <h3 className="text-sm font-bold text-white/80 mb-1">{timelineResult.title}</h3>
                    <p className="text-[12px] text-white/40">{timelineResult.summary}</p>
                    <p className="text-[11px] text-white/25 mt-1">Kameralar: {timelineResult.cameraIds?.join(', ')}</p>
                  </div>

                  {timelineResult.entries?.length > 0 ? (
                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                      {timelineResult.entries.map((te: TimelineEntry) => (
                        <div key={te.id} className="flex items-start gap-3 px-3 py-2.5 bg-white/3 border border-white/8 rounded-lg">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-white/60 capitalize">{te.eventType.replace(/_/g, ' ')}</span>
                              <ConfidenceBadge value={te.confidence} />
                            </div>
                            <p className="text-[12px] text-white/50">{te.description}</p>
                            <p className="text-[10px] text-white/20">Kamera: {te.cameraId}</p>
                          </div>
                          <span className="text-[10px] text-white/20 shrink-0 whitespace-nowrap">
                            {new Date(te.timestamp).toLocaleTimeString('uz-UZ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-white/25 text-sm">
                      Bu kameralar uchun saqlangan kuzatuvlar yo'q.
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 8 — EVIDENCE STORE
          ══════════════════════════════════════════════════════════════════ */}
          {tab === 'evidence' && (
            <div className="space-y-4">
              <p className="text-xs text-white/35">Barcha vizual kuzatuvlar dalil bazasida saqlanadi. Har bir xulosa qo'llab-quvvatlovchi dalilga murojaat qiladi.</p>

              <div className="flex gap-2">
                <input value={evidenceQuery} onChange={e => setEvidenceQuery(e.target.value)}
                  placeholder="Ob'ekt yorlig'i bo'yicha qidirish (ixtiyoriy)"
                  className="flex-1 bg-white/5 border border-white/10 focus:border-cyan-500/40 rounded-xl px-4 py-3 text-sm text-white/80 outline-none transition-all placeholder:text-white/20"
                  onKeyDown={e => { if (e.key === 'Enter') doEvidenceQuery(); }} />
                <button onClick={doEvidenceQuery} disabled={loading}
                  className="px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-40">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
              </div>

              {evidenceList.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <SectionTitle count={evidenceList.length}>Dalil Yozuvlari</SectionTitle>
                  {evidenceList.map((rec: any) => (
                    <div key={rec.id} className="p-4 bg-white/4 border border-white/10 rounded-xl space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Shield size={13} className="text-cyan-400" />
                            <span className="text-xs font-bold text-white/70">
                              {rec.observation?.sourceType?.replace(/_/g, ' ')}
                            </span>
                            <ConfidenceBadge value={rec.observation?.confidence ?? 0} />
                          </div>
                          <p className="text-[11px] text-white/35 font-mono">{rec.observationId}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-white/40">Kamera: {rec.cameraId}</p>
                          <p className="text-[10px] text-white/25">{new Date(rec.timestamp).toLocaleString('uz-UZ')}</p>
                        </div>
                      </div>
                      {rec.observation?.sceneDescription && (
                        <p className="text-[12px] text-white/55 leading-relaxed">{rec.observation.sceneDescription}</p>
                      )}
                      {rec.observation?.objectList?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {rec.observation.objectList.slice(0, 6).map((o: DetectedObject) => (
                            <span key={o.id} className="px-2 py-0.5 bg-white/8 text-white/40 text-[10px] rounded-full capitalize">
                              {o.label}{o.subType ? ` (${o.subType})` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Chain of custody */}
                      {rec.chainOfCustody?.length > 0 && (
                        <div className="pt-2 border-t border-white/8">
                          <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Saqlash Zanjiri</p>
                          {rec.chainOfCustody.slice(-3).map((c: any, i: number) => (
                            <p key={i} className="text-[10px] text-white/25">
                              {c.action} · {c.actor} · {new Date(c.timestamp).toLocaleTimeString('uz-UZ')}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}

              {evidenceList.length === 0 && !loading && (
                <div className="py-12 text-center">
                  <Shield size={32} className="text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/25">Dalillar bazasini ko'rish uchun yuqoridagi tablardan tahlil o'tkazing.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
