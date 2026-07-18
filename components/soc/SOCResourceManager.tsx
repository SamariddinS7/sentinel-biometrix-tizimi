import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Radio, MapPin, AlertCircle, CheckCircle2, Clock,
  RefreshCw, Send, X, Loader2, Shield, Navigation, UserCheck,
  Activity, ChevronDown, Camera, Layers, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authService } from '../../services/authService';

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffRole = 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'GUARD';
type StaffStatus = 'IDLE' | 'DISPATCHED' | 'ON_PATROL' | 'OFFLINE';

interface StaffMember {
  id: string;
  name?: string;
  fullName?: string;
  email?: string;
  role?: StaffRole | string;
  status?: StaffStatus | string;
  location?: string;
  department?: string;
  lastActive?: string;
  dispatchedAt?: string;
  incidentId?: string;
}

interface Incident {
  id: string;
  title?: string;
  status?: string;
}

interface CameraItem {
  id: string;
  name: string;
  location?: string;
  status?: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken?.() || '';
  return token ? { Authorization: 'Bearer ' + token } : {};
}

function formatTs(ts?: string) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function roleBadge(role?: string) {
  const map: Record<string, string> = {
    ADMIN: 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30',
    SUPERVISOR: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    OPERATOR: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    GUARD: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  };
  return map[(role ?? '').toUpperCase()] ?? 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
}

function statusBadge(status?: string) {
  const map: Record<string, string> = {
    IDLE: 'bg-gray-500/20 text-gray-400',
    DISPATCHED: 'bg-red-500/20 text-red-400 animate-pulse',
    ON_PATROL: 'bg-cyan-500/20 text-cyan-400',
    OFFLINE: 'bg-gray-700/30 text-gray-500',
  };
  return map[(status ?? '').toUpperCase()] ?? 'bg-gray-500/20 text-gray-400';
}

function staffDisplayName(s: StaffMember) {
  return s.name ?? s.fullName ?? s.email ?? s.id;
}

// ─── Dispatch Modal ───────────────────────────────────────────────────────────

interface DispatchModalProps {
  staff: StaffMember;
  incidents: Incident[];
  onClose: () => void;
  onDispatched: () => void;
}

const DispatchModal: React.FC<DispatchModalProps> = ({ staff, incidents, onClose, onDispatched }) => {
  const [location, setLocation] = useState(staff.location ?? '');
  const [incidentId, setIncidentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dispatch = async () => {
    if (!location.trim()) { setError('Location is required.'); return; }
    setLoading(true); setError('');
    try {
      const body: Record<string, any> = { location };
      if (incidentId) body.incidentId = incidentId;
      const r = await fetch(`/api/resources/staff/${staff.id}/dispatch`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) { onDispatched(); onClose(); }
      else { const d = await r.json().catch(() => ({})); setError(d.error ?? 'Dispatch failed.'); }
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="bg-app-panel border border-border rounded-xl p-5 w-80 flex flex-col gap-3 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="text-text-primary text-sm font-semibold flex items-center gap-2">
            <Send size={14} className="text-brand-primary" />
            Dispatch: {staffDisplayName(staff)}
          </p>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={14} /></button>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-text-muted text-xs">Location *</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="Enter dispatch location…"
            className="bg-app-surface border border-border rounded px-3 py-2 text-text-primary text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-text-muted text-xs">Link to Incident (optional)</label>
          <select value={incidentId} onChange={e => setIncidentId(e.target.value)}
            className="bg-app-surface border border-border rounded px-3 py-2 text-text-primary text-sm">
            <option value="">— No incident —</option>
            {incidents.map(inc => (
              <option key={inc.id} value={inc.id}>{inc.title ?? inc.id}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-3 py-1.5 border border-border rounded text-text-secondary text-sm hover:bg-app-surface">Cancel</button>
          <button onClick={dispatch} disabled={loading}
            className="px-3 py-1.5 bg-brand-primary text-white rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Dispatch
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Tab 1: Staff Overview ────────────────────────────────────────────────────

interface StaffOverviewProps {
  staff: StaffMember[];
  incidents: Incident[];
  loading: boolean;
  onRefresh: () => void;
  onStaffUpdate: () => void;
}

const StaffOverview: React.FC<StaffOverviewProps> = ({ staff, incidents, loading, onRefresh, onStaffUpdate }) => {
  const [dispatchTarget, setDispatchTarget] = useState<StaffMember | null>(null);
  const [recalling, setRecalling] = useState<string | null>(null);

  const total = staff.length;
  const dispatched = staff.filter(s => (s.status ?? '').toUpperCase() === 'DISPATCHED').length;
  const idle = staff.filter(s => (s.status ?? '').toUpperCase() === 'IDLE').length;
  const onPatrol = staff.filter(s => (s.status ?? '').toUpperCase() === 'ON_PATROL').length;

  const recall = async (id: string) => {
    setRecalling(id);
    try {
      await fetch(`/api/resources/staff/${id}/recall`, { method: 'POST', headers: getAuthHeaders() });
      onStaffUpdate();
    } catch {} finally { setRecalling(null); }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Staff', value: total, color: 'text-text-primary', bg: 'bg-app-panel' },
          { label: 'Dispatched', value: dispatched, color: 'text-red-400', bg: 'bg-red-500/5' },
          { label: 'Idle', value: idle, color: 'text-gray-400', bg: 'bg-gray-500/5' },
          { label: 'On Patrol', value: onPatrol, color: 'text-cyan-400', bg: 'bg-cyan-500/5' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} border border-border rounded-lg p-3 flex flex-col gap-1`}>
            <p className="text-text-muted text-xs">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Staff Directory</p>
        <button onClick={onRefresh} disabled={loading}
          className="flex items-center gap-1 text-text-muted text-xs hover:text-text-primary transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Staff Table */}
      <div className="flex-1 overflow-auto bg-app-panel border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-app-surface border-b border-border">
            <tr>
              {['Name', 'Role', 'Status', 'Location', 'Department', 'Last Active', 'Actions'].map(h => (
                <th key={h} className="text-left text-text-muted text-xs px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 && (
              <tr><td colSpan={7} className="text-center text-text-muted text-xs py-8">No staff data available.</td></tr>
            )}
            {staff.map((s, i) => (
              <motion.tr key={s.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="border-b border-border/50 hover:bg-app-surface/50 transition-colors">
                <td className="px-3 py-2 text-text-primary text-xs font-medium">{staffDisplayName(s)}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${roleBadge(s.role)}`}>
                    {(s.role ?? 'UNKNOWN').toUpperCase()}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBadge(s.status)}`}>
                    {(s.status ?? 'UNKNOWN').toUpperCase()}
                  </span>
                </td>
                <td className="px-3 py-2 text-text-secondary text-xs">{s.location ?? '—'}</td>
                <td className="px-3 py-2 text-text-secondary text-xs">{s.department ?? '—'}</td>
                <td className="px-3 py-2 text-text-muted text-xs">{formatTs(s.lastActive)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => setDispatchTarget(s)}
                      className="px-2 py-1 bg-brand-primary/20 text-brand-primary rounded text-xs font-semibold hover:bg-brand-primary/30 transition-colors flex items-center gap-1">
                      <Send size={10} /> Dispatch
                    </button>
                    {(s.status ?? '').toUpperCase() === 'DISPATCHED' && (
                      <button onClick={() => recall(s.id)} disabled={recalling === s.id}
                        className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs font-semibold hover:bg-gray-500/30 transition-colors flex items-center gap-1">
                        {recalling === s.id ? <Loader2 size={10} className="animate-spin" /> : <Navigation size={10} />}
                        Recall
                      </button>
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {dispatchTarget && (
          <DispatchModal
            staff={dispatchTarget}
            incidents={incidents}
            onClose={() => setDispatchTarget(null)}
            onDispatched={onStaffUpdate}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Tab 2: Dispatch Console ──────────────────────────────────────────────────

interface DispatchConsoleProps {
  staff: StaffMember[];
  incidents: Incident[];
  onStaffUpdate: () => void;
}

const DispatchConsole: React.FC<DispatchConsoleProps> = ({ staff, incidents, onStaffUpdate }) => {
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [location, setLocation] = useState('');
  const [incidentId, setIncidentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recalling, setRecalling] = useState<string | null>(null);

  const dispatchable = staff.filter(s => {
    const st = (s.status ?? '').toUpperCase();
    return st === 'IDLE' || st === 'ON_PATROL';
  });

  const dispatched = staff.filter(s => (s.status ?? '').toUpperCase() === 'DISPATCHED');

  const doDispatch = async () => {
    if (!selectedStaffId) { setError('Select a staff member.'); return; }
    if (!location.trim()) { setError('Enter a location.'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const body: Record<string, any> = { location };
      if (incidentId) body.incidentId = incidentId;
      const r = await fetch(`/api/resources/staff/${selectedStaffId}/dispatch`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setSuccess(`Staff dispatched to ${location}.`);
        setSelectedStaffId(''); setLocation(''); setIncidentId('');
        onStaffUpdate();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? 'Dispatch failed.');
      }
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  const recall = async (id: string) => {
    setRecalling(id);
    try {
      await fetch(`/api/resources/staff/${id}/recall`, { method: 'POST', headers: getAuthHeaders() });
      onStaffUpdate();
    } catch {} finally { setRecalling(null); }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Dispatch Form */}
      <div className="bg-app-panel border border-border rounded-lg p-4 flex flex-col gap-3">
        <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
          <Send size={12} /> Dispatch Console
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-text-muted text-xs">Staff Member</label>
            <select value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)}
              className="bg-app-surface border border-border rounded px-3 py-2 text-text-primary text-sm">
              <option value="">Select staff…</option>
              {dispatchable.map(s => (
                <option key={s.id} value={s.id}>
                  {staffDisplayName(s)} ({(s.status ?? '').toUpperCase()})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-text-muted text-xs">Location</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)}
              placeholder="Dispatch location…"
              className="bg-app-surface border border-border rounded px-3 py-2 text-text-primary text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-text-muted text-xs">Link to Incident (optional)</label>
            <select value={incidentId} onChange={e => setIncidentId(e.target.value)}
              className="bg-app-surface border border-border rounded px-3 py-2 text-text-primary text-sm">
              <option value="">— No incident —</option>
              {incidents.map(inc => <option key={inc.id} value={inc.id}>{inc.title ?? inc.id}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={doDispatch} disabled={loading}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Dispatch Now
          </button>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          {success && <p className="text-green-400 text-xs">{success}</p>}
        </div>
      </div>

      {/* Active Dispatches Table */}
      <div className="flex-1 flex flex-col gap-2">
        <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
          <Activity size={12} /> Active Dispatches ({dispatched.length})
        </p>
        <div className="flex-1 overflow-auto bg-app-panel border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-app-surface border-b border-border">
              <tr>
                {['Staff Member', 'Role', 'Location', 'Dispatched At', 'Linked Incident', 'Actions'].map(h => (
                  <th key={h} className="text-left text-text-muted text-xs px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dispatched.length === 0 && (
                <tr><td colSpan={6} className="text-center text-text-muted text-xs py-8">No active dispatches.</td></tr>
              )}
              {dispatched.map((s, i) => {
                const linkedInc = incidents.find(inc => inc.id === s.incidentId);
                return (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-app-surface/50 transition-colors">
                    <td className="px-3 py-2 text-text-primary text-xs font-medium">{staffDisplayName(s)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${roleBadge(s.role)}`}>{(s.role ?? '').toUpperCase()}</span>
                    </td>
                    <td className="px-3 py-2 text-text-secondary text-xs flex items-center gap-1">
                      <MapPin size={10} className="text-text-muted" />{s.location ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-text-muted text-xs">{formatTs(s.dispatchedAt)}</td>
                    <td className="px-3 py-2 text-text-secondary text-xs">{linkedInc ? (linkedInc.title ?? linkedInc.id) : '—'}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => recall(s.id)} disabled={recalling === s.id}
                        className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs font-semibold hover:bg-gray-500/30 transition-colors flex items-center gap-1">
                        {recalling === s.id ? <Loader2 size={10} className="animate-spin" /> : <Navigation size={10} />}
                        Recall
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Tab 3: Patrol Zones ──────────────────────────────────────────────────────

interface PatrolZonesProps {
  staff: StaffMember[];
}

const PatrolZones: React.FC<PatrolZonesProps> = ({ staff }) => {
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/cameras', { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then((d: any) => setCameras(Array.isArray(d) ? d : (d.cameras ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group cameras by location
  const zones = React.useMemo(() => {
    const map = new Map<string, CameraItem[]>();
    cameras.forEach(cam => {
      const zone = cam.location ?? 'Unknown Zone';
      if (!map.has(zone)) map.set(zone, []);
      map.get(zone)!.push(cam);
    });
    return [...map.entries()].map(([zoneName, cams]) => {
      const staffInZone = staff.filter(s =>
        s.location && s.location.toLowerCase().includes(zoneName.toLowerCase()) &&
        (s.status ?? '').toUpperCase() === 'DISPATCHED'
      );
      return { zoneName, cameras: cams, staffInZone, covered: staffInZone.length > 0 };
    });
  }, [cameras, staff]);

  const totalZones = zones.length;
  const coveredCount = zones.filter(z => z.covered).length;
  const uncoveredCount = totalZones - coveredCount;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Zone Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-app-panel border border-border rounded-lg p-3">
          <p className="text-text-muted text-xs">Total Zones</p>
          <p className="text-2xl font-bold text-text-primary">{totalZones}</p>
        </div>
        <div className="bg-green-500/5 border border-border rounded-lg p-3">
          <p className="text-text-muted text-xs">Covered</p>
          <p className="text-2xl font-bold text-green-400">{coveredCount}</p>
        </div>
        <div className="bg-red-500/5 border border-border rounded-lg p-3">
          <p className="text-text-muted text-xs">Uncovered</p>
          <p className="text-2xl font-bold text-red-400">{uncoveredCount}</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-24">
          <Loader2 size={20} className="animate-spin text-brand-primary" />
        </div>
      )}

      {/* Zone Cards */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3">
        {zones.length === 0 && !loading && (
          <div className="col-span-full flex flex-col items-center justify-center h-24 text-text-muted">
            <Layers size={24} className="mb-1 opacity-40" />
            <p className="text-sm">No patrol zones detected. Camera location data may be unavailable.</p>
          </div>
        )}
        {zones.map(zone => (
          <motion.div
            key={zone.zoneName}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-app-panel border rounded-lg p-4 flex flex-col gap-3 ${
              zone.covered ? 'border-green-500/30' : 'border-red-500/30'
            }`}
          >
            {/* Zone Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={14} className={zone.covered ? 'text-green-400' : 'text-red-400'} />
                <p className="text-text-primary text-sm font-semibold">{zone.zoneName}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                zone.covered
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {zone.covered ? '✓ COVERED' : '✗ UNCOVERED'}
              </span>
            </div>

            {/* Camera Count */}
            <div className="flex items-center gap-2 text-text-muted text-xs">
              <Camera size={12} />
              <span>{zone.cameras.length} camera{zone.cameras.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Camera List */}
            <div className="flex flex-col gap-1">
              {zone.cameras.map(cam => (
                <div key={cam.id} className="flex items-center gap-2 bg-app-surface rounded px-2 py-1">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    (cam.status ?? '').toUpperCase() === 'ONLINE' ? 'bg-green-400' :
                    (cam.status ?? '').toUpperCase() === 'OFFLINE' ? 'bg-red-400' : 'bg-yellow-400'
                  }`} />
                  <span className="text-text-secondary text-xs truncate">{cam.name}</span>
                  <span className="text-text-muted text-xs ml-auto">{cam.status ?? 'Unknown'}</span>
                </div>
              ))}
            </div>

            {/* Staff in Zone */}
            {zone.staffInZone.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-text-muted text-xs font-semibold flex items-center gap-1">
                  <Users size={10} /> Dispatched Staff
                </p>
                {zone.staffInZone.map(s => (
                  <div key={s.id} className="flex items-center gap-2 bg-green-500/5 rounded px-2 py-1">
                    <UserCheck size={10} className="text-green-400 flex-shrink-0" />
                    <span className="text-text-secondary text-xs">{staffDisplayName(s)}</span>
                    <span className={`ml-auto px-1.5 py-0.5 rounded text-xs ${roleBadge(s.role)}`}>{s.role}</span>
                  </div>
                ))}
              </div>
            )}

            {!zone.covered && (
              <div className="flex items-center gap-1 text-red-400 text-xs bg-red-500/5 rounded p-2">
                <AlertTriangle size={12} />
                No dispatched staff in this zone
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

type ResourceTab = 'STAFF' | 'DISPATCH' | 'PATROL';

const RESOURCE_TABS: { id: ResourceTab; label: string; icon: React.ReactNode }[] = [
  { id: 'STAFF', label: 'Staff Overview', icon: <Users size={14} /> },
  { id: 'DISPATCH', label: 'Dispatch Console', icon: <Send size={14} /> },
  { id: 'PATROL', label: 'Patrol Zones', icon: <MapPin size={14} /> },
];

export const SOCResourceManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ResourceTab>('STAFF');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const r = await fetch('/api/resources/staff', { headers });
      if (r.ok) {
        const d = await r.json();
        setStaff(Array.isArray(d) ? d : (d.staff ?? d.users ?? []));
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const fetchIncidents = useCallback(async () => {
    try {
      const r = await fetch('/api/incidents?status=OPEN&limit=20', { headers: getAuthHeaders() });
      if (r.ok) {
        const d = await r.json();
        setIncidents(Array.isArray(d) ? d : (d.incidents ?? []));
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchIncidents();
    refreshIntervalRef.current = setInterval(fetchStaff, 10000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [fetchStaff, fetchIncidents]);

  return (
    <div className="flex flex-col h-full bg-app-primary">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-app-panel">
        <Shield size={18} className="text-brand-primary" />
        <div>
          <h2 className="text-text-primary font-bold text-base">Resource Manager</h2>
          <p className="text-text-muted text-xs">Security staff dispatch, patrol monitoring & zone coverage</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
          <span className="text-text-muted text-xs">{loading ? 'Syncing…' : 'Live • Auto-refresh 10s'}</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex-shrink-0 flex gap-1 px-4 py-2 border-b border-border bg-app-panel overflow-x-auto">
        {RESOURCE_TABS.map(tab => (
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
            {activeTab === 'STAFF' && (
              <StaffOverview
                staff={staff}
                incidents={incidents}
                loading={loading}
                onRefresh={fetchStaff}
                onStaffUpdate={fetchStaff}
              />
            )}
            {activeTab === 'DISPATCH' && (
              <DispatchConsole
                staff={staff}
                incidents={incidents}
                onStaffUpdate={fetchStaff}
              />
            )}
            {activeTab === 'PATROL' && (
              <PatrolZones staff={staff} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
