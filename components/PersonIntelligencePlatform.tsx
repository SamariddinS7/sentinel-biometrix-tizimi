import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Activity, Clock, Users, Search, RefreshCw, User,
  AlertTriangle, Navigation, Camera, BarChart3, FileText,
  Download, Trash2, ScanFace, Bookmark, BookmarkX, ChevronRight,
  CheckCircle2, XCircle, Eye, MapPin, Layers, Network, Play,
  Loader2, PlusCircle, ShieldAlert, Info, LayoutList,
} from 'lucide-react';

import { PersonTimeline } from './PersonTimeline';
import { IdentityCard } from './IdentityCard';
import { PersonSearchModal } from './PersonSearchModal';
import { PersonNameLink, usePersonProfile } from '../context/PersonProfileContext';
import type {
  PersonProfile, PersonStatus, TimelineEntry, RelationshipObservation,
  MovementRecord, ReportType, ReportPeriod,
} from '../services/personIntel/types/PersonProfile';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SystemStats {
  totalProfiles: number;
  byStatus: Record<PersonStatus, number>;
  activeToday: number;
  watchlistCount: number;
  cacheSize?: number;
}

interface MovementJourney {
  cameraId: string;
  cameraName?: string;
  location?: string;
  enteredAt: string;
  exitedAt?: string;
  durationMs?: number;
}

interface EvidenceRecord {
  evidenceId: string;
  type: string;
  capturedAt: string;
  cameraId?: string;
  personId?: string;
  snapshotRef?: string;
  description?: string;
  isLocked?: boolean;
}

type ActiveTab =
  | 'OVERVIEW' | 'TIMELINE' | 'MOVEMENT' | 'ATTRIBUTES'
  | 'RELATIONSHIPS' | 'EVIDENCE' | 'INVESTIGATION' | 'REPORTS' | 'COMPLIANCE';

// ── Helpers ────────────────────────────────────────────────────────────────────

function relTime(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtDuration(ms?: number): string {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, opts);
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Request failed');
  return json.data as T;
}

const STATUS_COLOUR: Record<PersonStatus, string> = {
  KNOWN:     'text-teal-400',
  ANONYMOUS: 'text-gray-400',
  WATCHLIST: 'text-amber-400',
  BLOCKED:   'text-red-400',
  ARCHIVED:  'text-gray-600',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; accent?: string }> = ({
  label, value, sub, accent = 'text-white',
}) => (
  <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3">
    <div className={`text-xl font-bold ${accent}`}>{value}</div>
    <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    {sub && <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>}
  </div>
);

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; sub?: string }> = ({ icon, title, sub }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-teal-400">{icon}</span>
    <div>
      <div className="text-sm font-semibold text-white">{title}</div>
      {sub && <div className="text-[11px] text-gray-500">{sub}</div>}
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

export const PersonIntelligencePlatform: React.FC = () => {
  // ── State: list ────────────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState<PersonProfile[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listFilter, setListFilter] = useState<PersonStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── State: selected person ─────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<PersonProfile | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('OVERVIEW');
  const { openProfile } = usePersonProfile();
  const [profileLoading, setProfileLoading] = useState(false);

  // ── State: per-tab data ────────────────────────────────────────────────────
  const [movement, setMovement] = useState<{ replay: MovementJourney[]; journey: MovementJourney[] } | null>(null);
  const [relationships, setRelationships] = useState<RelationshipObservation[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [incidents, setIncidents] = useState<TimelineEntry[]>([]);
  const [personStats, setPersonStats] = useState<Record<string, unknown> | null>(null);
  const [tabLoading, setTabLoading] = useState(false);

  // ── State: investigation ───────────────────────────────────────────────────
  const [replayIndex, setReplayIndex] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── State: reports ─────────────────────────────────────────────────────────
  const [reportType, setReportType] = useState<ReportType>('MOVEMENT');
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('DAILY');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<unknown>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // ── State: compliance ─────────────────────────────────────────────────────
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [gdprConfirm, setGdprConfirm] = useState(false);
  const [gdprLoading, setGdprLoading] = useState(false);
  const [gdprDone, setGdprDone] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // ── Load profile list + stats ──────────────────────────────────────────────
  const loadList = useCallback(async (quiet = false) => {
    if (!quiet) setListLoading(true);
    else setIsRefreshing(true);
    try {
      const [profilesData, statsData] = await Promise.all([
        apiFetch<{ profiles: PersonProfile[] }>('/api/persons?limit=100'),
        apiFetch<SystemStats>('/api/persons/statistics/system').catch(() => null),
      ]);
      setProfiles(profilesData.profiles ?? (profilesData as any) ?? []);
      if (statsData) setSystemStats(statsData);
    } catch (e) {
      console.error('[PIP] Failed to load profiles:', e);
    } finally {
      setListLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // ── Load selected person full profile ──────────────────────────────────────
  const loadProfile = useCallback(async (id: string) => {
    setProfileLoading(true);
    setMovement(null); setRelationships([]); setEvidence([]); setIncidents([]);
    setPersonStats(null); setReplayIndex(0); setIsReplaying(false);
    try {
      const data = await apiFetch<{ profile: PersonProfile }>(`/api/persons/${id}`);
      setSelectedProfile(data.profile ?? data as any);
    } catch (e) {
      console.error('[PIP] Failed to load profile:', e);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const selectPerson = useCallback((id: string) => {
    setSelectedId(id);
    setActiveTab('OVERVIEW');
    setGdprConfirm(false); setGdprDone(false);
    loadProfile(id);
  }, [loadProfile]);

  // ── Load tab-specific data ─────────────────────────────────────────────────
  const loadTabData = useCallback(async (tab: ActiveTab, id: string) => {
    if (!id) return;
    setTabLoading(true);
    try {
      if (tab === 'MOVEMENT' || tab === 'INVESTIGATION') {
        const d = await apiFetch<{ replay: MovementJourney[]; journey: MovementJourney[] }>(`/api/persons/${id}/movement`);
        setMovement(d);
        setReplayIndex(0);
      }
      if (tab === 'RELATIONSHIPS') {
        const d = await apiFetch<{ observations: RelationshipObservation[] }>(`/api/persons/${id}/relationships`);
        setRelationships(d.observations ?? (d as any) ?? []);
      }
      if (tab === 'EVIDENCE') {
        const d = await apiFetch<{ evidence: EvidenceRecord[] }>(`/api/persons/${id}/evidence`);
        setEvidence(d.evidence ?? (d as any) ?? []);
      }
      if (tab === 'OVERVIEW') {
        const d = await apiFetch<{ incidents: TimelineEntry[] }>(`/api/persons/${id}/incidents?limit=5`);
        setIncidents(d.incidents ?? (d as any) ?? []);
        const s = await apiFetch<Record<string, unknown>>(`/api/persons/${id}/statistics`).catch(() => null);
        if (s) setPersonStats(s);
      }
    } catch (e) {
      console.error('[PIP] Tab data load error:', e);
    } finally {
      setTabLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId && activeTab) loadTabData(activeTab, selectedId);
  }, [activeTab, selectedId, loadTabData]);

  // ── Replay engine ──────────────────────────────────────────────────────────
  const startReplay = useCallback(() => {
    if (!movement?.replay?.length) return;
    setIsReplaying(true);
    setReplayIndex(0);
    const step = () => {
      setReplayIndex(i => {
        const next = i + 1;
        if (next >= (movement?.replay?.length ?? 0)) {
          setIsReplaying(false);
          return i;
        }
        replayTimer.current = setTimeout(step, 800);
        return next;
      });
    };
    replayTimer.current = setTimeout(step, 800);
  }, [movement]);

  useEffect(() => () => { if (replayTimer.current) clearTimeout(replayTimer.current); }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleWatchlist = useCallback(async (id: string) => {
    try {
      await fetch(`/api/persons/${id}/watchlist`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      await loadList(true);
      if (selectedId === id) await loadProfile(id);
    } catch (e) { console.error(e); }
  }, [selectedId, loadList, loadProfile]);

  const handleAddNote = useCallback(async () => {
    if (!selectedId || !noteText.trim()) return;
    setNoteLoading(true);
    try {
      await fetch(`/api/persons/${selectedId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText.trim() }),
      });
      setNoteText('');
    } catch (e) { console.error(e); }
    finally { setNoteLoading(false); }
  }, [selectedId, noteText]);

  const handleGdprErase = useCallback(async () => {
    if (!selectedId) return;
    setGdprLoading(true);
    try {
      await fetch(`/api/persons/${selectedId}`, { method: 'DELETE' });
      setGdprDone(true);
      setSelectedId(null); setSelectedProfile(null);
      await loadList(true);
    } catch (e) { console.error(e); }
    finally { setGdprLoading(false); }
  }, [selectedId, loadList]);

  const handleExport = useCallback(async () => {
    if (!selectedProfile) return;
    setExportLoading(true);
    try {
      const dossier = {
        exportedAt: new Date().toISOString(),
        profile: selectedProfile,
        movement: movement?.journey ?? [],
        relationships,
        evidence,
      };
      const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `dossier-${selectedProfile.personId}.json`; a.click();
      URL.revokeObjectURL(url);
    } finally { setExportLoading(false); }
  }, [selectedProfile, movement, relationships, evidence]);

  const handleGenerateReport = useCallback(async () => {
    if (!selectedId) return;
    setReportLoading(true); setReportData(null); setReportError(null);
    try {
      const data = await apiFetch<unknown>(`/api/persons/${selectedId}/report/${reportType}?period=${reportPeriod}`);
      setReportData(data);
    } catch (e: any) {
      setReportError(e.message);
    } finally { setReportLoading(false); }
  }, [selectedId, reportType, reportPeriod]);

  // ── Filtered profiles for sidebar ──────────────────────────────────────────
  const filteredProfiles = profiles.filter(p => {
    const matchStatus = listFilter === 'ALL' || p.status === listFilter;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q
      || (p.fullName ?? '').toLowerCase().includes(q)
      || p.personId.toLowerCase().includes(q)
      || (p.department ?? '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const TABS: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'OVERVIEW',       label: 'Overview',       icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'TIMELINE',       label: 'Timeline',        icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'MOVEMENT',       label: 'Movement',        icon: <Navigation className="w-3.5 h-3.5" /> },
    { id: 'ATTRIBUTES',     label: 'Appearance',      icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'RELATIONSHIPS',  label: 'Associations',    icon: <Network className="w-3.5 h-3.5" /> },
    { id: 'EVIDENCE',       label: 'Evidence',        icon: <Camera className="w-3.5 h-3.5" /> },
    { id: 'INVESTIGATION',  label: 'Investigate',     icon: <ScanFace className="w-3.5 h-3.5" /> },
    { id: 'REPORTS',        label: 'Reports',         icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'COMPLIANCE',     label: 'Compliance',      icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-gray-900 text-white overflow-hidden">

      {/* ── Left Sidebar: Profile Registry ───────────────────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-gray-700/50">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-700/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-400" />
              <span className="font-semibold text-sm">Person Registry</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowSearchModal(true)}
                className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Advanced search"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => loadList(true)}
                disabled={isRefreshing}
                className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* System stats row */}
          {systemStats && (
            <div className="grid grid-cols-3 gap-1 mb-3">
              <div className="bg-gray-800/60 rounded p-2 text-center">
                <div className="text-sm font-bold text-white">{systemStats.totalProfiles}</div>
                <div className="text-[9px] text-gray-500">Profiles</div>
              </div>
              <div className="bg-amber-500/10 rounded p-2 text-center">
                <div className="text-sm font-bold text-amber-400">{systemStats.watchlistCount ?? 0}</div>
                <div className="text-[9px] text-gray-500">Watchlist</div>
              </div>
              <div className="bg-teal-500/10 rounded p-2 text-center">
                <div className="text-sm font-bold text-teal-400">{systemStats.activeToday ?? 0}</div>
                <div className="text-[9px] text-gray-500">Today</div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter registry…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/60"
            />
          </div>

          {/* Status filter chips */}
          <div className="flex gap-1 flex-wrap">
            {(['ALL', 'KNOWN', 'ANONYMOUS', 'WATCHLIST', 'BLOCKED'] as const).map(s => (
              <button
                key={s}
                onClick={() => setListFilter(s)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  listFilter === s
                    ? 'bg-teal-500/20 border-teal-500/40 text-teal-400'
                    : 'border-gray-700 text-gray-500 hover:text-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Profile list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {listLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-gray-800/60 animate-pulse" />
            ))
          ) : filteredProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-600">
              <User className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">No profiles found</p>
            </div>
          ) : (
            filteredProfiles.map(p => (
              <IdentityCard
                key={p.personId}
                profile={p}
                compact
                selected={selectedId === p.personId}
                onSelect={() => selectPerson(p.personId)}
                onWatchlist={() => handleWatchlist(p.personId)}
                onViewProfile={() => openProfile(p.personId)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      {selectedId && selectedProfile ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Person header */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-700/50 bg-gray-900">
            {/* Avatar */}
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
              selectedProfile.status === 'WATCHLIST' ? 'bg-amber-700' :
              selectedProfile.status === 'BLOCKED'   ? 'bg-red-700' :
              selectedProfile.status === 'KNOWN'     ? 'bg-teal-700' : 'bg-gray-600'
            }`}>
              {(selectedProfile.fullName ?? selectedProfile.personId).charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white truncate">
                  <PersonNameLink
                    personId={selectedProfile.personId}
                    name={selectedProfile.fullName ?? `Anonymous #${selectedProfile.personId.slice(-6)}`}
                    className="text-lg font-bold text-white"
                  />
                </h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                  selectedProfile.status === 'KNOWN'     ? 'bg-teal-500/20 border-teal-500/40 text-teal-400' :
                  selectedProfile.status === 'WATCHLIST' ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' :
                  selectedProfile.status === 'BLOCKED'   ? 'bg-red-500/20 border-red-500/40 text-red-400' :
                  'bg-gray-700 border-gray-600 text-gray-300'
                }`}>{selectedProfile.status}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                <span className="font-mono">{selectedProfile.personId}</span>
                {selectedProfile.department && <span>· {selectedProfile.department}</span>}
                {selectedProfile.position && <span>· {selectedProfile.position}</span>}
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                {selectedProfile.lastCameraId && (
                  <span className="flex items-center gap-1">
                    <Camera className="w-3 h-3" /> {selectedProfile.lastCameraId}
                  </span>
                )}
                {selectedProfile.lastSeen && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {relTime(selectedProfile.lastSeen)}
                  </span>
                )}
              </div>
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => selectedId && openProfile(selectedId)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-cyan-600/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/20 transition-colors"
              >
                <LayoutList className="w-3.5 h-3.5" /> Profil
              </button>
              <button
                onClick={() => handleWatchlist(selectedId)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedProfile.status === 'WATCHLIST'
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-amber-400 hover:border-amber-500/40'
                }`}
              >
                {selectedProfile.status === 'WATCHLIST'
                  ? <><BookmarkX className="w-3.5 h-3.5" /> Remove Watch</>
                  : <><Bookmark className="w-3.5 h-3.5" /> Watchlist</>}
              </button>
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                {exportLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Export
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-0 px-6 border-b border-gray-700/50 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === t.id
                    ? 'border-teal-500 text-teal-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {profileLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >

                  {/* ── OVERVIEW ── */}
                  {activeTab === 'OVERVIEW' && (
                    <div className="space-y-6">
                      {/* Stats row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard label="Total Detections" value={selectedProfile.totalDetections ?? 0} accent="text-blue-400" />
                        <StatCard label="Recognitions" value={selectedProfile.totalRecognitions ?? 0} accent="text-teal-400" />
                        <StatCard label="Cameras Visited" value={selectedProfile.cameraHistory?.length ?? 0} accent="text-purple-400" />
                        <StatCard label="Recognition Rate" value={selectedProfile.totalDetections > 0 ? `${Math.round(((selectedProfile.totalRecognitions ?? 0) / selectedProfile.totalDetections) * 100)}%` : '—'} accent="text-green-400" />
                      </div>

                      {/* Personal stats from API */}
                      {personStats && (
                        <div>
                          <SectionTitle icon={<BarChart3 className="w-4 h-4" />} title="Behavioural Statistics" />
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Object.entries(personStats as Record<string, unknown>).slice(0, 6).map(([k, v]) => (
                              <StatCard key={k} label={k.replace(/([A-Z])/g, ' $1').trim()} value={String(v)} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recent camera visits */}
                      {selectedProfile.cameraHistory?.length > 0 && (
                        <div>
                          <SectionTitle icon={<Camera className="w-4 h-4" />} title="Camera History" sub="Most visited cameras" />
                          <div className="space-y-2">
                            {selectedProfile.cameraHistory.slice(0, 5).map(v => (
                              <div key={v.cameraId} className="flex items-center justify-between bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2">
                                <div>
                                  <div className="text-xs font-medium text-white">{v.cameraName || v.cameraId}</div>
                                  <div className="text-[11px] text-gray-500">{v.location}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-teal-400">{v.visitCount}×</div>
                                  <div className="text-[10px] text-gray-600">{fmtDuration(v.totalDurationMs)} total</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recent incidents */}
                      {incidents.length > 0 && (
                        <div>
                          <SectionTitle icon={<AlertTriangle className="w-4 h-4" />} title="Recent Incidents" />
                          <div className="space-y-2">
                            {incidents.map(inc => (
                              <div key={inc.entryId} className="flex items-start gap-3 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <div className="text-xs font-medium text-white">{inc.title}</div>
                                  <div className="text-[11px] text-gray-400">{inc.description}</div>
                                  <div className="text-[10px] text-gray-600 mt-0.5">{relTime(inc.timestamp)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {selectedProfile.notes && (
                        <div>
                          <SectionTitle icon={<Info className="w-4 h-4" />} title="Operator Notes" />
                          <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3 text-sm text-gray-300 leading-relaxed">
                            {selectedProfile.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── TIMELINE ── */}
                  {activeTab === 'TIMELINE' && (
                    <PersonTimeline personId={selectedId} maxHeight="calc(100vh - 260px)" showFilters />
                  )}

                  {/* ── MOVEMENT ── */}
                  {activeTab === 'MOVEMENT' && (
                    <div className="space-y-5">
                      <SectionTitle icon={<Navigation className="w-4 h-4" />} title="Cross-Camera Journey" sub="Chronological camera path" />
                      {tabLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-14 rounded-lg bg-gray-800 animate-pulse" />
                          ))}
                        </div>
                      ) : !movement?.journey?.length ? (
                        <div className="flex flex-col items-center py-12 text-gray-600">
                          <Navigation className="w-8 h-8 mb-2 opacity-30" />
                          <p className="text-sm">No movement records</p>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-700/50" />
                          {movement.journey.map((step, i) => (
                            <div key={i} className="flex gap-4 pb-4 relative">
                              <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold z-10 flex-shrink-0">
                                {i + 1}
                              </div>
                              <div className="flex-1 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="text-sm font-medium text-white">{step.cameraName || step.cameraId}</div>
                                    {step.location && <div className="text-[11px] text-gray-500 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {step.location}</div>}
                                  </div>
                                  <div className="text-right text-[11px] text-gray-500">
                                    <div>{relTime(step.enteredAt)}</div>
                                    <div className="text-gray-600">{fmtDuration(step.durationMs)}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── ATTRIBUTES / APPEARANCE ── */}
                  {activeTab === 'ATTRIBUTES' && (
                    <div className="space-y-5">
                      <SectionTitle icon={<Eye className="w-4 h-4" />} title="Appearance History" sub="AI-extracted visual attributes" />
                      {(selectedProfile.appearanceGallery?.length ?? 0) === 0 ? (
                        <div className="flex flex-col items-center py-12 text-gray-600">
                          <Eye className="w-8 h-8 mb-2 opacity-30" />
                          <p className="text-sm">No appearance records</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(selectedProfile.appearanceGallery ?? []).slice(0, 10).map(snap => (
                            <div key={snap.snapshotId} className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div className="text-xs text-gray-400">{snap.cameraId}</div>
                                <div className="text-[10px] text-gray-600">{relTime(snap.capturedAt)}</div>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                {[
                                  ['Upper', `${snap.upperClothingColor} ${snap.upperClothingType}`],
                                  ['Lower', `${snap.lowerClothingColor} ${snap.lowerClothingType}`],
                                  ['Shoes', snap.shoes],
                                  ['Build', snap.bodyShape],
                                  ['Height', snap.estimatedHeightCm ? `~${snap.estimatedHeightCm}cm` : '—'],
                                  ['Hair', snap.hairColor || '—'],
                                ].map(([label, val]) => (
                                  <div key={label} className="flex gap-2">
                                    <span className="text-gray-600 w-12 flex-shrink-0">{label}</span>
                                    <span className="text-gray-300 capitalize">{val || '—'}</span>
                                  </div>
                                ))}
                              </div>
                              {(snap.helmet || snap.vest || snap.backpack || snap.bag) && (
                                <div className="flex gap-1.5 mt-2 flex-wrap">
                                  {snap.helmet && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">Helmet</span>}
                                  {snap.vest && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">Safety Vest</span>}
                                  {snap.backpack && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Backpack</span>}
                                  {snap.bag && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Bag</span>}
                                </div>
                              )}
                              <div className="mt-2">
                                <div className="flex justify-between text-[10px] text-gray-600 mb-0.5"><span>Confidence</span><span>{(snap.confidence * 100).toFixed(0)}%</span></div>
                                <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${snap.confidence * 100}%` }} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── RELATIONSHIPS ── */}
                  {activeTab === 'RELATIONSHIPS' && (
                    <div className="space-y-5">
                      <SectionTitle icon={<Network className="w-4 h-4" />} title="Observed Associations" sub="Evidence-based correlations only — no inferred relationships" />
                      {tabLoading ? (
                        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-lg bg-gray-800 animate-pulse" />)}</div>
                      ) : relationships.length === 0 ? (
                        <div className="flex flex-col items-center py-12 text-gray-600">
                          <Network className="w-8 h-8 mb-2 opacity-30" />
                          <p className="text-sm">No associations detected yet</p>
                          <p className="text-[11px] mt-1 text-gray-700">Associations are computed nightly from ≥3 co-occurrences</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {relationships.map(rel => (
                            <div key={rel.observationId} className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="text-xs font-medium text-white">{rel.type.replace(/_/g, ' ')}</div>
                                  <div className="text-[11px] text-gray-400 mt-0.5">{rel.description}</div>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  rel.confidence >= 0.8 ? 'bg-teal-500/20 text-teal-400' :
                                  rel.confidence >= 0.6 ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-gray-700 text-gray-400'
                                }`}>{(rel.confidence * 100).toFixed(0)}% conf.</span>
                              </div>
                              <div className="flex gap-3 mt-2 text-[10px] text-gray-600">
                                <span>{rel.observationCount} observations</span>
                                <span>·</span>
                                <span>{rel.cameraIds?.length ?? 0} cameras</span>
                                <span>·</span>
                                <span>First: {relTime(rel.firstObservedAt)}</span>
                              </div>
                              <div className="mt-1.5 text-[10px] text-gray-700 italic">{rel.label}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── EVIDENCE ── */}
                  {activeTab === 'EVIDENCE' && (
                    <div className="space-y-5">
                      <SectionTitle icon={<Camera className="w-4 h-4" />} title="Evidence Records" sub="Snapshots, clips, and AI metadata" />
                      {tabLoading ? (
                        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-gray-800 animate-pulse" />)}</div>
                      ) : evidence.length === 0 ? (
                        <div className="flex flex-col items-center py-12 text-gray-600">
                          <Camera className="w-8 h-8 mb-2 opacity-30" />
                          <p className="text-sm">No evidence linked</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {evidence.map(ev => (
                            <div key={ev.evidenceId} className="flex items-center gap-3 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2.5">
                              <Camera className="w-4 h-4 text-blue-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-white truncate">{ev.type} — {ev.evidenceId}</div>
                                <div className="text-[11px] text-gray-500">{ev.cameraId} · {relTime(ev.capturedAt)}</div>
                                {ev.description && <div className="text-[11px] text-gray-400 mt-0.5 truncate">{ev.description}</div>}
                              </div>
                              {ev.isLocked && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded flex-shrink-0">LOCKED</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── INVESTIGATION ── */}
                  {activeTab === 'INVESTIGATION' && (
                    <div className="space-y-6">
                      {/* Movement Replay */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <SectionTitle icon={<Play className="w-4 h-4" />} title="Movement Replay" sub="Step through camera-to-camera path" />
                          {movement?.replay?.length ? (
                            <button
                              onClick={isReplaying ? () => { setIsReplaying(false); if (replayTimer.current) clearTimeout(replayTimer.current); } : startReplay}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                isReplaying
                                  ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                                  : 'bg-teal-500/20 border border-teal-500/40 text-teal-400 hover:bg-teal-500/30'
                              }`}
                            >
                              <Play className="w-3 h-3" /> {isReplaying ? 'Stop' : 'Play Replay'}
                            </button>
                          ) : null}
                        </div>

                        {tabLoading ? (
                          <div className="h-32 rounded-lg bg-gray-800 animate-pulse" />
                        ) : !movement?.replay?.length ? (
                          <div className="flex flex-col items-center py-10 text-gray-600 bg-gray-800/40 rounded-lg border border-gray-700/50">
                            <Navigation className="w-7 h-7 mb-2 opacity-30" />
                            <p className="text-sm">No replay data</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {/* Replay timeline */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {movement.replay.map((step, i) => (
                                <React.Fragment key={i}>
                                  <div
                                    onClick={() => setReplayIndex(i)}
                                    className={`flex flex-col items-center cursor-pointer p-2 rounded-lg border transition-all ${
                                      i === replayIndex
                                        ? 'bg-teal-500/20 border-teal-500/50 scale-105'
                                        : i < replayIndex
                                        ? 'bg-gray-700/50 border-gray-600 opacity-60'
                                        : 'bg-gray-800 border-gray-700 opacity-40'
                                    }`}
                                  >
                                    <Camera className="w-3 h-3 text-teal-400 mb-0.5" />
                                    <span className="text-[9px] text-gray-300 max-w-[60px] truncate">{step.cameraName || step.cameraId}</span>
                                    <span className="text-[8px] text-gray-600">{relTime(step.enteredAt)}</span>
                                  </div>
                                  {i < movement.replay.length - 1 && (
                                    <ChevronRight className={`w-3 h-3 ${i < replayIndex ? 'text-teal-500' : 'text-gray-700'}`} />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>

                            {/* Current step detail */}
                            {movement.replay[replayIndex] && (
                              <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4">
                                <div className="text-xs text-teal-400 font-medium mb-1">
                                  Step {replayIndex + 1} of {movement.replay.length}
                                </div>
                                <div className="text-sm font-semibold text-white">
                                  {movement.replay[replayIndex].cameraName || movement.replay[replayIndex].cameraId}
                                </div>
                                <div className="text-[11px] text-gray-400 mt-1">
                                  Entered: {new Date(movement.replay[replayIndex].enteredAt).toLocaleString()}
                                  {movement.replay[replayIndex].exitedAt && ` · Exited: ${new Date(movement.replay[replayIndex].exitedAt!).toLocaleString()}`}
                                  {movement.replay[replayIndex].durationMs && ` · Duration: ${fmtDuration(movement.replay[replayIndex].durationMs)}`}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Cross-search actions */}
                      <div>
                        <SectionTitle icon={<ScanFace className="w-4 h-4" />} title="Cross-Person Investigation" />
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => { setActiveTab('RELATIONSHIPS'); loadTabData('RELATIONSHIPS', selectedId); }}
                            className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700 hover:border-teal-500/40 text-left transition-colors"
                          >
                            <Network className="w-4 h-4 text-teal-400" />
                            <div>
                              <div className="text-xs font-medium text-white">View Associations</div>
                              <div className="text-[10px] text-gray-500">Co-occurrence analysis</div>
                            </div>
                          </button>
                          <button
                            onClick={() => { setActiveTab('EVIDENCE'); loadTabData('EVIDENCE', selectedId); }}
                            className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700 hover:border-blue-500/40 text-left transition-colors"
                          >
                            <Camera className="w-4 h-4 text-blue-400" />
                            <div>
                              <div className="text-xs font-medium text-white">Browse Evidence</div>
                              <div className="text-[10px] text-gray-500">Snapshots &amp; clips</div>
                            </div>
                          </button>
                          <button
                            onClick={() => setShowSearchModal(true)}
                            className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700 hover:border-purple-500/40 text-left transition-colors"
                          >
                            <Users className="w-4 h-4 text-purple-400" />
                            <div>
                              <div className="text-xs font-medium text-white">Similarity Search</div>
                              <div className="text-[10px] text-gray-500">Find related persons</div>
                            </div>
                          </button>
                          <button
                            onClick={() => setActiveTab('TIMELINE')}
                            className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700 hover:border-green-500/40 text-left transition-colors"
                          >
                            <Activity className="w-4 h-4 text-green-400" />
                            <div>
                              <div className="text-xs font-medium text-white">Full Timeline</div>
                              <div className="text-[10px] text-gray-500">All observed events</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── REPORTS ── */}
                  {activeTab === 'REPORTS' && (
                    <div className="space-y-5">
                      <SectionTitle icon={<FileText className="w-4 h-4" />} title="Generate Report" sub="Structured dossier from real AI observations" />
                      <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-400 mb-1.5 block">Report Type</label>
                            <select
                              value={reportType}
                              onChange={e => setReportType(e.target.value as ReportType)}
                              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/60"
                            >
                              {(['MOVEMENT', 'ATTENDANCE', 'VISIT', 'INCIDENT', 'INVESTIGATION', 'EVIDENCE', 'RECOGNITION', 'BEHAVIOR_SUMMARY'] as ReportType[]).map(t => (
                                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 mb-1.5 block">Period</label>
                            <select
                              value={reportPeriod}
                              onChange={e => setReportPeriod(e.target.value as ReportPeriod)}
                              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/60"
                            >
                              <option value="DAILY">Daily</option>
                              <option value="WEEKLY">Weekly</option>
                              <option value="MONTHLY">Monthly</option>
                            </select>
                          </div>
                        </div>
                        <button
                          onClick={handleGenerateReport}
                          disabled={reportLoading}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                          Generate {reportType.replace(/_/g, ' ')} Report
                        </button>
                      </div>

                      {reportError && (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                          <XCircle className="w-4 h-4 flex-shrink-0" /> {reportError}
                        </div>
                      )}

                      {reportData && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-medium text-teal-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Report generated
                            </div>
                            <button
                              onClick={() => {
                                const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = `report-${selectedId}-${reportType}.json`; a.click();
                                URL.revokeObjectURL(url);
                              }}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                            >
                              <Download className="w-3 h-3" /> Download JSON
                            </button>
                          </div>
                          <pre className="text-[11px] text-gray-300 bg-gray-800 border border-gray-700 rounded-lg p-4 overflow-auto max-h-96">
                            {JSON.stringify(reportData, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── COMPLIANCE ── */}
                  {activeTab === 'COMPLIANCE' && (
                    <div className="space-y-5">
                      {/* Add note */}
                      <div>
                        <SectionTitle icon={<PlusCircle className="w-4 h-4" />} title="Operator Notes" sub="Appended to timeline as OPERATOR_ACTION" />
                        <div className="flex gap-2">
                          <textarea
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Add an operator note…"
                            rows={2}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/60 resize-none"
                          />
                          <button
                            onClick={handleAddNote}
                            disabled={noteLoading || !noteText.trim()}
                            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm transition-colors disabled:opacity-40 flex-shrink-0"
                          >
                            {noteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                          </button>
                        </div>
                      </div>

                      {/* Export dossier */}
                      <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
                        <SectionTitle icon={<Download className="w-4 h-4" />} title="Export Dossier" sub="JSON export of full profile, movement, evidence" />
                        <button
                          onClick={handleExport}
                          disabled={exportLoading}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors disabled:opacity-40"
                        >
                          {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          Download Dossier
                        </button>
                      </div>

                      {/* GDPR Erasure */}
                      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                        <SectionTitle icon={<Trash2 className="w-4 h-4 text-red-400" />} title="GDPR Article 17 — Right to Erasure" />
                        {gdprDone ? (
                          <div className="flex items-center gap-2 text-sm text-green-400">
                            <CheckCircle2 className="w-4 h-4" /> Profile archived and biometric data scheduled for deletion.
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                              This will archive the profile and queue all biometric data (face descriptors, embeddings, appearance snapshots) for permanent deletion. This action is logged and irreversible.
                            </p>
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer mb-3">
                              <input
                                type="checkbox"
                                checked={gdprConfirm}
                                onChange={e => setGdprConfirm(e.target.checked)}
                                className="accent-red-500"
                              />
                              I confirm this erasure request is lawful and authorised.
                            </label>
                            <button
                              onClick={handleGdprErase}
                              disabled={!gdprConfirm || gdprLoading}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm transition-colors disabled:opacity-40"
                            >
                              {gdprLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              Execute Erasure
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      ) : (
        /* ── Empty state ── */
        <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
          <Shield className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium mb-1">No person selected</p>
          <p className="text-sm">Choose a profile from the registry or use search</p>
          <button
            onClick={() => setShowSearchModal(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm transition-colors"
          >
            <Search className="w-4 h-4" /> Open Search
          </button>
        </div>
      )}

      {/* ── Search Modal ─────────────────────────────────────────────────── */}
      <PersonSearchModal
        open={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelect={p => { selectPerson(p.personId); setShowSearchModal(false); }}
      />

    </div>
  );
};
