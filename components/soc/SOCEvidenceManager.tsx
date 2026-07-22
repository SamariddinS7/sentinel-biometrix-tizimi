import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Camera, Clock, Shield, Lock, Eye, Download,
  ChevronRight, X, AlertTriangle, RefreshCw, Loader2, FolderOpen,
  Activity, Crosshair, Tag, Database, Plus, ChevronDown, Info,
  FileText, Hash, Layers, Image as ImageIcon, Video, CheckCircle2,
  AlertCircle, User, Link
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authService } from '../../services/authService';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  confidence?: number;
}

interface EvidenceRecord {
  id: string;
  alarmId?: string;
  eventType: string;
  cameraId: string;
  timestamp: string;
  confidence: number;
  aiModelVersion: string;
  boundingBoxes?: BoundingBox[];
  trackId?: string;
  location?: string;
  snapshotRef?: string;
  videoClipRef?: string;
  metadata: Record<string, any>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  'ALL',
  'FIRE_DETECTED',
  'SMOKE_DETECTED',
  'PPE_VIOLATION',
  'INTRUSION_DETECTED',
  'VEHICLE_DETECTED',
  'PLATE_RECOGNIZED',
  'OCR_COMPLETED',
  'LOITERING_DETECTED',
  'CROWD_DETECTED',
  'BEHAVIOR_ANALYZED',
] as const;

type EventTypeFilter = typeof EVENT_TYPES[number];

const EVENT_TYPE_COLORS: Record<string, string> = {
  FIRE_DETECTED: 'bg-red-500/15 text-red-400 border-red-500/30',
  SMOKE_DETECTED: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  PPE_VIOLATION: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  INTRUSION_DETECTED: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  VEHICLE_DETECTED: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PLATE_RECOGNIZED: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  OCR_COMPLETED: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  LOITERING_DETECTED: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  CROWD_DETECTED: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  BEHAVIOR_ANALYZED: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
};

function getEventColor(eventType: string): string {
  return EVENT_TYPE_COLORS[eventType] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30';
}

function authHeaders(): Record<string, string> {
  const token = authService.getToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function pct(confidence: number): number {
  if (confidence <= 1) return Math.round(confidence * 100);
  return Math.round(confidence);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const SOCEvidenceManager: React.FC<{ incidentId?: string }> = ({ incidentId }) => {
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>('ALL');
  const [cameraFilter, setCameraFilter] = useState<string>('ALL');
  const [cameras, setCameras] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedRecord, setSelectedRecord] = useState<EvidenceRecord | null>(null);
  const [custodyNote, setCustodyNote] = useState('');
  const [custodyOperator, setCustodyOperator] = useState('');
  const [addingCustody, setAddingCustody] = useState(false);
  const [custodyMsg, setCustodyMsg] = useState('');

  // ── Fetch cameras ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const res = await fetch('/api/cameras', { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.cameras ?? []);
          setCameras(list.map((c: any) => ({ id: c.id, name: c.name ?? c.id })));
        }
      } catch { /* ignore */ }
    };
    fetchCameras();
  }, []);

  // ── Fetch evidence ────────────────────────────────────────────────────────
  const fetchEvidence = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (eventTypeFilter !== 'ALL') params.set('eventType', eventTypeFilter);
      if (cameraFilter !== 'ALL') params.set('cameraId', cameraFilter);
      if (incidentId) params.set('incidentId', incidentId);
      const res = await fetch(`/api/evidence?${params.toString()}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRecords(Array.isArray(data) ? data : (data.evidence ?? data.records ?? []));
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [eventTypeFilter, cameraFilter, incidentId]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const topEventTypes = (() => {
    const counts: Record<string, number> = {};
    for (const r of records) { counts[r.eventType] = (counts[r.eventType] ?? 0) + 1; }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  })();

  // ── Export JSON ───────────────────────────────────────────────────────────
  const exportJson = (rec: EvidenceRecord) => {
    const blob = new Blob([JSON.stringify(rec, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence-${rec.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Add custody entry ─────────────────────────────────────────────────────
  const addCustodyEntry = async () => {
    if (!selectedRecord || !custodyNote.trim()) return;
    setAddingCustody(true);
    setCustodyMsg('');
    try {
      const entry = {
        operator: custodyOperator || 'Unknown Operator',
        note: custodyNote,
        timestamp: new Date().toISOString(),
      };
      const existingLog: any[] = Array.isArray(selectedRecord.metadata?.custodyLog)
        ? selectedRecord.metadata.custodyLog
        : [];
      const updatedMetadata = {
        ...selectedRecord.metadata,
        custodyLog: [...existingLog, entry],
      };
      const res = await fetch(`/api/evidence/${selectedRecord.id}/metadata`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ metadata: updatedMetadata }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedRecord(updated);
        setCustodyNote('');
        setCustodyOperator('');
        setCustodyMsg('Custody entry added.');
        fetchEvidence();
      } else {
        // Optimistically update local state if API not available
        const updatedRecord = { ...selectedRecord, metadata: updatedMetadata };
        setSelectedRecord(updatedRecord);
        setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
        setCustodyNote('');
        setCustodyOperator('');
        setCustodyMsg('Entry added (local).');
      }
    } catch {
      setCustodyMsg('Failed to add custody entry.');
    } finally {
      setAddingCustody(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-5 min-h-0">

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 shrink-0">
        <div className="bg-app-panel border border-border rounded-xl p-4 flex items-center justify-between lg:col-span-1">
          <div>
            <p className="text-[10px] font-bold uppercase text-text-muted">Total Evidence</p>
            <p className="text-2xl font-extrabold text-text-primary mt-0.5">{records.length}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20">
            <Database size={20} className="text-brand-primary" />
          </div>
        </div>
        {topEventTypes.map(([type, count]) => (
          <div key={type} className="bg-app-panel border border-border rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-text-muted truncate">{type.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-extrabold text-text-primary mt-0.5">{count}</p>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getEventColor(type)}`}>
              {Math.round((count / records.length) * 100)}%
            </span>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 bg-app-panel border border-border rounded-xl px-3 py-2">
          <Filter size={13} className="text-text-muted" />
          <select
            value={eventTypeFilter}
            onChange={e => setEventTypeFilter(e.target.value as EventTypeFilter)}
            className="bg-transparent text-xs text-text-primary outline-none"
          >
            {EVENT_TYPES.map(et => (
              <option key={et} value={et}>{et === 'ALL' ? 'All Event Types' : et.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-app-panel border border-border rounded-xl px-3 py-2">
          <Camera size={13} className="text-text-muted" />
          <select
            value={cameraFilter}
            onChange={e => setCameraFilter(e.target.value)}
            className="bg-transparent text-xs text-text-primary outline-none max-w-[160px]"
          >
            <option value="ALL">All Cameras</option>
            {cameras.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchEvidence}
          className="flex items-center gap-2 bg-app-panel border border-border rounded-xl px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:border-brand-primary/40 transition-all"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
        <span className="ml-auto text-xs text-text-muted font-mono">{records.length} records</span>
      </div>

      {/* Main layout: grid + side panel */}
      <div className="flex flex-1 gap-5 min-h-0 overflow-hidden">

        {/* Evidence grid */}
        <div className="flex-1 min-w-0 overflow-y-auto min-h-0">
          {loading && records.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-text-muted">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-text-muted">
              <FolderOpen size={40} className="opacity-20 mb-3" />
              <p className="text-sm font-semibold">No evidence records found</p>
              <p className="text-xs mt-1 text-center">Adjust filters or wait for the AI pipeline to generate evidence.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-4">
              {records.map(rec => (
                <EvidenceCard
                  key={rec.id}
                  record={rec}
                  isSelected={selectedRecord?.id === rec.id}
                  onViewDetails={() => {
                    setSelectedRecord(rec);
                    setCustodyMsg('');
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Side panel */}
        <AnimatePresence>
          {selectedRecord && (
            <motion.div
              key="side-panel"
              initial={{ x: 380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="w-96 shrink-0 flex flex-col bg-app-panel border border-border rounded-xl overflow-hidden"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-brand-primary" />
                  <h3 className="font-bold text-sm text-text-primary">Evidence Detail</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportJson(selectedRecord)}
                    className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/20 text-brand-primary rounded-lg transition-all"
                  >
                    <Download size={11} /> Export JSON
                  </button>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="p-1.5 hover:bg-app-surface rounded-lg text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">

                {/* ID & Event Type */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-text-muted bg-app-primary border border-border px-2 py-0.5 rounded">{selectedRecord.id}</span>
                    {selectedRecord.metadata?.locked && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                        <Lock size={10} /> LOCKED
                      </span>
                    )}
                  </div>
                  <span className={`inline-flex text-[10px] font-bold px-2.5 py-1 rounded border ${getEventColor(selectedRecord.eventType)}`}>
                    {selectedRecord.eventType.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Snapshot / placeholder */}
                {selectedRecord.snapshotRef ? (
                  <div className="rounded-xl overflow-hidden border border-border">
                    <img
                      src={selectedRecord.snapshotRef}
                      alt="Evidence snapshot"
                      className="w-full aspect-video object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-video bg-app-primary border border-border rounded-xl flex flex-col items-center justify-center text-text-muted">
                    <Camera size={28} className="opacity-20 mb-1" />
                    <p className="text-[10px]">No snapshot available</p>
                  </div>
                )}

                {/* Core fields */}
                <div className="bg-app-primary border border-border rounded-xl p-3 space-y-2">
                  <p className="text-[9px] font-bold uppercase text-text-muted mb-2">Record Details</p>
                  {[
                    { label: 'Camera ID', value: selectedRecord.cameraId, icon: <Camera size={10} /> },
                    { label: 'Timestamp', value: fmt(selectedRecord.timestamp), icon: <Clock size={10} /> },
                    { label: 'Confidence', value: `${pct(selectedRecord.confidence)}%`, icon: <Activity size={10} /> },
                    { label: 'AI Model', value: selectedRecord.aiModelVersion, icon: <Layers size={10} />, mono: true },
                    ...(selectedRecord.alarmId ? [{ label: 'Alarm ID', value: selectedRecord.alarmId, icon: <Link size={10} />, mono: true }] : []),
                    ...(selectedRecord.trackId ? [{ label: 'Track ID', value: selectedRecord.trackId, icon: <Hash size={10} />, mono: true }] : []),
                    ...(selectedRecord.location ? [{ label: 'Location', value: selectedRecord.location, icon: <Crosshair size={10} /> }] : []),
                  ].map(({ label, value, icon, mono }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-text-muted flex items-center gap-1">{icon}{label}</span>
                      <span className={`text-[10px] font-semibold text-text-primary text-right truncate max-w-[180px] ${mono ? 'font-mono' : ''}`}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Bounding boxes */}
                {selectedRecord.boundingBoxes && selectedRecord.boundingBoxes.length > 0 && (
                  <div className="bg-app-primary border border-border rounded-xl p-3">
                    <p className="text-[9px] font-bold uppercase text-text-muted mb-2">Bounding Boxes ({selectedRecord.boundingBoxes.length})</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {selectedRecord.boundingBoxes.map((bb, i) => (
                        <div key={i} className="bg-app-surface rounded-lg p-2 text-[10px] font-mono text-text-secondary">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold text-text-primary">{bb.label ?? `Box ${i + 1}`}</span>
                            {bb.confidence !== undefined && (
                              <span className="text-brand-primary font-bold">{pct(bb.confidence)}%</span>
                            )}
                          </div>
                          <span>x:{bb.x} y:{bb.y} w:{bb.width} h:{bb.height}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Video clip ref */}
                {selectedRecord.videoClipRef && (
                  <div className="bg-app-primary border border-border rounded-xl p-3">
                    <p className="text-[9px] font-bold uppercase text-text-muted mb-1">Video Clip</p>
                    <a
                      href={selectedRecord.videoClipRef}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-brand-primary hover:underline flex items-center gap-1 truncate"
                    >
                      <Video size={10} />{selectedRecord.videoClipRef}
                    </a>
                  </div>
                )}

                {/* Metadata key-value table */}
                {Object.keys(selectedRecord.metadata).filter(k => k !== 'custodyLog').length > 0 && (
                  <div className="bg-app-primary border border-border rounded-xl p-3">
                    <p className="text-[9px] font-bold uppercase text-text-muted mb-2">Metadata</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {Object.entries(selectedRecord.metadata)
                        .filter(([k]) => k !== 'custodyLog')
                        .map(([key, val]) => (
                          <div key={key} className="flex items-start gap-2 bg-app-surface rounded-lg px-2 py-1.5">
                            <span className="text-[10px] font-mono font-bold text-text-muted shrink-0 min-w-[80px]">{key}</span>
                            <span className="text-[10px] text-text-secondary break-all">
                              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Chain of Custody */}
                <div className="bg-app-primary border border-border rounded-xl p-3 space-y-3">
                  <p className="text-[9px] font-bold uppercase text-text-muted flex items-center gap-1.5">
                    <Shield size={10} className="text-brand-primary" />
                    Chain of Custody
                  </p>

                  {/* Existing entries */}
                  {Array.isArray(selectedRecord.metadata?.custodyLog) && selectedRecord.metadata.custodyLog.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {(selectedRecord.metadata.custodyLog as any[]).map((entry, i) => (
                        <div key={i} className="bg-app-surface rounded-lg p-2.5 relative">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-bold text-text-primary flex items-center gap-1">
                              <User size={10} className="text-brand-primary" />{entry.operator ?? 'Unknown'}
                            </span>
                            <span className="text-[9px] font-mono text-text-muted">{fmt(entry.timestamp)}</span>
                          </div>
                          <p className="text-[10px] text-text-secondary">{entry.note}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-text-muted">No custody log entries yet.</p>
                  )}

                  {/* Add custody entry */}
                  <div className="space-y-2 pt-1 border-t border-border">
                    <p className="text-[9px] font-bold uppercase text-text-muted">Add Entry</p>
                    <input
                      value={custodyOperator}
                      onChange={e => setCustodyOperator(e.target.value)}
                      placeholder="Operator name..."
                      className="w-full bg-app-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-brand-primary outline-none"
                    />
                    <textarea
                      value={custodyNote}
                      onChange={e => setCustodyNote(e.target.value)}
                      rows={2}
                      placeholder="Custody note..."
                      className="w-full bg-app-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-brand-primary outline-none resize-none"
                    />
                    {custodyMsg && (
                      <p className={`text-[10px] ${custodyMsg.includes('Failed') ? 'text-red-400' : 'text-emerald-400'}`}>{custodyMsg}</p>
                    )}
                    <button
                      onClick={addCustodyEntry}
                      disabled={addingCustody || !custodyNote.trim()}
                      className="flex items-center gap-1.5 bg-brand-primary hover:bg-brand-secondary text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                    >
                      {addingCustody ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                      Add Custody Entry
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Evidence Card ─────────────────────────────────────────────────────────────

const EvidenceCard: React.FC<{
  record: EvidenceRecord;
  isSelected: boolean;
  onViewDetails: () => void;
}> = ({ record, isSelected, onViewDetails }) => {
  const confidence = pct(record.confidence);

  const confidenceColor =
    confidence >= 80 ? 'bg-emerald-500' :
    confidence >= 60 ? 'bg-amber-500' :
    'bg-red-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-app-panel border border-border rounded-xl overflow-hidden flex flex-col transition-all hover:border-brand-primary/40 ${
        isSelected ? 'ring-1 ring-brand-primary/50' : ''
      }`}
    >
      {/* Snapshot */}
      {record.snapshotRef ? (
        <div className="relative">
          <img
            src={record.snapshotRef}
            alt="Evidence snapshot"
            className="w-full aspect-video object-cover"
            onError={e => {
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) {
                (e.target as HTMLImageElement).style.display = 'none';
                parent.classList.add('aspect-video', 'bg-app-primary', 'flex', 'items-center', 'justify-center');
              }
            }}
          />
          {record.metadata?.locked && (
            <div className="absolute top-2 right-2 bg-amber-500/90 rounded-lg p-1">
              <Lock size={12} className="text-white" />
            </div>
          )}
        </div>
      ) : (
        <div className="w-full aspect-video bg-app-primary flex flex-col items-center justify-center text-text-muted relative">
          <Camera size={24} className="opacity-20 mb-1" />
          <p className="text-[10px]">No snapshot</p>
          {record.metadata?.locked && (
            <div className="absolute top-2 right-2 bg-amber-500/90 rounded-lg p-1">
              <Lock size={12} className="text-white" />
            </div>
          )}
        </div>
      )}

      {/* Card body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Event type badge */}
        <span className={`self-start text-[9px] font-bold px-2 py-0.5 rounded border ${getEventColor(record.eventType)}`}>
          {record.eventType.replace(/_/g, ' ')}
        </span>

        {/* Camera + time */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-mono text-text-muted flex items-center gap-1 truncate">
            <Camera size={9} />{record.cameraId}
          </span>
          <span className="text-[9px] text-text-muted flex items-center gap-1 shrink-0">
            <Clock size={9} />{new Date(record.timestamp).toLocaleDateString()}
          </span>
        </div>

        {/* Confidence bar */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-text-muted">Confidence</span>
            <span className="text-[9px] font-bold text-text-primary">{confidence}%</span>
          </div>
          <div className="h-1.5 bg-app-primary rounded-full overflow-hidden">
            <div
              className={`h-full ${confidenceColor} rounded-full transition-all`}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        {/* AI model version */}
        <span className="font-mono text-[10px] text-text-muted truncate">{record.aiModelVersion}</span>

        {/* Optional meta-badges */}
        <div className="flex flex-wrap gap-1">
          {record.boundingBoxes && record.boundingBoxes.length > 0 && (
            <span className="text-[9px] bg-app-primary border border-border text-text-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Crosshair size={9} />{record.boundingBoxes.length} box{record.boundingBoxes.length !== 1 ? 'es' : ''}
            </span>
          )}
          {record.trackId && (
            <span className="text-[9px] bg-app-primary border border-border font-mono text-text-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Hash size={9} />{record.trackId}
            </span>
          )}
        </div>

        {/* View Details */}
        <button
          onClick={onViewDetails}
          className="mt-auto w-full flex items-center justify-center gap-1.5 bg-app-primary hover:bg-brand-primary/10 border border-border hover:border-brand-primary/40 text-text-secondary hover:text-brand-primary text-[10px] font-bold py-1.5 rounded-lg transition-all"
        >
          <Eye size={11} /> View Details
        </button>
      </div>
    </motion.div>
  );
};
