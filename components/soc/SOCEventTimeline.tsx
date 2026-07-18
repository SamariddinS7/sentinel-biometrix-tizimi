import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, AlertTriangle, Camera, Flame, ShieldAlert, Eye, Car,
  Users, MapPin, Zap, Search, Filter, Trash2, RefreshCw,
  Wifi, WifiOff, Clock, ChevronDown, Download
} from 'lucide-react';
import { vmsEventService, VmsEvent, VmsEventType } from '../../services/vmsEventService';

// ── Event type metadata ───────────────────────────────────────────────────────

interface EventMeta {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  color: string;      // tailwind bg color class
  textColor: string;  // tailwind text color class
  borderColor: string;
}

const EVENT_META: Partial<Record<VmsEventType, EventMeta>> = {
  FIRE_DETECTED:           { icon: Flame,      label: 'Fire Detected',       color: 'bg-red-500/15',    textColor: 'text-red-400',    borderColor: 'border-red-500/40' },
  SMOKE_DETECTED:          { icon: Flame,      label: 'Smoke Detected',      color: 'bg-orange-500/15', textColor: 'text-orange-400', borderColor: 'border-orange-500/40' },
  HAZARD_DETECTED:         { icon: ShieldAlert,label: 'Hazard Detected',     color: 'bg-red-500/15',    textColor: 'text-red-400',    borderColor: 'border-red-500/40' },
  INTRUSION_DETECTED:      { icon: ShieldAlert,label: 'Intrusion Detected',  color: 'bg-red-500/15',    textColor: 'text-red-400',    borderColor: 'border-red-500/40' },
  FACE_RECOGNIZED:         { icon: Eye,        label: 'Face Recognized',     color: 'bg-cyan-500/15',   textColor: 'text-cyan-400',   borderColor: 'border-cyan-500/40' },
  AI_DETECTION_FINISHED:   { icon: Activity,   label: 'AI Detection',        color: 'bg-brand-primary/10', textColor: 'text-brand-primary', borderColor: 'border-brand-primary/30' },
  VEHICLE_DETECTED:        { icon: Car,        label: 'Vehicle Detected',    color: 'bg-purple-500/15', textColor: 'text-purple-400', borderColor: 'border-purple-500/40' },
  PLATE_RECOGNIZED:        { icon: Car,        label: 'Plate Recognized',    color: 'bg-purple-500/15', textColor: 'text-purple-400', borderColor: 'border-purple-500/40' },
  CROWD_DETECTED:          { icon: Users,      label: 'Crowd Detected',      color: 'bg-amber-500/15',  textColor: 'text-amber-400',  borderColor: 'border-amber-500/40' },
  LOITERING_DETECTED:      { icon: MapPin,     label: 'Loitering Detected',  color: 'bg-amber-500/15',  textColor: 'text-amber-400',  borderColor: 'border-amber-500/40' },
  PPE_VIOLATION:           { icon: ShieldAlert,label: 'PPE Violation',       color: 'bg-yellow-500/15', textColor: 'text-yellow-400', borderColor: 'border-yellow-500/40' },
  CAMERA_CONNECTED:        { icon: Camera,     label: 'Camera Online',       color: 'bg-emerald-500/15',textColor: 'text-emerald-400',borderColor: 'border-emerald-500/40' },
  CAMERA_DISCONNECTED:     { icon: WifiOff,    label: 'Camera Offline',      color: 'bg-red-500/15',    textColor: 'text-red-400',    borderColor: 'border-red-500/40' },
  ANALYTICS_ALARM_CREATED: { icon: Zap,        label: 'Alarm Created',       color: 'bg-red-500/15',    textColor: 'text-red-400',    borderColor: 'border-red-500/40' },
  LINE_CROSSED:            { icon: MapPin,     label: 'Line Crossed',        color: 'bg-orange-500/15', textColor: 'text-orange-400', borderColor: 'border-orange-500/40' },
  ZONE_ENTERED:            { icon: MapPin,     label: 'Zone Entered',        color: 'bg-blue-500/15',   textColor: 'text-blue-400',   borderColor: 'border-blue-500/40' },
  ABANDONED_OBJECT_DETECTED:{ icon: ShieldAlert,label:'Abandoned Object',    color: 'bg-orange-500/15', textColor: 'text-orange-400', borderColor: 'border-orange-500/40' },
};

const DEFAULT_META: EventMeta = {
  icon: Activity, label: 'System Event', color: 'bg-border/40',
  textColor: 'text-text-muted', borderColor: 'border-border',
};

const SEVERITY_BADGE: Record<VmsEvent['severity'], string> = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
  WARNING:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  INFO:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  SUCCESS:  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const FILTER_GROUPS = [
  { label: 'All',       value: 'ALL' },
  { label: 'Critical',  value: 'CRITICAL' },
  { label: 'Warning',   value: 'WARNING' },
  { label: 'Hazard',    value: 'HAZARD' },
  { label: 'Persons',   value: 'PERSON' },
  { label: 'Vehicles',  value: 'VEHICLE' },
  { label: 'Analytics', value: 'ANALYTICS' },
] as const;

type FilterGroup = typeof FILTER_GROUPS[number]['value'];

function matchesFilter(event: VmsEvent, group: FilterGroup): boolean {
  if (group === 'ALL') return true;
  if (group === 'CRITICAL') return event.severity === 'CRITICAL';
  if (group === 'WARNING')  return event.severity === 'WARNING';
  if (group === 'HAZARD')   return ['FIRE_DETECTED','SMOKE_DETECTED','HAZARD_DETECTED','EXPLOSION_DETECTED','GAS_LEAK_DETECTED','FLOOD_DETECTED'].includes(event.type);
  if (group === 'PERSON')   return ['FACE_RECOGNIZED','INTRUSION_DETECTED','LOITERING_DETECTED','LINE_CROSSED','ZONE_ENTERED','ZONE_EXITED','PPE_VIOLATION'].includes(event.type);
  if (group === 'VEHICLE')  return ['VEHICLE_DETECTED','VEHICLE_ENTERED','VEHICLE_EXITED','PLATE_RECOGNIZED'].includes(event.type);
  if (group === 'ANALYTICS')return ['ANALYTICS_COMPLETED','ANALYTICS_ALARM_CREATED','AI_DETECTION_FINISHED','CROWD_DETECTED','HEATMAP_UPDATED','OCCUPANCY_UPDATED'].includes(event.type);
  return true;
}

// ── EventRow ──────────────────────────────────────────────────────────────────

const EventRow: React.FC<{ event: VmsEvent; isNew?: boolean }> = ({ event, isNew }) => {
  const meta = EVENT_META[event.type] ?? DEFAULT_META;
  const Icon = meta.icon;
  const ts = new Date(event.timestamp);

  return (
    <motion.div
      layout
      initial={isNew ? { opacity: 0, y: -12, scale: 0.97 } : { opacity: 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex items-start gap-3 p-3 rounded-xl border ${meta.color} ${meta.borderColor} transition-all`}
    >
      {/* Icon */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.color}`}>
        <Icon size={14} className={meta.textColor} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-black uppercase tracking-wider ${meta.textColor}`}>{meta.label}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${SEVERITY_BADGE[event.severity]}`}>
            {event.severity}
          </span>
          {isNew && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-primary/20 text-brand-primary border border-brand-primary/30 uppercase animate-pulse">
              LIVE
            </span>
          )}
        </div>
        <p className="text-xs text-text-primary font-medium mt-0.5 leading-snug truncate">
          {event.source}
        </p>
        {event.payload && typeof event.payload === 'object' && (
          <p className="text-[10px] text-text-muted mt-0.5 truncate">
            {Object.entries(event.payload as Record<string,any>)
              .filter(([k]) => ['confidence','label','trackId','plate','count','zone'].includes(k))
              .slice(0, 3)
              .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(2) : v}`)
              .join(' · ')}
          </p>
        )}
      </div>

      {/* Timestamp */}
      <div className="text-right flex-shrink-0">
        <span className="text-[9px] font-mono text-text-muted block">{ts.toLocaleTimeString()}</span>
        <span className="text-[8px] text-text-muted/60">{ts.toLocaleDateString()}</span>
      </div>
    </motion.div>
  );
};

// ── SOCEventTimeline ──────────────────────────────────────────────────────────

export const SOCEventTimeline: React.FC = () => {
  const [events, setEvents] = useState<VmsEvent[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterGroup>('ALL');
  const [search, setSearch] = useState('');
  const [paused, setPaused] = useState(false);
  const [maxVisible, setMaxVisible] = useState(100);

  // Load history on mount
  useEffect(() => {
    setEvents(vmsEventService.getHistory());
  }, []);

  // Subscribe to live events
  useEffect(() => {
    const unsub = vmsEventService.subscribeToAll((evt) => {
      if (paused) return;
      setEvents(prev => [evt, ...prev].slice(0, 500));
      setNewIds(prev => {
        const next = new Set(prev);
        next.add(evt.id);
        setTimeout(() => setNewIds(s => { const n = new Set(s); n.delete(evt.id); return n; }), 4000);
        return next;
      });
    });
    return unsub;
  }, [paused]);

  const handleClear = useCallback(() => {
    vmsEventService.clearHistory();
    setEvents([]);
    setNewIds(new Set());
  }, []);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soc-events-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [events]);

  const filtered = events.filter(e => {
    if (!matchesFilter(e, filter)) return false;
    if (search) {
      const s = search.toLowerCase();
      return e.type.toLowerCase().includes(s) ||
             e.source.toLowerCase().includes(s) ||
             (EVENT_META[e.type]?.label ?? '').toLowerCase().includes(s);
    }
    return true;
  }).slice(0, maxVisible);

  const criticalCount = events.filter(e => e.severity === 'CRITICAL').length;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="bg-app-panel border border-border rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity size={16} className="text-brand-primary" />
              <h2 className="font-bold text-text-primary text-sm">AI Event Timeline</h2>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${paused ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 animate-pulse'}`}>
                {paused ? 'PAUSED' : 'LIVE'}
              </span>
              {criticalCount > 0 && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded border uppercase bg-red-500/15 text-red-400 border-red-500/30">
                  {criticalCount} CRITICAL
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted">{events.length} events recorded · {filtered.length} visible</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter events..."
                className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs bg-app-primary border border-border rounded-lg text-text-primary focus:outline-none focus:border-brand-primary placeholder:text-text-muted"
              />
            </div>
            <button
              onClick={() => setPaused(v => !v)}
              className={`p-2 rounded-lg border text-xs font-bold transition-all ${paused ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/15 border-amber-500/30 text-amber-400'}`}
              title={paused ? 'Resume' : 'Pause'}
            >
              {paused ? <Wifi size={14} /> : <WifiOff size={14} />}
            </button>
            <button onClick={handleExport} className="p-2 rounded-lg border border-border bg-app-primary text-text-muted hover:text-text-primary transition-all" title="Export JSON">
              <Download size={14} />
            </button>
            <button onClick={handleClear} className="p-2 rounded-lg border border-border bg-app-primary text-text-muted hover:text-red-400 transition-all" title="Clear history">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-4 flex-wrap">
          {FILTER_GROUPS.map(fg => (
            <button
              key={fg.value}
              onClick={() => setFilter(fg.value)}
              className={`text-[10px] font-bold px-3 py-1 rounded-lg transition-all ${filter === fg.value ? 'bg-brand-primary text-white' : 'bg-app-primary border border-border text-text-muted hover:text-text-primary'}`}
            >
              {fg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event feed */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pb-4 pr-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-muted">
            <Activity size={36} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">No events match the current filter</p>
            <p className="text-xs mt-1">Events will appear here in real-time as they are detected</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map(event => (
              <EventRow key={event.id} event={event} isNew={newIds.has(event.id)} />
            ))}
          </AnimatePresence>
        )}

        {filtered.length >= maxVisible && events.length > maxVisible && (
          <button
            onClick={() => setMaxVisible(v => v + 100)}
            className="w-full py-2 text-xs text-text-muted border border-border border-dashed rounded-xl hover:border-brand-primary hover:text-brand-primary transition-all flex items-center justify-center gap-2"
          >
            <ChevronDown size={14} /> Load more ({events.length - maxVisible} remaining)
          </button>
        )}
      </div>
    </div>
  );
};
