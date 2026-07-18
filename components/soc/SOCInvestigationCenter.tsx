import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Camera, Clock, User, Filter, ChevronDown, Eye, Plus,
  AlertCircle, CheckCircle2, XCircle, FileText, Link, Tag,
  ArrowRight, RefreshCw, Calendar, Sliders, UserCheck, Layers,
  Activity, List, BarChart3, ChevronRight, X, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authService } from '../../services/authService';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CameraItem {
  id: string;
  name: string;
  location?: string;
  status?: string;
}

interface AnalyticsEvent {
  id: string;
  cameraId?: string;
  cameraName?: string;
  type?: string;
  eventType?: string;
  timestamp: string;
  confidence?: number;
  evidenceRef?: string;
  payload?: Record<string, any>;
  description?: string;
}

interface PersonRecord {
  id: string;
  personName?: string;
  name?: string;
  trackId?: string;
  appearances?: Array<{ timestamp: string; cameraId: string; zone?: string; confidence?: number }>;
}

interface IdentityResult {
  id: string;
  name?: string;
  fullName?: string;
  role?: string;
  status?: string;
  lastSeen?: string;
  department?: string;
}

interface Incident {
  id: string;
  title?: string;
  status?: string;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  INTRUSION: 'bg-red-500/20 text-red-400 border border-red-500/30',
  MOTION: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  LOITERING: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  FACE_DETECTED: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  WEAPON: 'bg-red-700/30 text-red-300 border border-red-700/40',
  CROWD: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  PPE_VIOLATION: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  DEFAULT: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

function eventBadgeClass(type?: string) {
  return EVENT_TYPE_COLORS[type?.toUpperCase() ?? ''] ?? EVENT_TYPE_COLORS.DEFAULT;
}

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken?.() || '';
  return token ? { Authorization: 'Bearer ' + token } : {};
}

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

// ─── Tab: Timeline ───────────────────────────────────────────────────────────

const TimelineTab: React.FC = () => {
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [selectedCams, setSelectedCams] = useState<Set<string>>(new Set());
  const defaultSince = new Date(Date.now() - 86400000).toISOString().slice(0, 16);
  const defaultTo = new Date().toISOString().slice(0, 16);
  const [since, setSince] = useState(defaultSince);
  const [until, setUntil] = useState(defaultTo);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [evidence, setEvidence] = useState<any | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/cameras', { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then((data: any) => {
        const list: CameraItem[] = Array.isArray(data) ? data : (data.cameras ?? []);
        setCameras(list);
      })
      .catch(() => {});
  }, []);

  const toggleCam = (id: string) => {
    setSelectedCams(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const loadTimeline = async () => {
    if (selectedCams.size === 0) { setError('Select at least one camera.'); return; }
    setLoading(true); setError(''); setEvents([]);
    try {
      const headers = getAuthHeaders();
      const promises = [...selectedCams].map(cid =>
        fetch(`/api/analytics/events?cameraId=${cid}&since=${new Date(since).toISOString()}&limit=200`, { headers })
          .then(r => r.ok ? r.json() : { events: [] })
          .then((d: any) => {
            const evts: AnalyticsEvent[] = Array.isArray(d) ? d : (d.events ?? []);
            const cam = cameras.find(c => c.id === cid);
            return evts.map(e => ({ ...e, cameraName: cam?.name ?? cid }));
          })
      );
      const results = await Promise.all(promises);
      const merged = results.flat().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEvents(merged);
      if (merged.length === 0) setError('No events found in the selected range.');
    } catch {
      setError('Failed to load timeline events.');
    } finally {
      setLoading(false);
    }
  };

  const viewEvidence = async (evidenceRef: string) => {
    setEvidenceLoading(true); setEvidence(null);
    try {
      const r = await fetch(`/api/evidence/${evidenceRef}`, { headers: getAuthHeaders() });
      if (r.ok) setEvidence(await r.json());
      else setEvidence({ error: 'Evidence not found.' });
    } catch {
      setEvidence({ error: 'Failed to load evidence.' });
    } finally {
      setEvidenceLoading(false);
    }
  };

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Left: Camera selector + controls */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        <div className="bg-app-panel border border-border rounded-lg p-3 flex flex-col gap-2">
          <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
            <Camera size={12} /> Select Cameras
          </p>
          <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
            {cameras.length === 0 && <p className="text-text-muted text-xs py-2">No cameras loaded.</p>}
            {cameras.map(cam => (
              <label key={cam.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-app-surface transition-colors">
                <input
                  type="checkbox"
                  checked={selectedCams.has(cam.id)}
                  onChange={() => toggleCam(cam.id)}
                  className="accent-brand-primary"
                />
                <span className="text-text-primary text-sm truncate">{cam.name}</span>
                {cam.location && <span className="text-text-muted text-xs ml-auto truncate">{cam.location}</span>}
              </label>
            ))}
          </div>
        </div>

        <div className="bg-app-panel border border-border rounded-lg p-3 flex flex-col gap-2">
          <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
            <Calendar size={12} /> Date Range
          </p>
          <label className="text-text-muted text-xs">From</label>
          <input type="datetime-local" value={since} onChange={e => setSince(e.target.value)}
            className="bg-app-surface border border-border rounded px-2 py-1 text-text-primary text-xs w-full" />
          <label className="text-text-muted text-xs">To</label>
          <input type="datetime-local" value={until} onChange={e => setUntil(e.target.value)}
            className="bg-app-surface border border-border rounded px-2 py-1 text-text-primary text-xs w-full" />
        </div>

        <button
          onClick={loadTimeline}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-brand-primary text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
          Load Timeline
        </button>

        {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded p-2">{error}</p>}
      </div>

      {/* Center: Timeline events */}
      <div className="flex-1 min-w-0 overflow-y-auto flex flex-col gap-2">
        {events.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-32 text-text-muted">
            <Clock size={28} className="mb-2 opacity-40" />
            <p className="text-sm">No events. Select cameras and load timeline.</p>
          </div>
        )}
        {events.map((evt, i) => (
          <motion.div
            key={evt.id ?? i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.01 }}
            className="bg-app-panel border border-border rounded-lg p-3 flex items-start gap-3 hover:border-brand-primary/30 transition-colors"
          >
            <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${eventBadgeClass(evt.type ?? evt.eventType)}`}>
              {(evt.type ?? evt.eventType ?? 'EVENT').toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-text-primary text-sm font-medium">{evt.cameraName ?? evt.cameraId}</span>
                <span className="text-text-muted text-xs">{formatTs(evt.timestamp)}</span>
                {evt.confidence != null && (
                  <span className="text-text-secondary text-xs">{(evt.confidence * 100).toFixed(0)}% conf</span>
                )}
              </div>
              {evt.description && <p className="text-text-secondary text-xs mt-0.5 truncate">{evt.description}</p>}
            </div>
            {evt.evidenceRef && (
              <button
                onClick={() => viewEvidence(evt.evidenceRef!)}
                className="flex items-center gap-1 text-brand-primary text-xs border border-brand-primary/30 rounded px-2 py-1 hover:bg-brand-primary/10 transition-colors flex-shrink-0"
              >
                <Eye size={12} /> View Evidence
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Right: Evidence panel */}
      <AnimatePresence>
        {(evidence || evidenceLoading) && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-72 flex-shrink-0 bg-app-panel border border-border rounded-lg p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Evidence</p>
              <button onClick={() => setEvidence(null)} className="text-text-muted hover:text-text-primary">
                <X size={14} />
              </button>
            </div>
            {evidenceLoading && <div className="flex items-center justify-center h-20"><Loader2 size={20} className="animate-spin text-brand-primary" /></div>}
            {evidence && !evidenceLoading && (
              evidence.error
                ? <p className="text-red-400 text-xs">{evidence.error}</p>
                : <pre className="text-text-secondary text-xs overflow-auto max-h-80 bg-app-surface rounded p-2">{JSON.stringify(evidence, null, 2)}</pre>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Tab: Cross-Camera Tracking ──────────────────────────────────────────────

const CrossCameraTab: React.FC = () => {
  const [persons, setPersons] = useState<PersonRecord[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<PersonRecord | null>(null);
  const [trackingData, setTrackingData] = useState<Array<{ timestamp: string; cameraId: string; trackId?: string; zone?: string; confidence?: number }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/ai/persons/history?limit=50', { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then((d: any) => {
        const list: PersonRecord[] = Array.isArray(d) ? d : (d.persons ?? d.data ?? []);
        setPersons(list);
      })
      .catch(() => {});
  }, []);

  const loadTracking = async (person: PersonRecord) => {
    setSelectedPerson(person);
    setLoading(true);
    setTrackingData([]);
    try {
      const headers = getAuthHeaders();
      const r = await fetch(`/api/analytics/events?limit=500`, { headers });
      if (r.ok) {
        const d = await r.json();
        const evts: AnalyticsEvent[] = Array.isArray(d) ? d : (d.events ?? []);
        const personName = person.personName ?? person.name ?? '';
        const filtered = evts.filter(e =>
          (personName && (e.payload?.personName === personName || e.payload?.name === personName)) ||
          (person.trackId && e.payload?.trackId === person.trackId)
        ).map(e => ({
          timestamp: e.timestamp,
          cameraId: e.cameraId ?? '',
          trackId: e.payload?.trackId,
          zone: e.payload?.zone,
          confidence: e.confidence,
        }));
        filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Merge with appearances if available
        const appearances = person.appearances ?? [];
        const allRows = [...appearances.map(a => ({ timestamp: a.timestamp, cameraId: a.cameraId, zone: a.zone, confidence: a.confidence })), ...filtered];
        allRows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setTrackingData(allRows);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  // Build horizontal timeline from camera IDs
  const camSequence = [...new Map(trackingData.map(r => [r.cameraId, r])).entries()];

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <UserCheck size={14} className="text-text-muted" />
          <select
            className="flex-1 bg-app-surface border border-border rounded-lg px-3 py-2 text-text-primary text-sm"
            onChange={e => {
              const p = persons.find(p => (p.id ?? p.personName) === e.target.value);
              if (p) loadTracking(p);
            }}
            defaultValue=""
          >
            <option value="" disabled>Select person to track…</option>
            {persons.map(p => (
              <option key={p.id ?? p.personName} value={p.id ?? p.personName}>
                {p.personName ?? p.name ?? p.id}
              </option>
            ))}
          </select>
        </div>
        {loading && <Loader2 size={16} className="animate-spin text-brand-primary" />}
      </div>

      {persons.length === 0 && (
        <div className="flex items-center justify-center h-20 text-text-muted text-sm">
          No persons found in history.
        </div>
      )}

      {selectedPerson && (
        <>
          {/* Horizontal Appearance Timeline */}
          {trackingData.length > 0 && (
            <div className="bg-app-panel border border-border rounded-lg p-3">
              <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">Appearance Timeline</p>
              <div className="flex items-center gap-0 overflow-x-auto pb-2">
                {trackingData.map((row, i) => (
                  <React.Fragment key={i}>
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-brand-primary/20 border-2 border-brand-primary flex items-center justify-center">
                        <Camera size={12} className="text-brand-primary" />
                      </div>
                      <p className="text-text-muted text-xs mt-1 w-20 text-center truncate">{row.cameraId}</p>
                      <p className="text-text-muted text-xs">{new Date(row.timestamp).toLocaleTimeString()}</p>
                    </div>
                    {i < trackingData.length - 1 && (
                      <ArrowRight size={14} className="text-text-muted mx-1 flex-shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-app-panel border border-border rounded-lg overflow-hidden flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-app-surface">
                  <th className="text-left text-text-muted text-xs px-3 py-2 font-semibold">Timestamp</th>
                  <th className="text-left text-text-muted text-xs px-3 py-2 font-semibold">Camera</th>
                  <th className="text-left text-text-muted text-xs px-3 py-2 font-semibold">Track ID</th>
                  <th className="text-left text-text-muted text-xs px-3 py-2 font-semibold">Zone</th>
                  <th className="text-left text-text-muted text-xs px-3 py-2 font-semibold">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {trackingData.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-text-muted text-xs py-6">No tracking data available.</td></tr>
                )}
                {trackingData.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-app-surface/50 transition-colors">
                    <td className="px-3 py-2 text-text-secondary text-xs">{formatTs(row.timestamp)}</td>
                    <td className="px-3 py-2 text-text-primary text-xs">{row.cameraId}</td>
                    <td className="px-3 py-2 text-text-secondary text-xs">{row.trackId ?? '—'}</td>
                    <td className="px-3 py-2 text-text-secondary text-xs">{row.zone ?? '—'}</td>
                    <td className="px-3 py-2 text-text-secondary text-xs">
                      {row.confidence != null ? `${(row.confidence * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Tab: Appearance Search ───────────────────────────────────────────────────

const COLOR_OPTIONS = ['Any', 'Red', 'Blue', 'Black', 'White', 'Gray', 'Navy', 'Green', 'Orange', 'Yellow'];

const AppearanceTab: React.FC = () => {
  const [upperColor, setUpperColor] = useState('Any');
  const [lowerColor, setLowerColor] = useState('Any');
  const [backpack, setBackpack] = useState('Any');
  const [bodySize, setBodySize] = useState('Any');
  const [freeText, setFreeText] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const doSearch = async () => {
    setLoading(true); setError(''); setResults([]);
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const body: Record<string, any> = {};
      if (upperColor !== 'Any') body.upperColor = upperColor.toLowerCase();
      if (lowerColor !== 'Any') body.lowerColor = lowerColor.toLowerCase();
      if (backpack !== 'Any') body.backpack = backpack === 'Yes';
      if (bodySize !== 'Any') body.bodySize = bodySize.toUpperCase();

      const r = await fetch('/api/search/appearance', { method: 'POST', headers, body: JSON.stringify(body) });
      if (r.ok) {
        const d = await r.json();
        setResults(Array.isArray(d) ? d : (d.results ?? d.persons ?? []));
      } else {
        setError('Search returned no results.');
      }
    } catch {
      setError('Appearance search failed.');
    } finally {
      setLoading(false);
    }
  };

  const doNLSearch = async () => {
    if (!freeText.trim()) return;
    setLoading(true); setError(''); setResults([]);
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const r = await fetch('/api/search/natural-language', {
        method: 'POST', headers, body: JSON.stringify({ query: freeText })
      });
      if (r.ok) {
        const d = await r.json();
        setResults(Array.isArray(d) ? d : (d.results ?? d.persons ?? []));
      } else {
        setError('No results found.');
      }
    } catch {
      setError('Natural language search failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-2 gap-3 bg-app-panel border border-border rounded-lg p-4">
        <div className="flex flex-col gap-1">
          <label className="text-text-muted text-xs font-semibold uppercase tracking-wider">Upper Color</label>
          <select value={upperColor} onChange={e => setUpperColor(e.target.value)}
            className="bg-app-surface border border-border rounded px-2 py-1.5 text-text-primary text-sm">
            {COLOR_OPTIONS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-text-muted text-xs font-semibold uppercase tracking-wider">Lower Color</label>
          <select value={lowerColor} onChange={e => setLowerColor(e.target.value)}
            className="bg-app-surface border border-border rounded px-2 py-1.5 text-text-primary text-sm">
            {COLOR_OPTIONS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-text-muted text-xs font-semibold uppercase tracking-wider">Backpack</label>
          <select value={backpack} onChange={e => setBackpack(e.target.value)}
            className="bg-app-surface border border-border rounded px-2 py-1.5 text-text-primary text-sm">
            {['Any', 'Yes', 'No'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-text-muted text-xs font-semibold uppercase tracking-wider">Body Size</label>
          <select value={bodySize} onChange={e => setBodySize(e.target.value)}
            className="bg-app-surface border border-border rounded px-2 py-1.5 text-text-primary text-sm">
            {['Any', 'Tall', 'Short', 'Standard'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>

        <div className="col-span-2 flex gap-2">
          <input
            type="text" placeholder="Natural language search…"
            value={freeText} onChange={e => setFreeText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doNLSearch()}
            className="flex-1 bg-app-surface border border-border rounded px-3 py-1.5 text-text-primary text-sm"
          />
          <button onClick={doNLSearch} disabled={loading}
            className="px-3 py-1.5 border border-border rounded text-text-secondary text-sm hover:bg-app-surface transition-colors disabled:opacity-50">
            <Search size={14} />
          </button>
          <button onClick={doSearch} disabled={loading}
            className="px-4 py-1.5 bg-brand-primary text-white rounded text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
            Search
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded p-2">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto flex-1">
        {results.length === 0 && !loading && (
          <div className="col-span-full flex flex-col items-center justify-center h-24 text-text-muted">
            <User size={24} className="mb-1 opacity-40" />
            <p className="text-sm">No results yet. Run a search above.</p>
          </div>
        )}
        {results.map((r, i) => (
          <motion.div key={r.id ?? i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
            className="bg-app-panel border border-border rounded-lg p-3 flex flex-col gap-2 hover:border-brand-primary/30 transition-colors">
            <div className="w-12 h-12 rounded-full bg-app-surface border border-border flex items-center justify-center self-center">
              <User size={20} className="text-text-muted" />
            </div>
            <p className="text-text-primary text-sm font-medium text-center truncate">{r.name ?? r.personName ?? r.fullName ?? 'Unknown'}</p>
            {r.confidence != null && (
              <p className="text-text-secondary text-xs text-center">{(r.confidence * 100).toFixed(0)}% match</p>
            )}
            <div className="flex gap-1 flex-wrap justify-center">
              {r.upperColor && <span className="px-1.5 py-0.5 bg-app-surface rounded text-text-muted text-xs">↑ {r.upperColor}</span>}
              {r.lowerColor && <span className="px-1.5 py-0.5 bg-app-surface rounded text-text-muted text-xs">↓ {r.lowerColor}</span>}
            </div>
            {r.id && (
              <a href={`#/identity/${r.id}`}
                className="text-brand-primary text-xs text-center hover:underline">View Full Profile</a>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ─── Tab: Identity Search ─────────────────────────────────────────────────────

const IdentityTab: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IdentityResult[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(''); setResults([]);
    try {
      const r = await fetch(`/api/search/identities?q=${encodeURIComponent(query)}&limit=20`, { headers: getAuthHeaders() });
      if (r.ok) {
        const d = await r.json();
        setResults(Array.isArray(d) ? d : (d.results ?? d.identities ?? []));
      } else {
        setError('No identities found.');
      }
    } catch {
      setError('Identity search failed.');
    } finally {
      setLoading(false);
    }
  };

  const viewDetail = async (id: string) => {
    setDetailLoading(true); setSelectedIdentity(null);
    try {
      const r = await fetch(`/api/search/identity/${id}`, { headers: getAuthHeaders() });
      if (r.ok) setSelectedIdentity(await r.json());
      else setSelectedIdentity({ error: 'Not found.' });
    } catch {
      setSelectedIdentity({ error: 'Failed to load identity.' });
    } finally {
      setDetailLoading(false);
    }
  };

  const roleBadge = (role?: string) => {
    const map: Record<string, string> = {
      ADMIN: 'bg-brand-primary/20 text-brand-primary',
      SUPERVISOR: 'bg-purple-500/20 text-purple-400',
      OPERATOR: 'bg-blue-500/20 text-blue-400',
      GUARD: 'bg-gray-500/20 text-gray-400',
    };
    return map[role?.toUpperCase() ?? ''] ?? 'bg-gray-500/20 text-gray-400';
  };

  const statusBadge = (status?: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-green-500/20 text-green-400',
      INACTIVE: 'bg-gray-500/20 text-gray-400',
      SUSPENDED: 'bg-red-500/20 text-red-400',
    };
    return map[status?.toUpperCase() ?? ''] ?? 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex gap-2">
          <input
            type="text" placeholder="Search identities by name, ID, or role…"
            value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            className="flex-1 bg-app-surface border border-border rounded-lg px-3 py-2 text-text-primary text-sm"
          />
          <button onClick={doSearch} disabled={loading}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </div>

        {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded p-2">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto flex-1">
          {results.length === 0 && !loading && (
            <div className="col-span-full flex flex-col items-center justify-center h-24 text-text-muted">
              <UserCheck size={24} className="mb-1 opacity-40" />
              <p className="text-sm">Enter a search term to find identities.</p>
            </div>
          )}
          {results.map((identity, i) => (
            <motion.div key={identity.id ?? i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => viewDetail(identity.id)}
              className="bg-app-panel border border-border rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-brand-primary/30 transition-colors">
              <div className="w-9 h-9 rounded-full bg-app-surface border border-border flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-text-primary text-sm font-medium truncate">{identity.name ?? identity.fullName ?? identity.id}</p>
                <p className="text-text-muted text-xs">{identity.lastSeen ? `Last seen: ${formatTs(identity.lastSeen)}` : ''}</p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                {identity.role && <span className={`px-2 py-0.5 rounded text-xs font-semibold ${roleBadge(identity.role)}`}>{identity.role}</span>}
                {identity.status && <span className={`px-2 py-0.5 rounded text-xs ${statusBadge(identity.status)}`}>{identity.status}</span>}
              </div>
              <ChevronRight size={14} className="text-text-muted flex-shrink-0" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {(selectedIdentity || detailLoading) && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="w-80 flex-shrink-0 bg-app-panel border border-border rounded-lg p-4 flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Identity Detail</p>
              <button onClick={() => setSelectedIdentity(null)} className="text-text-muted hover:text-text-primary"><X size={14} /></button>
            </div>
            {detailLoading && <div className="flex items-center justify-center h-20"><Loader2 size={20} className="animate-spin text-brand-primary" /></div>}
            {selectedIdentity && !detailLoading && (
              selectedIdentity.error
                ? <p className="text-red-400 text-xs">{selectedIdentity.error}</p>
                : <pre className="text-text-secondary text-xs overflow-auto bg-app-surface rounded p-2">{JSON.stringify(selectedIdentity, null, 2)}</pre>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Tab: Event Search ────────────────────────────────────────────────────────

const EVENT_TYPES = ['ALL', 'INTRUSION', 'MOTION', 'LOITERING', 'FACE_DETECTED', 'WEAPON', 'CROWD', 'PPE_VIOLATION'];

const EventSearchTab: React.FC = () => {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [cameraFilter, setCameraFilter] = useState('');
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [incidentModal, setIncidentModal] = useState<{ eventId: string } | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [addingToIncident, setAddingToIncident] = useState(false);
  const [addSuccess, setAddSuccess] = useState('');

  useEffect(() => {
    fetch('/api/cameras', { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then((d: any) => setCameras(Array.isArray(d) ? d : (d.cameras ?? [])))
      .catch(() => {});

    fetch('/api/incidents?status=OPEN', { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then((d: any) => setIncidents(Array.isArray(d) ? d : (d.incidents ?? [])))
      .catch(() => {});
  }, []);

  const doSearch = async () => {
    setLoading(true); setError(''); setEvents([]);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (query) params.set('q', query);
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (cameraFilter) params.set('cameraId', cameraFilter);
      const r = await fetch(`/api/analytics/search?${params.toString()}`, { headers: getAuthHeaders() });
      if (r.ok) {
        const d = await r.json();
        setEvents(Array.isArray(d) ? d : (d.events ?? d.results ?? []));
      } else {
        setError('No events found matching your criteria.');
      }
    } catch {
      setError('Event search failed.');
    } finally {
      setLoading(false);
    }
  };

  const addToIncident = async () => {
    if (!incidentModal || !selectedIncidentId) return;
    setAddingToIncident(true);
    try {
      const r = await fetch(`/api/incidents/${selectedIncidentId}/evidence`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: incidentModal.eventId }),
      });
      if (r.ok) {
        setAddSuccess('Evidence added to incident.');
        setTimeout(() => { setAddSuccess(''); setIncidentModal(null); }, 2000);
      } else {
        setAddSuccess('Failed to add evidence.');
      }
    } catch {
      setAddSuccess('Failed to add evidence.');
    } finally {
      setAddingToIncident(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex gap-2 flex-wrap bg-app-panel border border-border rounded-lg p-3">
        <input
          type="text" placeholder="Search events…"
          value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          className="flex-1 min-w-40 bg-app-surface border border-border rounded px-3 py-1.5 text-text-primary text-sm"
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-app-surface border border-border rounded px-2 py-1.5 text-text-primary text-sm">
          {EVENT_TYPES.map(t => <option key={t} value={t}>{t === 'ALL' ? 'All Types' : t}</option>)}
        </select>
        <select value={cameraFilter} onChange={e => setCameraFilter(e.target.value)}
          className="bg-app-surface border border-border rounded px-2 py-1.5 text-text-primary text-sm">
          <option value="">All Cameras</option>
          {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={doSearch} disabled={loading}
          className="px-4 py-1.5 bg-brand-primary text-white rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Search
        </button>
      </div>

      {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded p-2">{error}</p>}

      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {events.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-24 text-text-muted">
            <Activity size={24} className="mb-1 opacity-40" />
            <p className="text-sm">Run a search to view events.</p>
          </div>
        )}
        {events.map((evt, i) => (
          <motion.div key={evt.id ?? i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.01 }}
            className="bg-app-panel border border-border rounded-lg p-3 flex items-start gap-3 hover:border-brand-primary/30 transition-colors">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${eventBadgeClass(evt.type ?? evt.eventType)}`}>
              {(evt.type ?? evt.eventType ?? 'EVENT').toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-text-primary text-sm font-medium">{evt.cameraId}</span>
                <span className="text-text-muted text-xs">{formatTs(evt.timestamp)}</span>
                {evt.confidence != null && <span className="text-text-secondary text-xs">{(evt.confidence * 100).toFixed(0)}% conf</span>}
              </div>
              {evt.description && <p className="text-text-secondary text-xs mt-0.5 truncate">{evt.description}</p>}
            </div>
            <button
              onClick={() => { setIncidentModal({ eventId: evt.id }); setSelectedIncidentId(''); setAddSuccess(''); }}
              className="flex items-center gap-1 text-xs text-text-secondary border border-border rounded px-2 py-1 hover:bg-app-surface transition-colors flex-shrink-0"
            >
              <Plus size={12} /> Add to Incident
            </button>
          </motion.div>
        ))}
      </div>

      {/* Incident Modal */}
      <AnimatePresence>
        {incidentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-app-panel border border-border rounded-xl p-5 w-80 flex flex-col gap-3 shadow-2xl">
              <div className="flex items-center justify-between">
                <p className="text-text-primary text-sm font-semibold">Add to Incident</p>
                <button onClick={() => setIncidentModal(null)} className="text-text-muted hover:text-text-primary"><X size={14} /></button>
              </div>
              <select value={selectedIncidentId} onChange={e => setSelectedIncidentId(e.target.value)}
                className="bg-app-surface border border-border rounded px-3 py-2 text-text-primary text-sm">
                <option value="">Select open incident…</option>
                {incidents.map(inc => (
                  <option key={inc.id} value={inc.id}>{inc.title ?? inc.id}</option>
                ))}
              </select>
              {addSuccess && <p className={`text-xs ${addSuccess.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>{addSuccess}</p>}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setIncidentModal(null)}
                  className="px-3 py-1.5 border border-border rounded text-text-secondary text-sm hover:bg-app-surface">Cancel</button>
                <button onClick={addToIncident} disabled={addingToIncident || !selectedIncidentId}
                  className="px-3 py-1.5 bg-brand-primary text-white rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1">
                  {addingToIncident ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'TIMELINE' | 'CROSS_CAMERA' | 'APPEARANCE' | 'IDENTITY' | 'EVENT_SEARCH';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'TIMELINE', label: 'Timeline', icon: <Clock size={14} /> },
  { id: 'CROSS_CAMERA', label: 'Cross-Camera', icon: <Layers size={14} /> },
  { id: 'APPEARANCE', label: 'Appearance', icon: <User size={14} /> },
  { id: 'IDENTITY', label: 'Identity', icon: <UserCheck size={14} /> },
  { id: 'EVENT_SEARCH', label: 'Event Search', icon: <Search size={14} /> },
];

export const SOCInvestigationCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('TIMELINE');

  return (
    <div className="flex flex-col h-full bg-app-primary gap-0">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-app-panel">
        <Search size={18} className="text-brand-primary" />
        <div>
          <h2 className="text-text-primary font-bold text-base">Investigation Center</h2>
          <p className="text-text-muted text-xs">Cross-camera forensic analysis & identity resolution</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex-shrink-0 flex gap-1 px-4 py-2 border-b border-border bg-app-panel overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-brand-primary text-white'
                : 'text-text-secondary hover:bg-app-surface hover:text-text-primary'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === 'TIMELINE' && <TimelineTab />}
            {activeTab === 'CROSS_CAMERA' && <CrossCameraTab />}
            {activeTab === 'APPEARANCE' && <AppearanceTab />}
            {activeTab === 'IDENTITY' && <IdentityTab />}
            {activeTab === 'EVENT_SEARCH' && <EventSearchTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
