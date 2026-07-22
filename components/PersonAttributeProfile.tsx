/**
 * PersonAttributeProfile — Shaxs Atributlari Profili
 *
 * To'liq shaxs profili paneli: AI aniqlagan barcha vizual atributlar,
 * kiyim, aksessuarlar, ko'tarilgan buyumlar va kamera ko'rinishlari tarixi.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, User, Camera, Clock, Shield, ShieldAlert, Eye, RefreshCw,
  Loader2, Ruler, Shirt, ChevronDown, ChevronUp, Package,
  Backpack, HardHat, Umbrella, Glasses, AlertTriangle,
  CheckCircle2, Circle, MapPin, Activity, CalendarDays,
  ScanFace, Hash, ArrowRight,
} from 'lucide-react';
import type {
  PersonProfile, AppearanceSnapshot, PersonStatus,
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

function colorSwatch(color: string): string {
  const map: Record<string, string> = {
    black: '#111', white: '#f5f5f5', gray: '#6b7280', grey: '#6b7280',
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
    orange: '#f97316', purple: '#a855f7', pink: '#ec4899', brown: '#92400e',
    navy: '#1e3a5f', beige: '#d2b48c', khaki: '#c3b091', cyan: '#06b6d4',
    teal: '#14b8a6', indigo: '#6366f1', maroon: '#7f1d1d', olive: '#65a30d',
    cream: '#fef9c3', lime: '#84cc16', violet: '#7c3aed',
  };
  const key = color?.toLowerCase().trim();
  return map[key] ?? '#4b5563';
}

const STATUS_CONF: Record<PersonStatus, { ring: string; badge: string; dot: string }> = {
  KNOWN:     { ring: 'ring-teal-500/50',  badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30',  dot: 'bg-teal-400'  },
  ANONYMOUS: { ring: 'ring-gray-500/40',  badge: 'bg-gray-700 text-gray-300 border-gray-600',         dot: 'bg-gray-400'  },
  WATCHLIST: { ring: 'ring-amber-500/50', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30', dot: 'bg-amber-400' },
  BLOCKED:   { ring: 'ring-red-500/50',   badge: 'bg-red-500/15 text-red-300 border-red-500/30',      dot: 'bg-red-400'   },
  ARCHIVED:  { ring: 'ring-gray-700/50',  badge: 'bg-gray-800 text-gray-500 border-gray-700',          dot: 'bg-gray-600'  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
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
    <span className={`text-xs font-semibold text-text-primary ${mono ? 'font-mono' : ''} max-w-[55%] text-right`}>
      {value ?? '—'}
    </span>
  </div>
);

const ClothingColorChip: React.FC<{ color: string }> = ({ color }) => {
  const hex = colorSwatch(color);
  const isLight = ['white', 'cream', 'beige', 'yellow', 'lime'].includes(color?.toLowerCase());
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/50 text-xs font-semibold text-text-primary bg-app-panel">
      <span
        className="w-3 h-3 rounded-full inline-block border"
        style={{ background: hex, borderColor: isLight ? '#9ca3af' : 'transparent' }}
      />
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
// Carried Objects Aggregator
// ─────────────────────────────────────────────────────────────────────────────

interface CarriedItem {
  name: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  cameras: string[];
}

function aggregateCarriedObjects(gallery: AppearanceSnapshot[]): CarriedItem[] {
  const map = new Map<string, CarriedItem>();
  const sorted = [...gallery].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
  for (const snap of sorted) {
    for (const obj of snap.carriedObjects ?? []) {
      const key = obj.toLowerCase().trim();
      if (!key) continue;
      if (map.has(key)) {
        const item = map.get(key)!;
        item.count++;
        item.lastSeen = snap.capturedAt;
        if (!item.cameras.includes(snap.cameraId)) item.cameras.push(snap.cameraId);
      } else {
        map.set(key, { name: obj, count: 1, firstSeen: snap.capturedAt, lastSeen: snap.capturedAt, cameras: [snap.cameraId] });
      }
    }
    // Also aggregate boolean accessory fields as carried items
    const boolMap: Array<[boolean | undefined, string]> = [
      [snap.backpack, 'Ryukzak'], [snap.helmet, 'Kaska'], [snap.vest, 'Himoya nimchasi'],
      [snap.bag, 'Sumka'], [snap.glasses, "Ko'zoynak"], [snap.mask, 'Niqob'], [(snap as any).umbrella, 'Soyabon'],
    ];
    for (const [val, name] of boolMap) {
      if (!val) continue;
      const key = name.toLowerCase();
      if (map.has(key)) {
        const item = map.get(key)!;
        item.count++;
        item.lastSeen = snap.capturedAt;
        if (!item.cameras.includes(snap.cameraId)) item.cameras.push(snap.cameraId);
      } else {
        map.set(key, { name, count: 1, firstSeen: snap.capturedAt, lastSeen: snap.capturedAt, cameras: [snap.cameraId] });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPerson(personId: string): Promise<PersonProfile | null> {
  try {
    const res = await fetch(`/api/persons/${personId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface PersonAttributeProfileProps {
  personId: string;
  onClose: () => void;
  /** If the full profile is already available, pass it to skip the fetch */
  initialProfile?: PersonProfile;
}

export const PersonAttributeProfile: React.FC<PersonAttributeProfileProps> = ({
  personId,
  onClose,
  initialProfile,
}) => {
  const [profile, setProfile] = useState<PersonProfile | null>(initialProfile ?? null);
  const [loading, setLoading] = useState(!initialProfile);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const p = await fetchPerson(personId);
    setProfile(p);
    setLoading(false);
    setRefreshing(false);
  }, [personId]);

  useEffect(() => { if (!initialProfile) load(); }, [load, initialProfile]);

  const snap: AppearanceSnapshot | undefined = profile?.currentAppearance ?? profile?.appearanceGallery?.[0];
  const gallery = useMemo(() => [...(profile?.appearanceGallery ?? [])].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
  ), [profile]);
  const carriedItems = useMemo(() => aggregateCarriedObjects(gallery), [gallery]);
  const statusConf = STATUS_CONF[(profile?.status ?? 'ANONYMOUS') as PersonStatus];

  const hasAccessory = snap && (snap.helmet || snap.vest || snap.backpack || snap.bag || snap.glasses || snap.mask || (snap as any).umbrella);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-stretch justify-end" onClick={onClose}>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Panel */}
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 340, damping: 32 }}
          onClick={e => e.stopPropagation()}
          className="relative z-10 w-full max-w-xl h-full bg-app-primary border-l border-border flex flex-col shadow-2xl overflow-hidden"
        >
          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-app-panel shrink-0">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white ring-2 ${statusConf.ring} ${
                !profile ? 'bg-gray-700 animate-pulse' :
                profile.status === 'KNOWN' ? 'bg-teal-700' :
                profile.status === 'WATCHLIST' ? 'bg-amber-700' :
                profile.status === 'BLOCKED' ? 'bg-red-700' : 'bg-gray-600'
              }`}>
                {profile ? (profile.fullName?.charAt(0) ?? '#') : <User className="w-6 h-6 text-gray-400" />}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-base">
                    {profile?.fullName ?? (loading ? 'Yuklanmoqda...' : 'Noma\'lum shaxs')}
                  </span>
                  {profile && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConf.badge}`}>
                      {profile.status}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono text-text-muted">{personId}</span>
                  {profile?.currentlyPresent && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      JONLI
                    </span>
                  )}
                </div>
                {profile?.department && (
                  <p className="text-xs text-text-muted mt-0.5">{profile.position} · {profile.department}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => load(true)} disabled={refreshing || loading}
                className="p-1.5 rounded-lg text-text-muted hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                title="Yangilash"
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── PRESENCE STATS BAR ─────────────────────────────────────── */}
          {profile && (
            <div className="grid grid-cols-4 border-b border-border bg-app-panel/50 shrink-0">
              {[
                { icon: <ScanFace size={14} />, label: 'Aniqlandi', value: profile.totalDetections ?? 0 },
                { icon: <Eye size={14} />, label: 'Tanildi', value: profile.totalRecognitions ?? 0 },
                { icon: <Camera size={14} />, label: 'Kameralar', value: profile.cameraHistory?.length ?? 0 },
                { icon: <CalendarDays size={14} />, label: 'Ko\'rinishlar', value: gallery.length },
              ].map(stat => (
                <div key={stat.label} className="flex flex-col items-center py-3 border-r border-border last:border-0">
                  <span className="text-cyan-400 mb-0.5">{stat.icon}</span>
                  <span className="text-sm font-bold text-white">{stat.value}</span>
                  <span className="text-[9px] text-text-muted uppercase tracking-wide">{stat.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── LOADING STATE ──────────────────────────────────────────── */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
              <p className="text-sm">Profil ma'lumotlari yuklanmoqda...</p>
            </div>
          )}

          {/* ── CONTENT ────────────────────────────────────────────────── */}
          {!loading && profile && (
            <div className="flex-1 overflow-y-auto p-5 space-y-6">

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  1. BIOLOGIK VA KONSTRUKTSIYA ATRIBUTLARI
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              <div className="bg-app-panel border border-border rounded-xl p-4">
                <SectionHeader
                  icon={<Ruler size={16} />}
                  title="Biologik va Konstruktsiya Atributlari"
                  sub="AI tomonidan aniqlangan fiziologik xususiyatlar"
                />

                {!snap ? (
                  <p className="text-xs text-text-muted italic text-center py-4">Ko'rinish ma'lumotlari mavjud emas</p>
                ) : (
                  <div className="divide-y divide-border/40">
                    <AttrRow
                      label="Bo'yi (taxminiy)"
                      value={snap.estimatedHeightCm ? `~${snap.estimatedHeightCm} sm` : undefined}
                    />
                    <AttrRow label="Tana shakli" value={snap.bodyShape} />
                    <AttrRow label="Tana o'lchami" value={(snap as any).estimatedBodySize} />
                    <AttrRow label="Soch rangi" value={snap.hairColor} />
                    <AttrRow label="Soch uslubi" value={(snap as any).hairStyle} />
                    <AttrRow
                      label="Soqol"
                      value={
                        (snap as any).beard !== undefined
                          ? ((snap as any).beard ? ((snap as any).beardStyle ?? 'Mavjud') : 'Yo\'q')
                          : undefined
                      }
                    />
                    <AttrRow label="Ishonch darajasi" value={snap.confidence ? `${(snap.confidence * 100).toFixed(0)}%` : undefined} />
                  </div>
                )}

                {/* AI confidence bar */}
                {snap?.confidence != null && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <div className="flex justify-between text-[10px] text-text-muted mb-1">
                      <span className="font-mono">AI ISHONCH</span>
                      <span className="font-bold text-cyan-400">{(snap.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${snap.confidence * 100}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full ${
                          snap.confidence > 0.8 ? 'bg-emerald-500' :
                          snap.confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  2. KIYIM
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              <div className="bg-app-panel border border-border rounded-xl p-4">
                <SectionHeader
                  icon={<Shirt size={16} />}
                  title="Kiyim"
                  sub="Eng so'nggi ko'rinish asosida"
                />

                {!snap ? (
                  <p className="text-xs text-text-muted italic text-center py-4">Kiyim ma'lumotlari mavjud emas</p>
                ) : (
                  <div className="space-y-3">
                    {/* Upper */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Ustki kiyim</p>
                        <div className="flex flex-wrap gap-1.5">
                          {snap.upperClothingColor && <ClothingColorChip color={snap.upperClothingColor} />}
                          {snap.upperClothingType && (
                            <span className="px-2.5 py-1 rounded-full border border-border/50 text-xs text-text-secondary bg-app-panel font-semibold">
                              {snap.upperClothingType}
                            </span>
                          )}
                          {snap.upperClothingPattern && snap.upperClothingPattern !== 'none' && (
                            <span className="px-2.5 py-1 rounded-full border border-border/50 text-xs text-text-muted bg-app-panel">
                              {snap.upperClothingPattern}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lower */}
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Pastki kiyim</p>
                      <div className="flex flex-wrap gap-1.5">
                        {snap.lowerClothingColor && <ClothingColorChip color={snap.lowerClothingColor} />}
                        {snap.lowerClothingType && (
                          <span className="px-2.5 py-1 rounded-full border border-border/50 text-xs text-text-secondary bg-app-panel font-semibold">
                            {snap.lowerClothingType}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Shoes */}
                    {snap.shoes && (
                      <div>
                        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Oyoq kiyim</p>
                        <span className="px-2.5 py-1 rounded-full border border-border/50 text-xs text-text-secondary bg-app-panel font-semibold">
                          {snap.shoes}
                        </span>
                      </div>
                    )}

                    {/* Accessories */}
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Maxsus kiyim va aksessuarlar</p>
                      {!hasAccessory ? (
                        <p className="text-xs text-text-muted italic">Hech qanday maxsus aksessuarlar aniqlanmadi</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {snap.backpack && (
                            <AccessoryBadge label="Ryukzak" icon={<Backpack size={12} />}
                              color="bg-blue-500/10 text-blue-400 border-blue-500/30" />
                          )}
                          {snap.helmet && (
                            <AccessoryBadge label="Kaska" icon={<HardHat size={12} />}
                              color="bg-yellow-500/10 text-yellow-400 border-yellow-500/30" />
                          )}
                          {snap.vest && (
                            <AccessoryBadge label="Himoya nimchasi" icon={<Shield size={12} />}
                              color="bg-orange-500/10 text-orange-400 border-orange-500/30" />
                          )}
                          {(snap as any).umbrella && (
                            <AccessoryBadge label="Soyabon" icon={<Umbrella size={12} />}
                              color="bg-indigo-500/10 text-indigo-400 border-indigo-500/30" />
                          )}
                          {snap.glasses && (
                            <AccessoryBadge label="Ko'zoynak" icon={<Glasses size={12} />}
                              color="bg-purple-500/10 text-purple-400 border-purple-500/30" />
                          )}
                          {snap.mask && (
                            <AccessoryBadge label="Niqob" icon={<Activity size={12} />}
                              color="bg-teal-500/10 text-teal-400 border-teal-500/30" />
                          )}
                          {snap.bag && (
                            <AccessoryBadge label="Sumka" icon={<Package size={12} />}
                              color="bg-pink-500/10 text-pink-400 border-pink-500/30" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  3. KO'TARIB YURGAN BUYUMLAR
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              <div className="bg-app-panel border border-border rounded-xl p-4">
                <SectionHeader
                  icon={<Package size={16} />}
                  title="Ko'tarib Yurgan Buyumlar"
                  sub={`Barcha ${gallery.length} ta ko'rinish bo'yicha yig'ilgan — kamera saqlangan har safar`}
                />

                {carriedItems.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-text-muted gap-2">
                    <Package size={28} className="opacity-20" />
                    <p className="text-xs italic">Hech qanday buyum aniqlanmadi</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {carriedItems.map((item, i) => (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center justify-between gap-3 bg-app-primary/50 border border-border/50 rounded-lg px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                            <Package size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-text-primary capitalize">{item.name}</p>
                            <p className="text-[10px] text-text-muted font-mono">
                              {item.cameras.length} kamera · Birinchi: {relTime(item.firstSeen)}
                            </p>
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

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  4. KAMERA KO'RINISHLARI TARIXI
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              <div className="bg-app-panel border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <SectionHeader
                    icon={<Camera size={16} />}
                    title="Kamera Ko'rinishlari Tarixi"
                    sub={`${gallery.length} ta ko'rinish, yangilaridan eskisiga`}
                  />
                  {gallery.length > 5 && (
                    <button
                      onClick={() => setHistoryExpanded(v => !v)}
                      className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-mono mt-0.5"
                    >
                      {historyExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {historyExpanded ? 'Kamroq' : `+${gallery.length - 5} ta ko'rsatish`}
                    </button>
                  )}
                </div>

                {gallery.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-text-muted gap-2">
                    <Camera size={28} className="opacity-20" />
                    <p className="text-xs italic">Ko'rinish tarixi mavjud emas</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(historyExpanded ? gallery : gallery.slice(0, 5)).map((s, i) => (
                      <AppearanceCard key={s.snapshotId} snap={s} index={i} />
                    ))}
                  </div>
                )}
              </div>

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  5. KAMERA TASHRIF XULOSASI
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              {(profile.cameraHistory?.length ?? 0) > 0 && (
                <div className="bg-app-panel border border-border rounded-xl p-4">
                  <SectionHeader
                    icon={<MapPin size={16} />}
                    title="Kamera Tashrif Xulosasi"
                    sub="Joylashuv bo'yicha umumlashtirilgan statistika"
                  />
                  <div className="space-y-2">
                    {profile.cameraHistory.slice(0, 6).map(cv => (
                      <div key={cv.cameraId} className="flex items-center justify-between gap-2 bg-app-primary/50 border border-border/50 rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Camera size={13} className="text-text-muted shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-text-primary truncate max-w-[150px]">
                              {cv.cameraName || cv.cameraId}
                            </p>
                            <p className="text-[10px] text-text-muted">{cv.location ?? '—'}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-cyan-400">{cv.visitCount}× tashrif</p>
                          <p className="text-[10px] text-text-muted">{relTime(cv.lastSeenAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  6. PROFIL META
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              <div className="bg-app-panel border border-border rounded-xl p-4">
                <SectionHeader icon={<Hash size={16} />} title="Profil Ma'lumotlari" />
                <div className="divide-y divide-border/40">
                  <AttrRow label="Birinchi ko'rilgan" value={fmtDate(profile.firstSeen)} />
                  <AttrRow label="Oxirgi ko'rilgan" value={fmtDate(profile.lastSeen)} />
                  <AttrRow label="Oxirgi kamera" value={profile.lastCameraId} mono />
                  <AttrRow label="Joriy holat" value={profile.currentlyPresent ? 'Hozir mavjud ✓' : 'Yo\'q'} />
                  <AttrRow label="Profil versiyasi" value={`v${profile.profileVersion}`} mono />
                  <AttrRow label="Yaratilgan" value={fmtDate(profile.createdAt)} />
                </div>
                {profile.notes && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Izohlar</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{profile.notes}</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── NOT FOUND ───────────────────────────────────────────────── */}
          {!loading && !profile && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
              <AlertTriangle size={36} className="text-amber-500/50" />
              <p className="text-sm font-semibold">Profil topilmadi</p>
              <p className="text-xs text-center max-w-xs">
                <code className="text-[10px] bg-gray-800 px-1 rounded font-mono">{personId}</code> uchun ma'lumot mavjud emas yoki API bilan bog'lanishda xato.
              </p>
              <button onClick={() => load()} className="mt-2 px-4 py-2 rounded-lg bg-cyan-600/20 text-cyan-400 text-sm hover:bg-cyan-600/30 transition-all">
                Qayta urinish
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Appearance Card (per snapshot)
// ─────────────────────────────────────────────────────────────────────────────

const AppearanceCard: React.FC<{ snap: AppearanceSnapshot; index: number }> = ({ snap, index }) => {
  const [expanded, setExpanded] = useState(index === 0);
  const accessories = [
    snap.backpack && 'Ryukzak',
    snap.helmet && 'Kaska',
    snap.vest && 'Nimcha',
    snap.bag && 'Sumka',
    snap.glasses && "Ko'zoynak",
    snap.mask && 'Niqob',
    (snap as any).umbrella && 'Soyabon',
  ].filter(Boolean) as string[];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="border border-border/50 rounded-xl overflow-hidden bg-app-primary/40"
    >
      {/* Card header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
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
          {/* Color dots */}
          {snap.upperClothingColor && (
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/10 shadow-sm"
              style={{ background: colorSwatch(snap.upperClothingColor) }}
              title={`Ustki: ${snap.upperClothingColor}`}
            />
          )}
          {snap.lowerClothingColor && (
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/10 shadow-sm"
              style={{ background: colorSwatch(snap.lowerClothingColor) }}
              title={`Pastki: ${snap.lowerClothingColor}`}
            />
          )}
          <span className="text-[10px] text-cyan-400 font-mono">{(snap.confidence * 100).toFixed(0)}%</span>
          {expanded ? <ChevronUp size={13} className="text-text-muted" /> : <ChevronDown size={13} className="text-text-muted" />}
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30 px-3 py-3 space-y-3">
              {/* Attribute grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                {([
                  ['Ustki kiyim', `${snap.upperClothingColor} ${snap.upperClothingType}`.trim() || '—'],
                  ['Pastki kiyim', `${snap.lowerClothingColor} ${snap.lowerClothingType}`.trim() || '—'],
                  ['Oyoq kiyim', snap.shoes || '—'],
                  ['Naqsh', snap.upperClothingPattern || '—'],
                  ['Soch rangi', snap.hairColor || '—'],
                  ['Soch uslubi', (snap as any).hairStyle || '—'],
                  ['Soqol', (snap as any).beard !== undefined ? ((snap as any).beard ? 'Ha' : 'Yo\'q') : '—'],
                  ['Tana shakli', snap.bodyShape || '—'],
                  ["Bo'yi", snap.estimatedHeightCm ? `~${snap.estimatedHeightCm} sm` : '—'],
                  ["O'lcham", (snap as any).estimatedBodySize || '—'],
                ] as [string, string][]).map(([label, val]) => (
                  <div key={label} className="flex gap-2">
                    <span className="text-text-muted w-20 flex-shrink-0">{label}</span>
                    <span className="text-text-primary font-medium capitalize">{val}</span>
                  </div>
                ))}
              </div>

              {/* Accessories */}
              {accessories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/30">
                  {accessories.map(acc => (
                    <span key={acc} className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-md font-semibold">
                      {acc}
                    </span>
                  ))}
                </div>
              )}

              {/* Carried objects from this snapshot */}
              {(snap.carriedObjects?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/30">
                  <span className="text-[10px] text-text-muted w-full mb-0.5">Ko'tarilgan buyumlar:</span>
                  {snap.carriedObjects.map(obj => (
                    <span key={obj} className="text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-md font-semibold">
                      {obj}
                    </span>
                  ))}
                </div>
              )}

              {/* Confidence bar */}
              <div className="pt-1.5 border-t border-border/30">
                <div className="flex justify-between text-[9px] text-text-muted mb-1 font-mono">
                  <span>AI ISHONCH</span><span>{(snap.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      snap.confidence > 0.8 ? 'bg-emerald-500' :
                      snap.confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${snap.confidence * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
