/**
 * LivePersonsMonitor
 *
 * Kameralarda ko'ringan har bir inson uchun real-vaqt profil kartalar paneli.
 * - /api/ai/persons/live-profiles dan har 5 soniyada ma'lumot yangilaydi
 * - Har bir shaxs uchun to'liq profil kartasi ko'rsatadi
 * - AI Copilot bilan to'liq integratsiya
 * - Watchlist, izoh, tekshiruv amallarini bajaradi
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  User, Camera, Clock, Eye, ShieldAlert, ShieldCheck, ShieldOff,
  Search, RefreshCw, Users, Activity, BrainCircuit, MessageSquare,
  Shirt, Package, HardHat, Loader2, MapPin, Fingerprint,
  ChevronRight, X, StickyNote, AlertTriangle, CheckCircle2,
  Radio, Filter, TrendingUp, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePersonProfile } from '../context/PersonProfileContext';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LivePersonProfile {
  personId: string;
  fusionId?: string;
  fullName: string;
  status: 'KNOWN' | 'ANONYMOUS' | 'WATCHLIST' | 'BLOCKED' | 'ARCHIVED';
  role?: string;
  currentlyPresent: boolean;
  lastSeen: string;
  firstSeen?: string;
  lastCameraId?: string;
  lastCameraName?: string;
  totalDetections: number;
  cameraHistory?: Array<{ cameraId: string; cameraName?: string; visitCount: number; lastSeenAt: string }>;
  currentAppearance?: {
    upperClothingColor?: string;
    lowerClothingColor?: string;
    upperClothingType?: string;
    bodySize?: string;
    bodyShape?: string;
    helmet?: boolean;
    vest?: boolean;
    backpack?: boolean;
    glasses?: boolean;
    mask?: boolean;
    hairColor?: string;
    estimatedHeightCm?: number;
  };
  confidence?: number;
  notes?: string;
}

type StatusFilter = 'ALL' | 'KNOWN' | 'ANONYMOUS' | 'WATCHLIST';

// ─── Colour helpers ────────────────────────────────────────────────────────────

const COLOR_HEX: Record<string, string> = {
  'Red': '#ef4444', 'Dark Red': '#991b1b', 'Orange': '#f97316', 'Yellow': '#eab308',
  'Green': '#22c55e', 'Dark Green': '#15803d', 'Cyan': '#06b6d4', 'Blue': '#3b82f6',
  'Dark Blue': '#1d4ed8', 'Navy': '#1e3a5f', 'Purple': '#a855f7', 'Pink': '#ec4899',
  'Brown': '#92400e', 'Black': '#1e293b', 'Dark Gray': '#374151', 'Gray': '#6b7280',
  'Light Gray': '#d1d5db', 'White': '#f1f5f9', 'Beige': '#e8d5b7', 'Unknown': '#475569',
};
const colorHex = (n?: string) => n ? (COLOR_HEX[n] ?? COLOR_HEX['Unknown']) : COLOR_HEX['Unknown'];

const STATUS_CFG = {
  KNOWN:     { label: "Ma'lum",      color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30', avatar: 'bg-emerald-500/20 border-emerald-500/40', icon: ShieldCheck },
  ANONYMOUS: { label: "Noma'lum",   color: 'text-slate-400 bg-slate-500/15 border-slate-500/30',       avatar: 'bg-slate-500/20 border-slate-500/30',    icon: User },
  WATCHLIST: { label: 'Kuzatuvda',  color: 'text-amber-400 bg-amber-500/15 border-amber-500/30',       avatar: 'bg-amber-500/20 border-amber-500/40',    icon: ShieldAlert },
  BLOCKED:   { label: 'Bloklangan', color: 'text-rose-400 bg-rose-500/15 border-rose-500/30',          avatar: 'bg-rose-500/20 border-rose-500/40',      icon: ShieldOff },
  ARCHIVED:  { label: 'Arxivlangan',color: 'text-slate-500 bg-slate-500/10 border-slate-600/30',       avatar: 'bg-slate-600/20 border-slate-600/30',    icon: ShieldOff },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s oldin`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m oldin`;
  return `${Math.floor(diff / 3600000)}s oldin`;
}

// ─── NoteModal ─────────────────────────────────────────────────────────────────

const NoteModal: React.FC<{
  personId: string;
  personName: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ personId, personName, onClose, onSaved }) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!note.trim()) return;
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('sentinel_token') ?? '';
      const res = await fetch(`/api/persons/${encodeURIComponent(personId)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: note.trim() }),
      });
      if (!res.ok) throw new Error('Saqlashda xatolik');
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-app-panel border border-white/10 rounded-2xl p-5 w-full max-w-sm shadow-2xl mx-4"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <StickyNote size={16} className="text-amber-400" />
            <span className="text-sm font-bold text-text-primary">Izoh qo'shish</span>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-text-secondary mb-3 font-mono">{personName}</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Operatorning izohi..."
          rows={4}
          className="w-full bg-app-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary resize-none outline-none focus:border-cyan-500/40 placeholder:text-text-secondary"
        />
        {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
        <div className="flex gap-2 mt-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-white/10 text-xs text-text-secondary hover:bg-white/5 transition-colors"
          >
            Bekor qilish
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !note.trim()}
            className="flex-1 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-xs text-cyan-400 font-bold hover:bg-cyan-500/30 transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Saqlash'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── PersonCard ────────────────────────────────────────────────────────────────

const PersonCard: React.FC<{
  person: LivePersonProfile;
  onInvestigate: (p: LivePersonProfile) => void;
  onAskCopilot: (p: LivePersonProfile) => void;
  onRefresh: () => void;
}> = ({ person, onInvestigate, onAskCopilot, onRefresh }) => {
  const { openProfile } = usePersonProfile();
  const [watchlisted, setWatchlisted] = useState(person.status === 'WATCHLIST');
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const cfg = STATUS_CFG[person.status] ?? STATUS_CFG.ANONYMOUS;
  const StatusIcon = cfg.icon;
  const shortId = person.fusionId
    ? `#${person.fusionId.slice(-5)}`
    : `#${person.personId.slice(-5)}`;

  const showMsg = (ok: boolean, text: string) => {
    setActionMsg({ ok, text });
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleWatchlist = async () => {
    setWatchlistLoading(true);
    try {
      const token = localStorage.getItem('sentinel_token') ?? '';
      const id = person.fusionId ?? person.personId;
      await fetch(`/api/persons/${encodeURIComponent(id)}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: watchlisted ? 'remove' : 'add' }),
      });
      setWatchlisted(v => !v);
      showMsg(true, watchlisted ? 'Kuzatuvdan olib tashlandi' : 'Kuzatuvga qo\'shildi');
      onRefresh();
    } catch {
      showMsg(false, 'Amal bajarishda xatolik');
    } finally {
      setWatchlistLoading(false);
    }
  };

  const app = person.currentAppearance;

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="bg-app-panel border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition-all group"
      >
        {/* Live presence indicator */}
        {person.currentlyPresent && (
          <div className="h-0.5 bg-gradient-to-r from-cyan-500/60 via-emerald-500/60 to-cyan-500/60 animate-pulse" />
        )}

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            {/* Avatar */}
            <div className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center shrink-0 ${cfg.avatar}`}>
              <User size={20} className="text-white/70" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-text-primary truncate">
                  {person.fullName}
                </span>
                {person.currentlyPresent && (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full animate-pulse">
                    <Radio size={7} /> JONLI
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-text-secondary">{shortId}</span>
                <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.color}`}>
                  <StatusIcon size={8} />
                  {cfg.label}
                </span>
              </div>
            </div>
          </div>

          {/* Camera & time */}
          <div className="flex items-center gap-3 text-[11px] text-text-secondary mb-3 bg-app-surface/50 rounded-lg px-2.5 py-1.5 border border-white/5">
            <div className="flex items-center gap-1.5">
              <Camera size={10} className="text-cyan-400 shrink-0" />
              <span className="font-mono truncate">{person.lastCameraName || person.lastCameraId || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <Clock size={10} className="text-slate-400" />
              <span>{timeAgo(person.lastSeen)}</span>
            </div>
          </div>

          {/* Appearance row */}
          {app && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {app.upperClothingColor && (
                <div className="flex items-center gap-1.5 bg-app-surface rounded-full px-2 py-1 border border-white/5">
                  <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: colorHex(app.upperClothingColor) }} />
                  <span className="text-[10px] text-text-secondary">{app.upperClothingColor}</span>
                </div>
              )}
              {app.lowerClothingColor && (
                <div className="flex items-center gap-1.5 bg-app-surface rounded-full px-2 py-1 border border-white/5">
                  <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: colorHex(app.lowerClothingColor) }} />
                  <span className="text-[10px] text-text-secondary">{app.lowerClothingColor}</span>
                </div>
              )}
              {app.bodySize && (
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2 py-0.5">
                  {app.bodySize === 'Tall' ? 'Baland' : app.bodySize === 'Short' ? 'Past' : "O'rtacha"}
                </span>
              )}
              {app.helmet && <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 flex items-center gap-1"><HardHat size={9} />Shlem</span>}
              {app.vest && <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full px-2 py-0.5 flex items-center gap-1"><Shirt size={9} />Jilet</span>}
              {app.backpack && <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full px-2 py-0.5 flex items-center gap-1"><Package size={9} />Ryukzak</span>}
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-3 text-[10px] text-text-secondary mb-3">
            <div className="flex items-center gap-1">
              <Eye size={10} className="text-text-secondary" />
              <span>{person.totalDetections}× aniqlangan</span>
            </div>
            {person.cameraHistory && person.cameraHistory.length > 1 && (
              <div className="flex items-center gap-1">
                <MapPin size={10} className="text-indigo-400" />
                <span>{person.cameraHistory.length} kamera</span>
              </div>
            )}
            {person.confidence !== undefined && (
              <div className="flex items-center gap-1 ml-auto">
                <Activity size={10} className="text-emerald-400" />
                <span>{Math.round(person.confidence * 100)}%</span>
              </div>
            )}
          </div>

          {/* Notes preview */}
          {person.notes && (
            <div className="mb-3 bg-amber-500/5 border border-amber-500/15 rounded-lg px-2.5 py-1.5">
              <p className="text-[10px] text-amber-300/70 leading-relaxed line-clamp-2">{person.notes}</p>
            </div>
          )}

          {/* Action feedback */}
          <AnimatePresence>
            {actionMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg mb-2 ${actionMsg.ok ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}
              >
                {actionMsg.ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                {actionMsg.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                const id = person.fusionId ?? person.personId;
                openProfile(id);
              }}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-app-surface border border-white/8 text-[11px] text-text-secondary hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
            >
              <Fingerprint size={11} />
              Profil
            </button>
            <button
              onClick={() => onAskCopilot(person)}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-400 hover:bg-cyan-500/20 transition-all"
            >
              <BrainCircuit size={11} />
              Copilot
            </button>
            <button
              onClick={handleWatchlist}
              disabled={watchlistLoading}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] transition-all disabled:opacity-40 ${
                watchlisted
                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20'
                  : 'bg-app-surface border-white/8 text-text-secondary hover:text-amber-400 hover:border-amber-500/25'
              }`}
            >
              {watchlistLoading ? <Loader2 size={11} className="animate-spin" /> : <ShieldAlert size={11} />}
              {watchlisted ? 'Kuzatuvda' : 'Kuzatuv'}
            </button>
            <button
              onClick={() => setNoteOpen(true)}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-app-surface border border-white/8 text-[11px] text-text-secondary hover:text-amber-400 hover:border-amber-500/25 transition-all"
            >
              <StickyNote size={11} />
              Izoh
            </button>
          </div>

          {/* Investigate full button */}
          <button
            onClick={() => onInvestigate(person)}
            className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-app-surface border border-white/8 text-[11px] text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
          >
            <Search size={11} />
            To'liq tekshiruv
            <ChevronRight size={10} className="ml-auto" />
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {noteOpen && (
          <NoteModal
            personId={person.fusionId ?? person.personId}
            personName={person.fullName}
            onClose={() => setNoteOpen(false)}
            onSaved={onRefresh}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

interface LivePersonsMonitorProps {
  onNavigateCopilot?: (query: string) => void;
}

export const LivePersonsMonitor: React.FC<LivePersonsMonitorProps> = ({ onNavigateCopilot }) => {
  const [persons, setPersons] = useState<LivePersonProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPersons = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const token = localStorage.getItem('sentinel_token') ?? '';
      const res = await fetch('/api/ai/persons/live-profiles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPersons(data.persons ?? []);
      setLastUpdated(new Date());
      setError('');
    } catch (e: any) {
      setError(e.message ?? 'Xatolik');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPersons();
    intervalRef.current = setInterval(() => fetchPersons(true), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchPersons]);

  const handleAskCopilot = useCallback((person: LivePersonProfile) => {
    const query = `${person.fullName} (${person.fusionId ?? person.personId}) shaxsining to'liq profilini tahlil qil. Status: ${person.status}. Oxirgi kamera: ${person.lastCameraName || person.lastCameraId || 'noma\'lum'}. Aniqlash soni: ${person.totalDetections}×. Ushbu shaxs haqida xavfsizlik tavsiyasi ber.`;
    onNavigateCopilot?.(query);
  }, [onNavigateCopilot]);

  const handleInvestigate = useCallback((person: LivePersonProfile) => {
    const id = person.fusionId ?? person.personId;
    window.dispatchEvent(new CustomEvent('vms:open-person-intel', { detail: { fusionId: id } }));
  }, []);

  // Filter & search
  const filtered = persons.filter(p => {
    if (filter !== 'ALL' && p.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.fullName.toLowerCase().includes(q) ||
        (p.fusionId ?? '').toLowerCase().includes(q) ||
        p.personId.toLowerCase().includes(q) ||
        (p.lastCameraName ?? '').toLowerCase().includes(q) ||
        (p.lastCameraId ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const liveCount   = persons.filter(p => p.currentlyPresent).length;
  const watchCount  = persons.filter(p => p.status === 'WATCHLIST').length;
  const knownCount  = persons.filter(p => p.status === 'KNOWN').length;
  const anonCount   = persons.filter(p => p.status === 'ANONYMOUS').length;

  return (
    <div className="flex flex-col h-full bg-app-primary text-text-primary">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <Users size={18} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-text-primary">Jonli Shaxslar Monitori</h1>
              <p className="text-[11px] text-text-secondary">
                {lastUpdated
                  ? `Yangilandi: ${lastUpdated.toLocaleTimeString('uz-UZ')}`
                  : 'Yuklanmoqda...'}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchPersons()}
            disabled={refreshing}
            className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-text-secondary hover:text-text-primary"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Jonli', value: liveCount, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: Radio },
            { label: "Ma'lum", value: knownCount, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', icon: ShieldCheck },
            { label: "Kuzatuvda", value: watchCount, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: ShieldAlert },
            { label: "Noma'lum", value: anonCount, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', icon: User },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`rounded-xl border px-2.5 py-2 ${stat.bg}`}>
                <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                <div className="flex items-center gap-1 text-[10px] text-text-secondary mt-0.5">
                  <Icon size={9} />
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Ism, ID yoki kamera bo'yicha qidirish..."
            className="w-full bg-app-surface border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-cyan-500/40"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {(['ALL', 'KNOWN', 'WATCHLIST', 'ANONYMOUS'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                filter === f
                  ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-400'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
            >
              {f === 'ALL' ? 'Barchasi' : f === 'KNOWN' ? "Ma'lum" : f === 'WATCHLIST' ? 'Kuzatuv' : "Noma'lum"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-text-secondary">
            <Loader2 size={28} className="animate-spin text-cyan-400" />
            <p className="text-sm">Shaxslar yuklanmoqda…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-rose-400">
            <AlertTriangle size={28} />
            <p className="text-sm">{error}</p>
            <button onClick={() => fetchPersons()} className="text-xs underline hover:no-underline">Qayta urinish</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-text-secondary">
            <Users size={28} className="opacity-30" />
            <p className="text-sm">
              {persons.length === 0
                ? 'Hozircha kameralarda shaxs aniqlanmagan'
                : 'Qidiruv bo\'yicha natija topilmadi'}
            </p>
            {persons.length === 0 && (
              <p className="text-xs text-center opacity-60 max-w-xs">
                Kamera tasviriga inson kirishi bilanoq profil avtomatik yaratiladi
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {filtered.map(person => (
                <PersonCard
                  key={person.personId}
                  person={person}
                  onInvestigate={handleInvestigate}
                  onAskCopilot={handleAskCopilot}
                  onRefresh={() => fetchPersons(true)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-white/8 px-4 py-2.5 flex items-center gap-3 text-[10px] text-text-secondary bg-app-panel/50">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${refreshing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span>{refreshing ? 'Yangilanmoqda...' : 'Jonli kuzatuv faol'}</span>
        </div>
        <span className="ml-auto">{filtered.length} / {persons.length} shaxs</span>
        <div className="flex items-center gap-1">
          <Zap size={9} className="text-cyan-400" />
          <span>5s interval</span>
        </div>
      </div>
    </div>
  );
};
