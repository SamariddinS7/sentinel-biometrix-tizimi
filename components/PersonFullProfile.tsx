/**
 * PersonFullProfile — To'liq Shaxs Profili
 *
 * Kuzatuv kameralari tomonidan aniqlangan har bir shaxs uchun
 * to'liq ma'lumotlar, faoliyat tarixi, tahrirlash va AI tahlil imkoniyati.
 *
 * Tablar:
 *   1. Umumiy       — Asosiy ma'lumotlar, statistika, tezkor amallar
 *   2. Ko'rinish    — Biometrika, kiyim, aksessuarlar, galereya
 *   3. Faoliyat     — Kamera tashrif tarixi, harakatlar, voqealar vaqt chizig'i
 *   4. Ma'lumotlar  — Tahrirlash mumkin bo'lgan shaxsiy ma'lumotlar
 *   5. AI Tahlil    — AI tomonidan yaratilgan xulq-atvor tahlili
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, User, Camera, Clock, Shield, ShieldAlert, Eye, RefreshCw,
  Loader2, Ruler, Shirt, ChevronDown, ChevronUp, Package,
  Backpack, HardHat, Umbrella, Glasses, AlertTriangle,
  CheckCircle2, MapPin, Activity, CalendarDays, ScanFace,
  Hash, ArrowRight, Edit3, Save, XCircle, Brain, Star,
  Navigation, BarChart3, Bookmark, FileText, UserCheck,
  Zap, TrendingUp, MessageSquare, Plus, Trash2, Bell,
  ShieldCheck, Lock, Unlock, Archive, Users, Info,
} from 'lucide-react';
import { PersonTimeline } from './PersonTimeline';
import type {
  PersonProfile, AppearanceSnapshot, PersonStatus,
  CameraVisit, RelationshipObservation, PersonStatistics,
} from '../services/personIntel/types/PersonProfile';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function relTime(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s oldin`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}d oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}s oldin`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Kecha';
  if (d < 30) return `${d} kun oldin`;
  return new Date(iso).toLocaleDateString('uz-UZ');
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('uz-UZ', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtMs(ms?: number): string {
  if (!ms) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}s ${m}d`;
  return `${m} daqiqa`;
}

function colorSwatch(color: string): string {
  const map: Record<string, string> = {
    black: '#111', white: '#f5f5f5', gray: '#6b7280', grey: '#6b7280',
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
    orange: '#f97316', purple: '#a855f7', pink: '#ec4899', brown: '#92400e',
    navy: '#1e3a5f', beige: '#d2b48c', khaki: '#c3b091', cyan: '#06b6d4',
    teal: '#14b8a6', indigo: '#6366f1', maroon: '#7f1d1d', olive: '#65a30d',
    cream: '#fef9c3', lime: '#84cc16', violet: '#7c3aed',
  };
  return map[color?.toLowerCase().trim()] ?? '#4b5563';
}

const STATUS_CONF: Record<PersonStatus, { ring: string; badge: string; dot: string; bg: string }> = {
  KNOWN:     { ring: 'ring-teal-500/50',  badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30',   dot: 'bg-teal-400',   bg: 'bg-teal-700'   },
  ANONYMOUS: { ring: 'ring-gray-500/40',  badge: 'bg-gray-700 text-gray-300 border-gray-600',           dot: 'bg-gray-400',   bg: 'bg-gray-600'   },
  WATCHLIST: { ring: 'ring-amber-500/50', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',  dot: 'bg-amber-400',  bg: 'bg-amber-700'  },
  BLOCKED:   { ring: 'ring-red-500/50',   badge: 'bg-red-500/15 text-red-300 border-red-500/30',        dot: 'bg-red-400',    bg: 'bg-red-700'    },
  ARCHIVED:  { ring: 'ring-gray-700/50',  badge: 'bg-gray-800 text-gray-500 border-gray-700',           dot: 'bg-gray-600',   bg: 'bg-gray-800'   },
};

function aggregateCarriedObjects(gallery: AppearanceSnapshot[]) {
  const map = new Map<string, { name: string; count: number; firstSeen: string; lastSeen: string; cameras: string[] }>();
  const sorted = [...gallery].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
  for (const snap of sorted) {
    const items: Array<[boolean | undefined, string]> = [
      [snap.backpack, 'Ryukzak'], [snap.helmet, 'Kaska'], [snap.vest, 'Himoya nimchasi'],
      [snap.bag, 'Sumka'], [snap.glasses, "Ko'zoynak"], [snap.mask, 'Niqob'], [(snap as any).umbrella, 'Soyabon'],
    ];
    const objs = [...(snap.carriedObjects ?? []), ...items.filter(([v]) => v).map(([, n]) => n)];
    for (const obj of objs) {
      const key = obj.toLowerCase().trim();
      if (!key) continue;
      const ex = map.get(key);
      if (ex) { ex.count++; ex.lastSeen = snap.capturedAt; if (!ex.cameras.includes(snap.cameraId)) ex.cameras.push(snap.cameraId); }
      else map.set(key, { name: obj, count: 1, firstSeen: snap.capturedAt, lastSeen: snap.capturedAt, cameras: [snap.cameraId] });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; sub?: string }> = ({ icon, title, sub }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="text-cyan-400">{icon}</div>
    <div>
      <h3 className="text-sm font-bold text-white">{title}</h3>
      {sub && <p className="text-[10px] text-text-muted font-mono">{sub}</p>}
    </div>
  </div>
);

const AttrRow: React.FC<{ label: string; value?: string | number | null; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
    <span className="text-xs text-text-muted">{label}</span>
    <span className={`text-xs font-semibold text-text-primary ${mono ? 'font-mono' : ''} max-w-[60%] text-right`}>{value ?? '—'}</span>
  </div>
);

const ClothingColorChip: React.FC<{ color: string }> = ({ color }) => {
  const hex = colorSwatch(color);
  const isLight = ['white', 'cream', 'beige', 'yellow', 'lime'].includes(color?.toLowerCase());
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/50 text-xs font-semibold text-text-primary bg-app-panel">
      <span className="w-3 h-3 rounded-full inline-block border" style={{ background: hex, borderColor: isLight ? '#9ca3af' : 'transparent' }} />
      {color || '—'}
    </span>
  );
};

const AccessoryBadge: React.FC<{ label: string; icon: React.ReactNode; color: string }> = ({ label, icon, color }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border ${color}`}>
    {icon}{label}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPerson(id: string): Promise<PersonProfile | null> {
  try {
    const r = await fetch(`/api/persons/${encodeURIComponent(id)}`);
    if (!r.ok) return null;
    const j = await r.json();
    // API returns { success: true, data: { profile: {...} } }
    return j?.data?.profile ?? null;
  } catch { return null; }
}
async function fetchStats(id: string): Promise<PersonStatistics | null> {
  try { const r = await fetch(`/api/persons/${id}/statistics`); if (!r.ok) return null; const j = await r.json(); return j.data?.statistics ?? null; } catch { return null; }
}
async function fetchRelationships(id: string): Promise<RelationshipObservation[]> {
  try { const r = await fetch(`/api/persons/${id}/relationships`); if (!r.ok) return []; const j = await r.json(); return j.data?.relationships ?? []; } catch { return []; }
}
async function patchPerson(id: string, fields: Record<string, unknown>): Promise<boolean> {
  try { const r = await fetch(`/api/persons/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) }); return r.ok; } catch { return false; }
}
async function addNote(id: string, note: string): Promise<boolean> {
  try { const r = await fetch(`/api/persons/${id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) }); return r.ok; } catch { return false; }
}
async function addToWatchlist(id: string): Promise<boolean> {
  try { const r = await fetch(`/api/persons/${id}/watchlist`, { method: 'POST' }); return r.ok; } catch { return false; }
}
async function fetchAiAnalysis(id: string): Promise<{ summary: string; riskLevel: string; riskScore: number; patterns: string[]; recommendations: string[]; monitoringFlags: string[] } | null> {
  try { const r = await fetch(`/api/persons/${id}/ai-analysis`, { method: 'POST' }); if (!r.ok) return null; const j = await r.json(); return j.data ?? null; } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Overview
// ─────────────────────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ profile: PersonProfile; stats: PersonStatistics | null; onWatchlist: () => void; onArchive: () => void; onReload: () => void }> = ({ profile, stats, onWatchlist, onArchive, onReload }) => {
  const sc = STATUS_CONF[profile.status as PersonStatus];

  return (
    <div className="space-y-4">
      {/* Identity card */}
      <div className="bg-app-panel border border-border rounded-xl p-4">
        <SectionHeader icon={<UserCheck size={16} />} title="Shaxs Identifikatsiyasi" sub="Tizim va qo'l bilan kiritilgan ma'lumotlar" />
        <div className="divide-y divide-border/40">
          <AttrRow label="To'liq ism" value={profile.fullName} />
          <AttrRow label="Xodim ID" value={profile.employeeId} mono />
          <AttrRow label="Bo'lim" value={profile.department} />
          <AttrRow label="Lavozim" value={profile.position} />
          <AttrRow label="Tashkilot" value={profile.organization} />
          <AttrRow label="Rol" value={profile.role} />
          <AttrRow label="Fusion ID" value={profile.fusionId} mono />
          <AttrRow label="Profil versiyasi" value={`v${profile.profileVersion}`} mono />
        </div>
      </div>

      {/* Presence stats */}
      <div className="bg-app-panel border border-border rounded-xl p-4">
        <SectionHeader icon={<Activity size={16} />} title="Mavjudlik Statistikasi" />
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Birinchi ko\'rilgan', value: fmtDate(profile.firstSeen), icon: <CalendarDays size={13} /> },
            { label: 'Oxirgi ko\'rilgan', value: relTime(profile.lastSeen), icon: <Clock size={13} /> },
            { label: 'Jami aniqlanishlar', value: profile.totalDetections, icon: <ScanFace size={13} /> },
            { label: 'Tanilish soni', value: profile.totalRecognitions, icon: <Eye size={13} /> },
            { label: 'Kameralar soni', value: profile.cameraHistory?.length ?? 0, icon: <Camera size={13} /> },
            { label: 'Tashrif etilgan zonalar', value: profile.visitedZones?.length ?? 0, icon: <MapPin size={13} /> },
          ].map(item => (
            <div key={item.label} className="bg-app-primary/50 border border-border/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-text-muted mb-1">{item.icon}<span className="text-[10px] uppercase tracking-wide">{item.label}</span></div>
              <p className="text-sm font-bold text-white">{item.value ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced stats from /statistics */}
      {stats && (
        <div className="bg-app-panel border border-border rounded-xl p-4">
          <SectionHeader icon={<BarChart3 size={16} />} title="Kengaytirilgan Tahlil" sub={`${stats.periodDays} kun davomida hisoblab chiqilgan`} />
          <div className="divide-y divide-border/40">
            <AttrRow label="Kunlik tashrif chastotasi" value={`${stats.visitFrequencyPerDay.toFixed(2)} marta/kun`} />
            <AttrRow label="O'rtacha qolish muddati" value={fmtMs(stats.averageStayMs)} />
            <AttrRow label="Jami mavjudlik vaqti" value={fmtMs(stats.totalPresenceMs)} />
            <AttrRow label="Tanish aniqlik darajasi" value={`${(stats.recognitionAccuracy * 100).toFixed(1)}%`} />
            <AttrRow label="Voqealar soni" value={stats.incidentCount} />
          </div>
          {stats.mostActiveHours?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/40">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Eng faol soatlar</p>
              <div className="flex gap-1 flex-wrap">
                {stats.mostActiveHours.slice(0, 8).map(h => (
                  <span key={h} className="text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-mono">
                    {String(h).padStart(2, '0')}:00
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-app-panel border border-border rounded-xl p-4">
        <SectionHeader icon={<Zap size={16} />} title="Tezkor Amallar" />
        <div className="flex flex-wrap gap-2">
          {profile.status !== 'WATCHLIST' && (
            <button onClick={onWatchlist}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-all">
              <Bookmark size={13} /> Kuzatuv ro'yxatiga qo'shish
            </button>
          )}
          {profile.status !== 'ARCHIVED' && (
            <button onClick={onArchive}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-500/10 border border-gray-500/30 text-gray-400 text-xs font-bold hover:bg-gray-500/20 transition-all">
              <Archive size={13} /> Arxivlash
            </button>
          )}
          <button onClick={onReload}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold hover:bg-cyan-500/20 transition-all">
            <RefreshCw size={13} /> Yangilash
          </button>
        </div>
      </div>

      {/* Registration history */}
      {(profile.registrationHistory?.length ?? 0) > 0 && (
        <div className="bg-app-panel border border-border rounded-xl p-4">
          <SectionHeader icon={<FileText size={16} />} title="Ro'yxatga Olish Tarixi" sub={`${profile.registrationHistory.length} ta yozuv`} />
          <div className="space-y-2">
            {profile.registrationHistory.slice(0, 6).map(ev => (
              <div key={ev.eventId} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-text-primary">{ev.action}</p>
                  <p className="text-[10px] text-text-muted">{ev.details}</p>
                  {ev.operator && <p className="text-[10px] text-cyan-500 font-mono">{ev.operator}</p>}
                </div>
                <span className="text-[10px] text-text-muted font-mono shrink-0">{relTime(ev.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Appearance
// ─────────────────────────────────────────────────────────────────────────────

const AppearanceCard: React.FC<{ snap: AppearanceSnapshot; index: number }> = ({ snap, index }) => {
  const [expanded, setExpanded] = useState(index === 0);
  const accessories = [
    snap.backpack && 'Ryukzak', snap.helmet && 'Kaska', snap.vest && 'Nimcha',
    snap.bag && 'Sumka', snap.glasses && "Ko'zoynak", snap.mask && 'Niqob', (snap as any).umbrella && 'Soyabon',
  ].filter(Boolean) as string[];

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
      className="border border-border/50 rounded-xl overflow-hidden bg-app-primary/40">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2.5 text-left">
          <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-[10px] font-bold">
            {index + 1}
          </div>
          <div>
            <p className="text-xs font-semibold text-text-primary font-mono">{snap.cameraId}</p>
            <p className="text-[10px] text-text-muted">{fmtDate(snap.capturedAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {snap.upperClothingColor && <span className="w-3.5 h-3.5 rounded-full border border-white/10" style={{ background: colorSwatch(snap.upperClothingColor) }} />}
          {snap.lowerClothingColor && <span className="w-3.5 h-3.5 rounded-full border border-white/10" style={{ background: colorSwatch(snap.lowerClothingColor) }} />}
          <span className="text-[10px] text-cyan-400 font-mono">{(snap.confidence * 100).toFixed(0)}%</span>
          {expanded ? <ChevronUp size={13} className="text-text-muted" /> : <ChevronDown size={13} className="text-text-muted" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border-t border-border/30 px-3 py-3 space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                {([
                  ['Ustki kiyim', `${snap.upperClothingColor} ${snap.upperClothingType}`.trim() || '—'],
                  ['Pastki kiyim', `${snap.lowerClothingColor} ${snap.lowerClothingType}`.trim() || '—'],
                  ['Oyoq kiyim', snap.shoes || '—'],
                  ['Naqsh', snap.upperClothingPattern || '—'],
                  ['Soch rangi', snap.hairColor || '—'],
                  ['Soch uslubi', (snap as any).hairStyle || '—'],
                  ['Soqol', (snap as any).beard !== undefined ? ((snap as any).beard ? 'Ha' : "Yo'q") : '—'],
                  ['Tana shakli', snap.bodyShape || '—'],
                  ["Bo'yi", snap.estimatedHeightCm ? `~${snap.estimatedHeightCm} sm` : '—'],
                ] as [string, string][]).map(([label, val]) => (
                  <div key={label} className="flex gap-2">
                    <span className="text-text-muted w-20 flex-shrink-0">{label}</span>
                    <span className="text-text-primary font-medium capitalize">{val}</span>
                  </div>
                ))}
              </div>
              {accessories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/30">
                  {accessories.map(acc => (
                    <span key={acc} className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-md font-semibold">{acc}</span>
                  ))}
                </div>
              )}
              {(snap.carriedObjects?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/30">
                  <span className="text-[10px] text-text-muted w-full mb-0.5">Ko'tarilgan buyumlar:</span>
                  {snap.carriedObjects.map(obj => (
                    <span key={obj} className="text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-md font-semibold">{obj}</span>
                  ))}
                </div>
              )}
              <div className="pt-1.5 border-t border-border/30">
                <div className="flex justify-between text-[9px] text-text-muted mb-1 font-mono"><span>AI ISHONCH</span><span>{(snap.confidence * 100).toFixed(1)}%</span></div>
                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${snap.confidence > 0.8 ? 'bg-emerald-500' : snap.confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${snap.confidence * 100}%` }} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const AppearanceTab: React.FC<{ profile: PersonProfile }> = ({ profile }) => {
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const snap = profile.currentAppearance ?? profile.appearanceGallery?.[0];
  const gallery = useMemo(() => [...(profile.appearanceGallery ?? [])].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()), [profile]);
  const carriedItems = useMemo(() => aggregateCarriedObjects(gallery), [gallery]);
  const hasAccessory = snap && (snap.helmet || snap.vest || snap.backpack || snap.bag || snap.glasses || snap.mask || (snap as any).umbrella);

  return (
    <div className="space-y-4">
      {/* Biometrics */}
      <div className="bg-app-panel border border-border rounded-xl p-4">
        <SectionHeader icon={<Ruler size={16} />} title="Biologik Atributlar" sub="AI tomonidan aniqlangan fiziologik xususiyatlar" />
        {!snap ? <p className="text-xs text-text-muted italic text-center py-4">Ma'lumot mavjud emas</p> : (
          <>
            <div className="divide-y divide-border/40">
              <AttrRow label="Bo'yi (taxminiy)" value={snap.estimatedHeightCm ? `~${snap.estimatedHeightCm} sm` : undefined} />
              <AttrRow label="Tana shakli" value={snap.bodyShape} />
              <AttrRow label="Tana o'lchami" value={(snap as any).estimatedBodySize} />
              <AttrRow label="Soch rangi" value={snap.hairColor} />
              <AttrRow label="Soch uslubi" value={(snap as any).hairStyle} />
              <AttrRow label="Soqol" value={(snap as any).beard !== undefined ? ((snap as any).beard ? ((snap as any).beardStyle ?? 'Mavjud') : "Yo'q") : undefined} />
              <AttrRow label="AI ishonch" value={snap.confidence ? `${(snap.confidence * 100).toFixed(0)}%` : undefined} />
            </div>
            <div className="mt-3 pt-3 border-t border-border/40">
              <div className="flex justify-between text-[10px] text-text-muted mb-1">
                <span className="font-mono">AI ISHONCH DARAJASI</span>
                <span className="font-bold text-cyan-400">{(snap.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${snap.confidence * 100}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${snap.confidence > 0.8 ? 'bg-emerald-500' : snap.confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'}`} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Clothing */}
      <div className="bg-app-panel border border-border rounded-xl p-4">
        <SectionHeader icon={<Shirt size={16} />} title="Kiyim" sub="Eng so'nggi ko'rinish asosida" />
        {!snap ? <p className="text-xs text-text-muted italic text-center py-4">Kiyim ma'lumotlari mavjud emas</p> : (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Ustki kiyim</p>
              <div className="flex flex-wrap gap-1.5">
                {snap.upperClothingColor && <ClothingColorChip color={snap.upperClothingColor} />}
                {snap.upperClothingType && <span className="px-2.5 py-1 rounded-full border border-border/50 text-xs text-text-secondary bg-app-panel font-semibold">{snap.upperClothingType}</span>}
                {snap.upperClothingPattern && snap.upperClothingPattern !== 'none' && <span className="px-2.5 py-1 rounded-full border border-border/50 text-xs text-text-muted bg-app-panel">{snap.upperClothingPattern}</span>}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Pastki kiyim</p>
              <div className="flex flex-wrap gap-1.5">
                {snap.lowerClothingColor && <ClothingColorChip color={snap.lowerClothingColor} />}
                {snap.lowerClothingType && <span className="px-2.5 py-1 rounded-full border border-border/50 text-xs text-text-secondary bg-app-panel font-semibold">{snap.lowerClothingType}</span>}
              </div>
            </div>
            {snap.shoes && (
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Oyoq kiyim</p>
                <span className="px-2.5 py-1 rounded-full border border-border/50 text-xs text-text-secondary bg-app-panel font-semibold">{snap.shoes}</span>
              </div>
            )}
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Aksessuarlar va maxsus kiyim</p>
              {!hasAccessory ? <p className="text-xs text-text-muted italic">Aniqlanmadi</p> : (
                <div className="flex flex-wrap gap-2">
                  {snap.backpack && <AccessoryBadge label="Ryukzak" icon={<Backpack size={12} />} color="bg-blue-500/10 text-blue-400 border-blue-500/30" />}
                  {snap.helmet && <AccessoryBadge label="Kaska" icon={<HardHat size={12} />} color="bg-yellow-500/10 text-yellow-400 border-yellow-500/30" />}
                  {snap.vest && <AccessoryBadge label="Himoya nimchasi" icon={<Shield size={12} />} color="bg-orange-500/10 text-orange-400 border-orange-500/30" />}
                  {(snap as any).umbrella && <AccessoryBadge label="Soyabon" icon={<Umbrella size={12} />} color="bg-indigo-500/10 text-indigo-400 border-indigo-500/30" />}
                  {snap.glasses && <AccessoryBadge label="Ko'zoynak" icon={<Glasses size={12} />} color="bg-purple-500/10 text-purple-400 border-purple-500/30" />}
                  {snap.mask && <AccessoryBadge label="Niqob" icon={<Activity size={12} />} color="bg-teal-500/10 text-teal-400 border-teal-500/30" />}
                  {snap.bag && <AccessoryBadge label="Sumka" icon={<Package size={12} />} color="bg-pink-500/10 text-pink-400 border-pink-500/30" />}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Carried objects aggregate */}
      <div className="bg-app-panel border border-border rounded-xl p-4">
        <SectionHeader icon={<Package size={16} />} title="Ko'tarib Yurgan Buyumlar" sub={`Barcha ${gallery.length} ta ko'rinish bo'yicha yig'ilgan`} />
        {carriedItems.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-text-muted gap-2"><Package size={28} className="opacity-20" /><p className="text-xs italic">Aniqlanmadi</p></div>
        ) : (
          <div className="space-y-2">
            {carriedItems.map((item, i) => (
              <motion.div key={item.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between gap-3 bg-app-primary/50 border border-border/50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400"><Package size={14} /></div>
                  <div>
                    <p className="text-xs font-bold text-text-primary capitalize">{item.name}</p>
                    <p className="text-[10px] text-text-muted font-mono">{item.cameras.length} kamera · Birinchi: {relTime(item.firstSeen)}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-cyan-400 tabular-nums">{item.count}×</span>
                  <p className="text-[10px] text-text-muted">So'nggi: {relTime(item.lastSeen)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Snapshot gallery */}
      <div className="bg-app-panel border border-border rounded-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <SectionHeader icon={<Camera size={16} />} title="Ko'rinish Galereya" sub={`${gallery.length} ta ko'rinish — yangilaridan eskisiga`} />
          {gallery.length > 4 && (
            <button onClick={() => setHistoryExpanded(v => !v)}
              className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-mono mt-0.5">
              {historyExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {historyExpanded ? 'Kamroq' : `+${gallery.length - 4} ta`}
            </button>
          )}
        </div>
        {gallery.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-text-muted gap-2"><Camera size={28} className="opacity-20" /><p className="text-xs italic">Ko'rinish tarixi yo'q</p></div>
        ) : (
          <div className="space-y-3">
            {(historyExpanded ? gallery : gallery.slice(0, 4)).map((s, i) => <AppearanceCard key={s.snapshotId} snap={s} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Activity
// ─────────────────────────────────────────────────────────────────────────────

const ActivityTab: React.FC<{ profile: PersonProfile; relationships: RelationshipObservation[] }> = ({ profile, relationships }) => {
  return (
    <div className="space-y-4">
      {/* Camera visits */}
      {(profile.cameraHistory?.length ?? 0) > 0 && (
        <div className="bg-app-panel border border-border rounded-xl p-4">
          <SectionHeader icon={<Camera size={16} />} title="Kamera Tashriflari" sub={`${profile.cameraHistory.length} ta kamera, joylashuv bo'yicha`} />
          <div className="space-y-2">
            {profile.cameraHistory.map(cv => (
              <div key={cv.cameraId} className="flex items-center gap-3 bg-app-primary/50 border border-border/50 rounded-lg px-3 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0"><Camera size={14} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{cv.cameraName || cv.cameraId}</p>
                  <p className="text-[10px] text-text-muted">{cv.location || '—'} · {cv.visitCount} tashrif</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-cyan-400">{fmtMs(cv.totalDurationMs)}</p>
                  <p className="text-[10px] text-text-muted">{relTime(cv.lastSeenAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zones visited */}
      {(profile.visitedZones?.length ?? 0) > 0 && (
        <div className="bg-app-panel border border-border rounded-xl p-4">
          <SectionHeader icon={<MapPin size={16} />} title="Tashrif Etilgan Zonalar" sub={`${profile.visitedZones.length} ta zona`} />
          <div className="flex flex-wrap gap-2">
            {profile.visitedZones.map(z => (
              <span key={z} className="px-2.5 py-1 rounded-lg border border-border/50 bg-app-primary/50 text-xs text-text-secondary font-semibold">{z}</span>
            ))}
          </div>
        </div>
      )}

      {/* Relationships */}
      {relationships.length > 0 && (
        <div className="bg-app-panel border border-border rounded-xl p-4">
          <SectionHeader icon={<Users size={16} />} title="Kuzatilgan Aloqalar" sub="Boshqa shaxslar bilan kuzatilgan korrelyatsiyalar" />
          <div className="space-y-2">
            {relationships.slice(0, 8).map(rel => (
              <div key={rel.observationId} className="flex items-start gap-3 bg-app-primary/50 border border-border/50 rounded-lg px-3 py-2.5">
                <div className="w-7 h-7 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 mt-0.5"><Users size={12} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary">{rel.type.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-text-muted">{rel.description}</p>
                  <p className="text-[10px] text-purple-400 font-mono mt-0.5">ID: {rel.personBId} · {rel.observationCount}× kuzatilgan</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded font-mono">
                    {(rel.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-app-panel border border-border rounded-xl p-4">
        <SectionHeader icon={<Clock size={16} />} title="Voqealar Vaqt Chizig'i" sub="Barcha kuzatuv hodisalari" />
        <PersonTimeline personId={profile.personId} maxHeight="500px" showFilters={true} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Personal Data (editable)
// ─────────────────────────────────────────────────────────────────────────────

const PersonalDataTab: React.FC<{ profile: PersonProfile; onUpdated: () => void }> = ({ profile, onUpdated }) => {
  const [form, setForm] = useState({
    fullName: profile.fullName ?? '',
    employeeId: profile.employeeId ?? '',
    department: profile.department ?? '',
    organization: profile.organization ?? '',
    position: profile.position ?? '',
    notes: profile.notes ?? '',
  });
  const [customAttrs, setCustomAttrs] = useState<Array<{ key: string; value: string }>>(
    Object.entries(profile.customAttributes ?? {}).map(([k, v]) => ({ key: k, value: v }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const save = async () => {
    setSaving(true); setError('');
    const customAttributes: Record<string, string> = {};
    for (const { key, value } of customAttrs) { if (key.trim()) customAttributes[key.trim()] = value; }
    const ok = await patchPerson(profile.personId, { ...form, customAttributes });
    setSaving(false);
    if (ok) { setSaved(true); onUpdated(); setTimeout(() => setSaved(false), 2500); }
    else setError("Saqlashda xato yuz berdi. Qayta urinib ko'ring.");
  };

  const submitNote = async () => {
    if (!noteInput.trim()) return;
    setAddingNote(true);
    await addNote(profile.personId, noteInput.trim());
    setAddingNote(false);
    setNoteInput('');
    onUpdated();
  };

  return (
    <div className="space-y-4">
      {/* Editable fields */}
      <div className="bg-app-panel border border-border rounded-xl p-4">
        <SectionHeader icon={<Edit3 size={16} />} title="Shaxsiy Ma'lumotlar" sub="Bu yerda kiritilgan ma'lumotlar bazaga saqlanadi" />
        <div className="space-y-3">
          {([
            { field: 'fullName', label: "To'liq ism" },
            { field: 'employeeId', label: 'Xodim ID' },
            { field: 'department', label: "Bo'lim" },
            { field: 'organization', label: 'Tashkilot' },
            { field: 'position', label: 'Lavozim' },
          ] as Array<{ field: keyof typeof form; label: string }>).map(({ field, label }) => (
            <div key={field}>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">{label}</label>
              <input
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full bg-app-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyan-500/50 transition-colors"
                placeholder={`${label}ni kiriting...`}
              />
            </div>
          ))}
          <div>
            <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Izoh / Eslatma</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full bg-app-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
              placeholder="Bu shaxs haqida izoh kiriting..."
            />
          </div>
        </div>
      </div>

      {/* Custom attributes */}
      <div className="bg-app-panel border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader icon={<Hash size={16} />} title="Maxsus Atributlar" sub="Qo'shimcha kalit-qiymat juftliklari" />
          <button onClick={() => setCustomAttrs(a => [...a, { key: '', value: '' }])}
            className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-mono">
            <Plus size={12} /> Qo'shish
          </button>
        </div>
        {customAttrs.length === 0 ? (
          <p className="text-xs text-text-muted italic text-center py-3">Maxsus atributlar yo'q</p>
        ) : (
          <div className="space-y-2">
            {customAttrs.map((attr, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={attr.key} onChange={e => setCustomAttrs(a => a.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                  placeholder="Kalit" className="flex-1 bg-app-primary border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-cyan-500/50" />
                <input value={attr.value} onChange={e => setCustomAttrs(a => a.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                  placeholder="Qiymat" className="flex-1 bg-app-primary border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-cyan-500/50" />
                <button onClick={() => setCustomAttrs(a => a.filter((_, j) => j !== i))}
                  className="p-1.5 rounded text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save button */}
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <button onClick={save} disabled={saving}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
          saved ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' :
          'bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/30'
        }`}>
        {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
        {saving ? 'Saqlanmoqda...' : saved ? 'Saqlandi ✓' : "Ma'lumotlarni Saqlash"}
      </button>

      {/* Add note */}
      <div className="bg-app-panel border border-border rounded-xl p-4">
        <SectionHeader icon={<MessageSquare size={16} />} title="Operator Izohi Qo'shish" sub="Izohlar vaqt chizig'iga qayd etiladi" />
        <textarea
          value={noteInput}
          onChange={e => setNoteInput(e.target.value)}
          rows={2}
          className="w-full bg-app-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyan-500/50 transition-colors resize-none mb-2"
          placeholder="Izoh matni..."
        />
        <button onClick={submitNote} disabled={addingNote || !noteInput.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs font-bold hover:bg-indigo-500/25 transition-all disabled:opacity-40">
          {addingNote ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Izoh Qo'shish
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: AI Analysis
// ─────────────────────────────────────────────────────────────────────────────

const RISK_CONF: Record<string, { color: string; bg: string; bar: string }> = {
  LOW:      { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', bar: 'bg-emerald-500' },
  MEDIUM:   { color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',     bar: 'bg-amber-500'   },
  HIGH:     { color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/30',   bar: 'bg-orange-500'  },
  CRITICAL: { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',         bar: 'bg-red-500'     },
};

const AiAnalysisTab: React.FC<{ profile: PersonProfile; onAddNote: (note: string) => Promise<void> }> = ({ profile, onAddNote }) => {
  const [analysis, setAnalysis] = useState<{
    summary: string; riskLevel: string; riskScore: number;
    patterns: string[]; recommendations: string[]; monitoringFlags: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [monitored, setMonitored] = useState(profile.status === 'WATCHLIST');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const runAnalysis = async () => {
    setLoading(true); setError('');
    const result = await fetchAiAnalysis(profile.personId);
    setLoading(false);
    if (result) setAnalysis(result);
    else setError("AI tahlili amalga oshirilmadi. GEMINI_API_KEY o'rnatilmagan yoki xato yuz berdi.");
  };

  const saveAnalysisNote = async () => {
    if (!analysis) return;
    setSavingNote(true);
    const note = `[AI TAHLIL] Risk: ${analysis.riskLevel} (${(analysis.riskScore * 100).toFixed(0)}%)\n${analysis.summary}\nTavsiyalar: ${analysis.recommendations.join('; ')}`;
    await onAddNote(note);
    setSavingNote(false);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2500);
  };

  const risk = analysis ? (RISK_CONF[analysis.riskLevel] ?? RISK_CONF.MEDIUM) : null;

  return (
    <div className="space-y-4">
      {/* AI analysis trigger */}
      <div className="bg-app-panel border border-border rounded-xl p-4">
        <SectionHeader icon={<Brain size={16} />} title="AI Xulq-atvor Tahlili" sub="Gemini AI yordamida profilni chuqur tahlil qilish" />
        <p className="text-xs text-text-muted mb-4">
          AI shaxsning barcha kuzatuv ma'lumotlari — tashrif chastotasi, harakat naqshlari, ko'rinish o'zgarishlari va hodisalar — asosida xavf darajasini va xulq-atvor naqshlarini baholaydi.
        </p>
        <button onClick={runAnalysis} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600/20 to-cyan-600/20 border border-violet-500/30 text-white text-sm font-bold hover:from-violet-600/30 hover:to-cyan-600/30 transition-all disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} className="text-violet-400" />}
          {loading ? 'AI tahlil qilmoqda...' : 'AI Tahlilni Boshlash'}
        </button>
        {error && <p className="mt-3 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">{error}</p>}
      </div>

      {/* Analysis results */}
      <AnimatePresence>
        {analysis && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Risk level */}
            <div className={`bg-app-panel border rounded-xl p-4 ${risk!.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <SectionHeader icon={<ShieldAlert size={16} />} title="Xavf Darajasi" />
                <span className={`text-lg font-black ${risk!.color}`}>{analysis.riskLevel}</span>
              </div>
              <div className="flex justify-between text-[10px] text-text-muted mb-1.5 font-mono">
                <span>XAVF BALLI</span><span className={`font-bold ${risk!.color}`}>{(analysis.riskScore * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${analysis.riskScore * 100}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${risk!.bar}`} />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-app-panel border border-border rounded-xl p-4">
              <SectionHeader icon={<Info size={16} />} title="AI Xulosasi" />
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{analysis.summary}</p>
            </div>

            {/* Patterns */}
            {analysis.patterns.length > 0 && (
              <div className="bg-app-panel border border-border rounded-xl p-4">
                <SectionHeader icon={<TrendingUp size={16} />} title="Aniqlangan Naqshlar" />
                <div className="space-y-2">
                  {analysis.patterns.map((p, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                      <p className="text-xs text-text-secondary">{p}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monitoring flags */}
            {analysis.monitoringFlags.length > 0 && (
              <div className="bg-app-panel border border-amber-500/20 rounded-xl p-4">
                <SectionHeader icon={<Bell size={16} />} title="Kuzatuv Bayroqlari" />
                <div className="flex flex-wrap gap-2">
                  {analysis.monitoringFlags.map((f, i) => (
                    <span key={i} className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-lg font-semibold">{f}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {analysis.recommendations.length > 0 && (
              <div className="bg-app-panel border border-border rounded-xl p-4">
                <SectionHeader icon={<CheckCircle2 size={16} />} title="AI Tavsiyalari" />
                <div className="space-y-2">
                  {analysis.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-cyan-500/5 border border-cyan-500/15 rounded-lg px-3 py-2.5">
                      <ArrowRight size={12} className="text-cyan-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-text-secondary">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save analysis to notes */}
            <button onClick={saveAnalysisNote} disabled={savingNote}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                noteSaved ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                'bg-app-panel border-border text-text-muted hover:text-white hover:border-border/80'
              }`}>
              {savingNote ? <Loader2 size={13} className="animate-spin" /> : noteSaved ? <CheckCircle2 size={13} /> : <Save size={13} />}
              {noteSaved ? "Tahlil izohi saqlandi" : "Tahlilni Izoh Sifatida Saqlash"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI monitoring toggle */}
      <div className="bg-app-panel border border-border rounded-xl p-4">
        <SectionHeader icon={<ShieldCheck size={16} />} title="AI Kuzatuv Rejimi" sub="Bu shaxsni kengaytirilgan AI monitoring ostiga olish" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-secondary mb-0.5">
              {monitored ? 'Kengaytirilgan kuzatuv yoqilgan — barcha hodisalar darhol bayroqlanadi' : 'Standart kuzatuv rejimi'}
            </p>
            <p className="text-[10px] text-text-muted">Holat: <span className={monitored ? 'text-amber-400 font-bold' : 'text-gray-400'}>{monitored ? 'KUZATUVDA' : 'ODDIY'}</span></p>
          </div>
          <button onClick={() => setMonitored(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
              monitored ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25' :
              'bg-gray-700/30 border-gray-600 text-gray-400 hover:bg-gray-700/50'
            }`}>
            {monitored ? <Lock size={13} /> : <Unlock size={13} />}
            {monitored ? 'Kuzatuvni To\'xtatish' : 'Kuzatuvga Qo\'shish'}
          </button>
        </div>
      </div>

      {/* Profile info */}
      <div className="bg-app-panel border border-border/50 rounded-xl p-4">
        <SectionHeader icon={<Hash size={16} />} title="Profil Meta" />
        <div className="divide-y divide-border/40">
          <AttrRow label="Yaratilgan" value={fmtDate(profile.createdAt)} />
          <AttrRow label="Yangilangan" value={fmtDate(profile.updatedAt)} />
          <AttrRow label="Profil versiyasi" value={`v${profile.profileVersion}`} mono />
          <AttrRow label="Yuz galereya" value={`${profile.faceGallery?.length ?? 0} ta yuz`} />
          <AttrRow label="Ko'rinish galereya" value={`${profile.appearanceGallery?.length ?? 0} ta ko'rinish`} />
        </div>
        {profile.notes && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Izohlar</p>
            <p className="text-xs text-text-secondary leading-relaxed">{profile.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'appearance' | 'activity' | 'personal' | 'ai';

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'overview',    label: 'Umumiy',       icon: <User size={14} />         },
  { id: 'appearance',  label: "Ko'rinish",    icon: <Shirt size={14} />        },
  { id: 'activity',    label: 'Faoliyat',     icon: <Activity size={14} />     },
  { id: 'personal',    label: "Ma'lumotlar",  icon: <Edit3 size={14} />        },
  { id: 'ai',          label: 'AI Tahlil',    icon: <Brain size={14} />        },
];

interface PersonFullProfileProps {
  personId: string;
  onClose: () => void;
  initialProfile?: PersonProfile;
}

export const PersonFullProfile: React.FC<PersonFullProfileProps> = ({ personId, onClose, initialProfile }) => {
  const [profile, setProfile] = useState<PersonProfile | null>(initialProfile ?? null);
  const [stats, setStats] = useState<PersonStatistics | null>(null);
  const [relationships, setRelationships] = useState<RelationshipObservation[]>([]);
  const [loading, setLoading] = useState(!initialProfile);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [p, s, r] = await Promise.all([fetchPerson(personId), fetchStats(personId), fetchRelationships(personId)]);
    setProfile(p);
    setStats(s);
    setRelationships(r);
    setLoading(false);
  }, [personId]);

  useEffect(() => { if (!initialProfile) load(); }, [load, initialProfile]);

  const handleWatchlist = async () => { await addToWatchlist(personId); load(true); };
  const handleArchive = async () => { await patchPerson(personId, { status: 'ARCHIVED' }); load(true); };
  const handleAddNote = async (note: string) => { await addNote(personId, note); load(true); };

  const sc = STATUS_CONF[(profile?.status ?? 'ANONYMOUS') as PersonStatus];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        {/* Backdrop */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          onClick={e => e.stopPropagation()}
          className="relative z-10 w-full max-w-3xl max-h-[92vh] bg-app-primary border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* ── HEADER ── */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-app-panel/80 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white ring-2 ${sc.ring} ${sc.bg} shrink-0`}>
                {profile ? (profile.fullName?.charAt(0)?.toUpperCase() ?? '#') : <User className="w-7 h-7 text-gray-400" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-lg leading-tight">
                    {profile?.fullName ?? (loading ? 'Yuklanmoqda...' : "Noma'lum shaxs")}
                  </span>
                  {profile && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.badge}`}>{profile.status}</span>
                  )}
                  {profile?.currentlyPresent && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />JONLI
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono text-text-muted truncate">{personId}</p>
                {profile?.department && (
                  <p className="text-xs text-text-muted">{[profile.position, profile.department].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* ── STATS BAR ── */}
          {profile && (
            <div className="grid grid-cols-5 border-b border-border bg-app-panel/50 shrink-0">
              {[
                { icon: <ScanFace size={13} />, label: 'Aniqlandi', value: profile.totalDetections ?? 0 },
                { icon: <Eye size={13} />, label: 'Tanildi', value: profile.totalRecognitions ?? 0 },
                { icon: <Camera size={13} />, label: 'Kameralar', value: profile.cameraHistory?.length ?? 0 },
                { icon: <MapPin size={13} />, label: 'Zonalar', value: profile.visitedZones?.length ?? 0 },
                { icon: <CalendarDays size={13} />, label: "Ko'rinishlar", value: profile.appearanceGallery?.length ?? 0 },
              ].map(stat => (
                <div key={stat.label} className="flex flex-col items-center py-2.5 border-r border-border last:border-0">
                  <span className="text-cyan-400 mb-0.5">{stat.icon}</span>
                  <span className="text-sm font-bold text-white tabular-nums">{stat.value}</span>
                  <span className="text-[9px] text-text-muted uppercase tracking-wide">{stat.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── TABS ── */}
          <div className="flex border-b border-border bg-app-panel/30 shrink-0 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                    : 'border-transparent text-text-muted hover:text-text-primary hover:bg-white/[0.02]'
                }`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* ── CONTENT ── */}
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
              <p className="text-sm">Profil ma'lumotlari yuklanmoqda...</p>
            </div>
          ) : !profile ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
              <AlertTriangle size={36} className="text-amber-500/50" />
              <p className="text-sm font-semibold">Profil topilmadi</p>
              <p className="text-xs text-center max-w-xs text-text-muted">
                <code className="text-[10px] bg-gray-800 px-1 rounded font-mono">{personId}</code> uchun ma'lumot yo'q.
              </p>
              <button onClick={() => load()} className="mt-2 px-4 py-2 rounded-lg bg-cyan-600/20 text-cyan-400 text-sm hover:bg-cyan-600/30 transition-all">
                Qayta urinish
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  {activeTab === 'overview'   && <OverviewTab profile={profile} stats={stats} onWatchlist={handleWatchlist} onArchive={handleArchive} onReload={() => load(true)} />}
                  {activeTab === 'appearance' && <AppearanceTab profile={profile} />}
                  {activeTab === 'activity'   && <ActivityTab profile={profile} relationships={relationships} />}
                  {activeTab === 'personal'   && <PersonalDataTab profile={profile} onUpdated={() => load(true)} />}
                  {activeTab === 'ai'         && <AiAnalysisTab profile={profile} onAddNote={handleAddNote} />}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
