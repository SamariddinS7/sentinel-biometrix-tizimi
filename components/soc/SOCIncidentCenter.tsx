import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Plus, Search, RefreshCw, ChevronRight, CheckCircle2,
  AlertTriangle, Clock, User, Users, MapPin, FileText, ListChecks,
  ClipboardList, FolderOpen, MessageSquare, Settings, Merge, Tag,
  Camera, X, Send, Check, Circle, CheckSquare, Square, Loader2,
  ArrowLeft, Filter, AlertCircle, Shield, Zap, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authService } from '../../services/authService';

// ─── Types ───────────────────────────────────────────────────────────────────

type IncidentCategory =
  | 'INTRUSION' | 'FIRE' | 'MEDICAL' | 'VEHICLE' | 'PPE_VIOLATION'
  | 'CROWD_INCIDENT' | 'THEFT' | 'VANDALISM' | 'LOITERING'
  | 'ABANDONED_OBJECT' | 'WEAPON' | 'OTHER';

type IncidentPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

interface IncidentNote {
  id: string;
  text: string;
  operator: string;
  timestamp: string;
  action: string;
}

interface IncidentTask {
  id: string;
  text: string;
  done: boolean;
  assignedTo?: string;
  doneAt?: string;
}

interface IncidentSopStep {
  id: string;
  text: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  assignedTeam?: string;
  associatedCameras: string[];
  evidenceIds: string[];
  alarmIds: string[];
  sopSteps: IncidentSopStep[];
  notes: IncidentNote[];
  tasks: IncidentTask[];
  closedAt?: string;
  resolution?: string;
  tags: string[];
  location?: string;
}

interface IncidentStats {
  total: number;
  open: number;
  investigating: number;
  critical: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<IncidentPriority, string> = {
  CRITICAL: 'border-red-500 bg-red-500/5',
  HIGH: 'border-orange-500 bg-orange-500/5',
  MEDIUM: 'border-amber-500 bg-amber-500/5',
  LOW: 'border-blue-500 bg-blue-500/5',
};

const PRIORITY_BADGE: Record<IncidentPriority, string> = {
  CRITICAL: 'bg-red-500/15 text-red-400 border border-red-500/30',
  HIGH: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  LOW: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
};

const STATUS_BADGE: Record<IncidentStatus, string> = {
  OPEN: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  INVESTIGATING: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  RESOLVED: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  CLOSED: 'bg-gray-500/15 text-gray-400 border border-gray-500/30',
};

const CATEGORY_BADGE: Record<IncidentCategory, string> = {
  INTRUSION: 'bg-red-500/10 text-red-400',
  FIRE: 'bg-orange-500/10 text-orange-400',
  MEDICAL: 'bg-pink-500/10 text-pink-400',
  VEHICLE: 'bg-blue-500/10 text-blue-400',
  PPE_VIOLATION: 'bg-amber-500/10 text-amber-400',
  CROWD_INCIDENT: 'bg-purple-500/10 text-purple-400',
  THEFT: 'bg-rose-500/10 text-rose-400',
  VANDALISM: 'bg-red-500/10 text-red-400',
  LOITERING: 'bg-yellow-500/10 text-yellow-400',
  ABANDONED_OBJECT: 'bg-orange-500/10 text-orange-400',
  WEAPON: 'bg-red-600/10 text-red-500',
  OTHER: 'bg-gray-500/10 text-gray-400',
};

const PRIORITY_LEFT_BORDER: Record<IncidentPriority, string> = {
  CRITICAL: 'border-l-red-500',
  HIGH: 'border-l-orange-500',
  MEDIUM: 'border-l-amber-500',
  LOW: 'border-l-blue-500',
};

const ALL_CATEGORIES: IncidentCategory[] = [
  'INTRUSION', 'FIRE', 'MEDICAL', 'VEHICLE', 'PPE_VIOLATION',
  'CROWD_INCIDENT', 'THEFT', 'VANDALISM', 'LOITERING',
  'ABANDONED_OBJECT', 'WEAPON', 'OTHER'
];

const ALL_PRIORITIES: IncidentPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const ALL_STATUSES: IncidentStatus[] = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'];

function authHeaders(): Record<string, string> {
  const token = authService.getToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}> = ({ label, value, icon, color }) => (
  <div className="bg-app-panel border border-border rounded-xl p-5 flex items-center justify-between">
    <div>
      <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">{label}</p>
      <h3 className="text-3xl font-extrabold text-text-primary mt-1">{value}</h3>
    </div>
    <div className={`p-3 rounded-xl ${color} flex items-center justify-center`}>
      {icon}
    </div>
  </div>
);

// ─── Detail Tabs ──────────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'sop' | 'tasks' | 'evidence' | 'notes' | 'actions';

const TAB_LIST: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <FileText size={14} /> },
  { id: 'sop', label: 'SOP', icon: <ListChecks size={14} /> },
  { id: 'tasks', label: 'Tasks', icon: <ClipboardList size={14} /> },
  { id: 'evidence', label: 'Evidence', icon: <FolderOpen size={14} /> },
  { id: 'notes', label: 'Notes', icon: <MessageSquare size={14} /> },
  { id: 'actions', label: 'Actions', icon: <Settings size={14} /> },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export const SOCIncidentCenter: React.FC = () => {
  // Stats
  const [stats, setStats] = useState<IncidentStats>({ total: 0, open: 0, investigating: 0, critical: 0 });

  // List state
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<IncidentPriority | 'ALL'>('ALL');

  // Detail state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // Mode: 'detail' | 'create'
  const [mode, setMode] = useState<'detail' | 'create'>('detail');

  // Create form
  const [createForm, setCreateForm] = useState({
    title: '', description: '', category: 'INTRUSION' as IncidentCategory,
    priority: 'MEDIUM' as IncidentPriority, assignedTeam: '', location: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // SOP / Tasks / Evidence / Notes / Actions inline state
  const [newTaskText, setNewTaskText] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newEvidenceId, setNewEvidenceId] = useState('');
  const [newStatus, setNewStatus] = useState<IncidentStatus>('INVESTIGATING');
  const [resolutionText, setResolutionText] = useState('');
  const [assignTeam, setAssignTeam] = useState('');
  const [assignOperator, setAssignOperator] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch stats ──────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/incidents/stats', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { /* silently ignore */ }
  }, []);

  // ── Fetch list ───────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/incidents?${params.toString()}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setIncidents(Array.isArray(data) ? data : (data.incidents ?? []));
      }
    } catch { /* ignore */ } finally {
      setLoadingList(false);
    }
  }, [statusFilter, priorityFilter, search]);

  // ── Fetch detail ─────────────────────────────────────────────────────────
  const fetchDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/incidents/${id}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setIncident(data);
      }
    } catch { /* ignore */ } finally {
      setLoadingDetail(false);
    }
  }, []);

  // ── Polling ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchStats();
    fetchList();
    const statsInterval = setInterval(fetchStats, 8000);
    const listInterval = setInterval(fetchList, 8000);
    return () => { clearInterval(statsInterval); clearInterval(listInterval); };
  }, [fetchStats, fetchList]);

  useEffect(() => {
    if (!selectedId) return;
    fetchDetail(selectedId);
    const interval = setInterval(() => fetchDetail(selectedId), 8000);
    return () => clearInterval(interval);
  }, [selectedId, fetchDetail]);

  // ── Select incident ──────────────────────────────────────────────────────
  const selectIncident = (id: string) => {
    setSelectedId(id);
    setMode('detail');
    setActiveTab('overview');
    setActionMsg('');
  };

  // ── Refresh after mutation ───────────────────────────────────────────────
  const refreshAll = useCallback(() => {
    fetchStats();
    fetchList();
    if (selectedId) fetchDetail(selectedId);
  }, [fetchStats, fetchList, fetchDetail, selectedId]);

  // ── Create incident ──────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createForm.title.trim()) { setCreateError('Title is required.'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        const created = await res.json();
        const newId = created.id ?? created._id;
        setCreateForm({ title: '', description: '', category: 'INTRUSION', priority: 'MEDIUM', assignedTeam: '', location: '' });
        setSelectedId(newId);
        setMode('detail');
        setActiveTab('overview');
        refreshAll();
      } else {
        const err = await res.json().catch(() => ({}));
        setCreateError(err.error ?? 'Failed to create incident.');
      }
    } catch (e: any) {
      setCreateError(e.message ?? 'Network error.');
    } finally {
      setCreating(false);
    }
  };

  // ── SOP toggle ───────────────────────────────────────────────────────────
  const toggleSopStep = async (stepId: string) => {
    if (!selectedId) return;
    try {
      await fetch(`/api/incidents/${selectedId}/sop/${stepId}/toggle`, {
        method: 'POST', headers: authHeaders(),
      });
      fetchDetail(selectedId);
    } catch { /* ignore */ }
  };

  // ── Task toggle ──────────────────────────────────────────────────────────
  const toggleTask = async (taskId: string) => {
    if (!selectedId) return;
    try {
      await fetch(`/api/incidents/${selectedId}/tasks/${taskId}/toggle`, {
        method: 'POST', headers: authHeaders(),
      });
      fetchDetail(selectedId);
    } catch { /* ignore */ }
  };

  // ── Add task ─────────────────────────────────────────────────────────────
  const addTask = async () => {
    if (!selectedId || !newTaskText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/incidents/${selectedId}/tasks`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ text: newTaskText }),
      });
      if (res.ok) { setNewTaskText(''); fetchDetail(selectedId); }
    } catch { /* ignore */ } finally { setSubmitting(false); }
  };

  // ── Add evidence ─────────────────────────────────────────────────────────
  const addEvidence = async () => {
    if (!selectedId || !newEvidenceId.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/incidents/${selectedId}/evidence`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ evidenceId: newEvidenceId }),
      });
      if (res.ok) { setNewEvidenceId(''); fetchDetail(selectedId); }
    } catch { /* ignore */ } finally { setSubmitting(false); }
  };

  // ── Add note ─────────────────────────────────────────────────────────────
  const addNote = async () => {
    if (!selectedId || !newNoteText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/incidents/${selectedId}/notes`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ text: newNoteText }),
      });
      if (res.ok) { setNewNoteText(''); fetchDetail(selectedId); }
    } catch { /* ignore */ } finally { setSubmitting(false); }
  };

  // ── Change status ────────────────────────────────────────────────────────
  const changeStatus = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setActionMsg('');
    try {
      const res = await fetch(`/api/incidents/${selectedId}/status`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ status: newStatus, resolution: resolutionText }),
      });
      if (res.ok) { setActionMsg('Status updated successfully.'); refreshAll(); }
      else { const e = await res.json().catch(() => ({})); setActionMsg(e.error ?? 'Failed to update status.'); }
    } catch { setActionMsg('Network error.'); } finally { setSubmitting(false); }
  };

  // ── Assign ───────────────────────────────────────────────────────────────
  const assignIncident = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setActionMsg('');
    try {
      const res = await fetch(`/api/incidents/${selectedId}/assign`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ team: assignTeam, operator: assignOperator }),
      });
      if (res.ok) { setActionMsg('Assigned successfully.'); setAssignTeam(''); setAssignOperator(''); refreshAll(); }
      else { const e = await res.json().catch(() => ({})); setActionMsg(e.error ?? 'Failed to assign.'); }
    } catch { setActionMsg('Network error.'); } finally { setSubmitting(false); }
  };

  // ── Merge ────────────────────────────────────────────────────────────────
  const mergeIncident = async () => {
    if (!selectedId || !mergeTargetId.trim()) return;
    setSubmitting(true);
    setActionMsg('');
    try {
      const res = await fetch('/api/incidents/merge', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ sourceId: selectedId, targetId: mergeTargetId }),
      });
      if (res.ok) { setActionMsg('Merged successfully.'); setMergeTargetId(''); refreshAll(); }
      else { const e = await res.json().catch(() => ({})); setActionMsg(e.error ?? 'Failed to merge.'); }
    } catch { setActionMsg('Network error.'); } finally { setSubmitting(false); }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = incidents.filter(inc => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!inc.title.toLowerCase().includes(q) && !inc.id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-5 min-h-0">

      {/* TOP STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <StatCard label="Total Incidents" value={stats.total}
          icon={<Shield size={22} className="text-brand-primary" />}
          color="bg-brand-primary/10 border border-brand-primary/20" />
        <StatCard label="Open" value={stats.open}
          icon={<AlertCircle size={22} className="text-rose-500" />}
          color="bg-rose-500/10 border border-rose-500/20" />
        <StatCard label="Investigating" value={stats.investigating}
          icon={<Activity size={22} className="text-sky-500" />}
          color="bg-sky-500/10 border border-sky-500/20" />
        <StatCard label="Critical" value={stats.critical}
          icon={<Zap size={22} className="text-red-500" />}
          color="bg-red-500/10 border border-red-500/20" />
      </div>

      {/* MAIN LAYOUT */}
      <div className="flex flex-1 gap-5 min-h-0 overflow-hidden">

        {/* LEFT PANEL */}
        <div className="w-80 shrink-0 flex flex-col bg-app-panel border border-border rounded-xl overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-border shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search incidents..."
                className="w-full bg-app-primary border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-text-primary focus:border-brand-primary outline-none"
              />
            </div>
          </div>

          {/* Status filter tabs */}
          <div className="flex shrink-0 border-b border-border overflow-x-auto">
            {(['ALL', ...ALL_STATUSES] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 text-[10px] font-bold whitespace-nowrap border-b-2 transition-all ${
                  statusFilter === s
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Priority filter */}
          <div className="p-2 border-b border-border shrink-0 flex gap-1 flex-wrap">
            {(['ALL', ...ALL_PRIORITIES] as const).map(p => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                  priorityFilter === p
                    ? 'bg-brand-primary text-white'
                    : 'bg-app-primary border border-border text-text-muted hover:text-text-primary'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Incident list */}
          <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1.5">
            {loadingList && filtered.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-text-muted">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-text-muted">
                <ShieldAlert size={28} className="mb-2 opacity-40" />
                <p className="text-xs">No incidents found</p>
              </div>
            ) : (
              filtered.map(inc => (
                <motion.div
                  key={inc.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => selectIncident(inc.id)}
                  className={`cursor-pointer bg-app-primary border border-l-4 ${PRIORITY_LEFT_BORDER[inc.priority]} border-border rounded-lg p-2.5 hover:border-brand-primary/40 transition-all ${
                    selectedId === inc.id ? 'ring-1 ring-brand-primary/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="font-mono text-[10px] text-text-muted">{inc.id}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${STATUS_BADGE[inc.status]}`}>
                      {inc.status}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-text-primary leading-tight mb-1.5 line-clamp-2">{inc.title}</p>
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_BADGE[inc.category]}`}>
                      {inc.category.replace('_', ' ')}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${PRIORITY_BADGE[inc.priority]}`}>
                      {inc.priority}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[9px] text-text-muted">
                    <span className="flex items-center gap-0.5"><Clock size={9} />{fmt(inc.createdAt)}</span>
                    {inc.assignedTeam && <span className="flex items-center gap-0.5 truncate max-w-[80px]"><Users size={9} />{inc.assignedTeam}</span>}
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* New Incident button */}
          <div className="p-3 border-t border-border shrink-0">
            <button
              onClick={() => { setMode('create'); setSelectedId(null); setIncident(null); }}
              className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold py-2.5 rounded-lg transition-all active:scale-95"
            >
              <Plus size={14} /> New Incident
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 min-w-0 flex flex-col bg-app-panel border border-border rounded-xl overflow-hidden">
          <AnimatePresence mode="wait">

            {/* ── CREATE FORM ───────────────────────────────────────────── */}
            {mode === 'create' && (
              <motion.div
                key="create"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
                  <button onClick={() => setMode('detail')} className="p-1.5 hover:bg-app-surface rounded-lg text-text-muted hover:text-text-primary transition-colors">
                    <ArrowLeft size={16} />
                  </button>
                  <h3 className="font-bold text-sm text-text-primary">Create New Incident</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Title <span className="text-red-400">*</span></label>
                    <input
                      value={createForm.title}
                      onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Incident title..."
                      className="w-full bg-app-primary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-primary outline-none"
                    />
                  </div>
                  {/* Description */}
                  <div>
                    <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Description</label>
                    <textarea
                      value={createForm.description}
                      onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                      rows={4}
                      placeholder="Describe the incident..."
                      className="w-full bg-app-primary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-primary outline-none resize-none"
                    />
                  </div>
                  {/* Category & Priority */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Category</label>
                      <select
                        value={createForm.category}
                        onChange={e => setCreateForm(f => ({ ...f, category: e.target.value as IncidentCategory }))}
                        className="w-full bg-app-primary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-primary outline-none"
                      >
                        {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Priority</label>
                      <select
                        value={createForm.priority}
                        onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value as IncidentPriority }))}
                        className="w-full bg-app-primary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-primary outline-none"
                      >
                        {ALL_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Assigned Team & Location */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Assigned Team</label>
                      <input
                        value={createForm.assignedTeam}
                        onChange={e => setCreateForm(f => ({ ...f, assignedTeam: e.target.value }))}
                        placeholder="Team name..."
                        className="w-full bg-app-primary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Location</label>
                      <input
                        value={createForm.location}
                        onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))}
                        placeholder="Sector / zone..."
                        className="w-full bg-app-primary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-primary outline-none"
                      />
                    </div>
                  </div>
                  {createError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">{createError}</div>
                  )}
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {creating ? 'Creating...' : 'Create Incident'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── NO SELECTION ──────────────────────────────────────────── */}
            {mode === 'detail' && !selectedId && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center text-text-muted p-10"
              >
                <ShieldAlert size={48} className="opacity-20 mb-3" />
                <p className="text-sm font-semibold">No incident selected</p>
                <p className="text-xs text-center mt-1 text-text-muted">
                  Select an incident from the list, or create a new one.
                </p>
              </motion.div>
            )}

            {/* ── LOADING DETAIL ────────────────────────────────────────── */}
            {mode === 'detail' && selectedId && loadingDetail && !incident && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex items-center justify-center text-text-muted"
              >
                <Loader2 size={24} className="animate-spin" />
              </motion.div>
            )}

            {/* ── DETAIL VIEW ───────────────────────────────────────────── */}
            {mode === 'detail' && selectedId && incident && (
              <motion.div
                key={`detail-${incident.id}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                {/* Detail Header */}
                <div className="p-4 border-b border-border shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] text-text-muted bg-app-primary border border-border px-2 py-0.5 rounded">{incident.id}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${PRIORITY_BADGE[incident.priority]}`}>{incident.priority}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_BADGE[incident.status]}`}>{incident.status}</span>
                      </div>
                      <h2 className="font-bold text-sm text-text-primary leading-tight line-clamp-2">{incident.title}</h2>
                    </div>
                    <button
                      onClick={() => { if (selectedId) fetchDetail(selectedId); fetchList(); fetchStats(); }}
                      className="p-1.5 hover:bg-app-surface rounded-lg text-text-muted hover:text-text-primary transition-colors shrink-0"
                    >
                      <RefreshCw size={14} className={loadingDetail ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                {/* Detail Tabs */}
                <div className="flex border-b border-border shrink-0 overflow-x-auto">
                  {TAB_LIST.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold whitespace-nowrap border-b-2 transition-all ${
                        activeTab === tab.id
                          ? 'border-brand-primary text-brand-primary'
                          : 'border-transparent text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      {tab.icon}{tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto min-h-0 p-4">
                  <AnimatePresence mode="wait">

                    {/* OVERVIEW */}
                    {activeTab === 'overview' && (
                      <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Category', value: incident.category.replace(/_/g, ' ') },
                            { label: 'Priority', value: incident.priority },
                            { label: 'Status', value: incident.status },
                            { label: 'Created By', value: incident.createdBy },
                            { label: 'Created At', value: fmt(incident.createdAt) },
                            { label: 'Updated At', value: fmt(incident.updatedAt) },
                            { label: 'Assigned Team', value: incident.assignedTeam ?? '—' },
                            { label: 'Location', value: incident.location ?? '—' },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-app-primary border border-border rounded-xl p-3">
                              <p className="text-[9px] font-bold uppercase text-text-muted mb-0.5">{label}</p>
                              <p className="text-xs font-semibold text-text-primary">{value}</p>
                            </div>
                          ))}
                        </div>
                        {incident.description && (
                          <div className="bg-app-primary border border-border rounded-xl p-3">
                            <p className="text-[9px] font-bold uppercase text-text-muted mb-1">Description</p>
                            <p className="text-xs text-text-secondary leading-relaxed">{incident.description}</p>
                          </div>
                        )}
                        {incident.associatedCameras.length > 0 && (
                          <div className="bg-app-primary border border-border rounded-xl p-3">
                            <p className="text-[9px] font-bold uppercase text-text-muted mb-2">Associated Cameras</p>
                            <div className="flex flex-wrap gap-1.5">
                              {incident.associatedCameras.map(cam => (
                                <span key={cam} className="flex items-center gap-1 text-[10px] bg-app-surface border border-border px-2 py-0.5 rounded font-mono text-text-secondary">
                                  <Camera size={10} />{cam}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {incident.tags.length > 0 && (
                          <div className="bg-app-primary border border-border rounded-xl p-3">
                            <p className="text-[9px] font-bold uppercase text-text-muted mb-2">Tags</p>
                            <div className="flex flex-wrap gap-1.5">
                              {incident.tags.map(tag => (
                                <span key={tag} className="flex items-center gap-1 text-[10px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-2 py-0.5 rounded">
                                  <Tag size={10} />{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {incident.resolution && (
                          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                            <p className="text-[9px] font-bold uppercase text-emerald-400 mb-1">Resolution</p>
                            <p className="text-xs text-text-secondary leading-relaxed">{incident.resolution}</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* SOP */}
                    {activeTab === 'sop' && (
                      <motion.div key="sop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                        {incident.sopSteps.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-32 text-text-muted">
                            <ListChecks size={28} className="mb-2 opacity-40" />
                            <p className="text-xs">No SOP steps defined</p>
                          </div>
                        ) : (
                          incident.sopSteps.map((step, i) => (
                            <div
                              key={step.id}
                              className={`bg-app-primary border border-border rounded-xl p-3 flex gap-3 items-start transition-all ${step.completed ? 'opacity-75' : ''}`}
                            >
                              <button
                                onClick={() => toggleSopStep(step.id)}
                                className={`shrink-0 mt-0.5 rounded-full transition-colors ${step.completed ? 'text-emerald-400' : 'text-text-muted hover:text-brand-primary'}`}
                              >
                                {step.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold ${step.completed ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                                  <span className="text-text-muted font-mono mr-1.5">{String(i + 1).padStart(2, '0')}.</span>
                                  {step.text}
                                </p>
                                {step.completed && (step.completedBy || step.completedAt) && (
                                  <p className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1">
                                    <CheckCircle2 size={10} />
                                    {step.completedBy && <span>{step.completedBy}</span>}
                                    {step.completedAt && <span>· {fmt(step.completedAt)}</span>}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </motion.div>
                    )}

                    {/* TASKS */}
                    {activeTab === 'tasks' && (
                      <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                        {incident.tasks.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-24 text-text-muted">
                            <ClipboardList size={24} className="mb-2 opacity-40" />
                            <p className="text-xs">No tasks yet</p>
                          </div>
                        ) : (
                          incident.tasks.map(task => (
                            <div key={task.id} className={`bg-app-primary border border-border rounded-xl p-3 flex gap-3 items-start ${task.done ? 'opacity-70' : ''}`}>
                              <button
                                onClick={() => toggleTask(task.id)}
                                className={`shrink-0 mt-0.5 transition-colors ${task.done ? 'text-emerald-400' : 'text-text-muted hover:text-brand-primary'}`}
                              >
                                {task.done ? <CheckSquare size={16} /> : <Square size={16} />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs ${task.done ? 'line-through text-text-muted' : 'text-text-primary font-medium'}`}>{task.text}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-muted">
                                  {task.assignedTo && <span className="flex items-center gap-0.5"><User size={9} />{task.assignedTo}</span>}
                                  {task.done && task.doneAt && <span className="flex items-center gap-0.5 text-emerald-400"><CheckCircle2 size={9} />{fmt(task.doneAt)}</span>}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                        {/* Add task */}
                        <div className="flex gap-2 pt-2">
                          <input
                            value={newTaskText}
                            onChange={e => setNewTaskText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addTask(); }}
                            placeholder="New task..."
                            className="flex-1 bg-app-primary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-primary outline-none"
                          />
                          <button
                            onClick={addTask}
                            disabled={submitting || !newTaskText.trim()}
                            className="px-3 py-2 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* EVIDENCE */}
                    {activeTab === 'evidence' && (
                      <motion.div key="evidence" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                        {incident.evidenceIds.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-24 text-text-muted">
                            <FolderOpen size={24} className="mb-2 opacity-40" />
                            <p className="text-xs">No evidence linked</p>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {incident.evidenceIds.map(eid => (
                              <span key={eid} className="font-mono text-[10px] bg-app-primary border border-border text-text-secondary px-2.5 py-1 rounded-lg flex items-center gap-1">
                                <FolderOpen size={10} />{eid}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Add evidence */}
                        <div className="flex gap-2 pt-2">
                          <input
                            value={newEvidenceId}
                            onChange={e => setNewEvidenceId(e.target.value)}
                            placeholder="Evidence ID (e.g. EVD-...)..."
                            className="flex-1 bg-app-primary border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:border-brand-primary outline-none"
                          />
                          <button
                            onClick={addEvidence}
                            disabled={submitting || !newEvidenceId.trim()}
                            className="px-3 py-2 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* NOTES */}
                    {activeTab === 'notes' && (
                      <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                        {incident.notes.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-24 text-text-muted">
                            <MessageSquare size={24} className="mb-2 opacity-40" />
                            <p className="text-xs">No notes yet</p>
                          </div>
                        ) : (
                          incident.notes.map(note => (
                            <div key={note.id} className="bg-app-primary border border-border rounded-xl p-3 relative">
                              <span className="absolute top-2 right-2 text-[8px] font-bold uppercase tracking-widest text-brand-primary/60 bg-brand-primary/10 px-1.5 py-0.5 rounded">
                                {note.action}
                              </span>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-text-primary flex items-center gap-1"><User size={10} className="text-brand-primary" />{note.operator}</span>
                                <span className="text-[9px] font-mono text-text-muted">{fmt(note.timestamp)}</span>
                              </div>
                              <p className="text-xs text-text-secondary leading-relaxed pr-16">{note.text}</p>
                            </div>
                          ))
                        )}
                        {/* Add note */}
                        <div className="space-y-2 pt-2">
                          <textarea
                            value={newNoteText}
                            onChange={e => setNewNoteText(e.target.value)}
                            rows={3}
                            placeholder="Write a note..."
                            className="w-full bg-app-primary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-primary outline-none resize-none"
                          />
                          <button
                            onClick={addNote}
                            disabled={submitting || !newNoteText.trim()}
                            className="flex items-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                          >
                            <Send size={12} /> Add Note
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* ACTIONS */}
                    {activeTab === 'actions' && (
                      <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                        {actionMsg && (
                          <div className={`text-xs px-3 py-2 rounded-lg border ${actionMsg.includes('success') || actionMsg.includes('Success') ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                            {actionMsg}
                          </div>
                        )}

                        {/* Change Status */}
                        <div className="bg-app-primary border border-border rounded-xl p-4 space-y-3">
                          <h4 className="text-xs font-bold text-text-primary flex items-center gap-2"><Settings size={14} className="text-brand-primary" />Change Status</h4>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">New Status</label>
                            <select
                              value={newStatus}
                              onChange={e => setNewStatus(e.target.value as IncidentStatus)}
                              className="w-full bg-app-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-primary outline-none"
                            >
                              {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Resolution Notes (optional)</label>
                            <textarea
                              value={resolutionText}
                              onChange={e => setResolutionText(e.target.value)}
                              rows={2}
                              placeholder="Optional resolution details..."
                              className="w-full bg-app-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-primary outline-none resize-none"
                            />
                          </div>
                          <button
                            onClick={changeStatus}
                            disabled={submitting}
                            className="flex items-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                          >
                            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Apply Status Change
                          </button>
                        </div>

                        {/* Assign */}
                        <div className="bg-app-primary border border-border rounded-xl p-4 space-y-3">
                          <h4 className="text-xs font-bold text-text-primary flex items-center gap-2"><Users size={14} className="text-brand-primary" />Assign Incident</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Team</label>
                              <input
                                value={assignTeam}
                                onChange={e => setAssignTeam(e.target.value)}
                                placeholder="Team name..."
                                className="w-full bg-app-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-primary outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Operator</label>
                              <input
                                value={assignOperator}
                                onChange={e => setAssignOperator(e.target.value)}
                                placeholder="Operator name..."
                                className="w-full bg-app-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-brand-primary outline-none"
                              />
                            </div>
                          </div>
                          <button
                            onClick={assignIncident}
                            disabled={submitting}
                            className="flex items-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                          >
                            {submitting ? <Loader2 size={12} className="animate-spin" /> : <User size={12} />}
                            Assign
                          </button>
                        </div>

                        {/* Merge */}
                        <div className="bg-app-primary border border-border rounded-xl p-4 space-y-3">
                          <h4 className="text-xs font-bold text-text-primary flex items-center gap-2"><Merge size={14} className="text-brand-primary" />Merge Into Incident</h4>
                          <p className="text-[10px] text-text-muted">Merge this incident into another. The current incident will be linked and closed.</p>
                          <div className="flex gap-2">
                            <input
                              value={mergeTargetId}
                              onChange={e => setMergeTargetId(e.target.value)}
                              placeholder="Target Incident ID..."
                              className="flex-1 bg-app-surface border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:border-brand-primary outline-none"
                            />
                            <button
                              onClick={mergeIncident}
                              disabled={submitting || !mergeTargetId.trim()}
                              className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                            >
                              <Merge size={12} /> Merge
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
