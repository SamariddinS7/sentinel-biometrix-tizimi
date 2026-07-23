/**
 * PersonProfilePanel
 * Slide-in panel that shows full appearance attributes and identity info
 * for a detected person. Opens when a bounding box is clicked in any camera view.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    X, User, MapPin, Clock, Eye, ShieldAlert, ShieldCheck, ShieldOff,
    Shirt, Footprints, Package, HardHat, Glasses, AlertTriangle,
    Activity, Camera, ChevronRight, Loader2, Search, Badge
} from 'lucide-react';
import type { BoundingBox, DetectedAppearance } from '../lib/DetectionStore';

// ── Colour name → hex mapping (HSV-derived names used by AppearanceIntelligenceEngine)
const COLOR_HEX: Record<string, string> = {
    'Red': '#ef4444', 'Dark Red': '#991b1b', 'Orange': '#f97316', 'Dark Orange': '#c2410c',
    'Yellow': '#eab308', 'Light Yellow': '#fef08a', 'Green': '#22c55e', 'Dark Green': '#15803d',
    'Olive': '#737c0a', 'Light Green': '#86efac', 'Cyan': '#06b6d4', 'Teal': '#0d9488',
    'Blue': '#3b82f6', 'Dark Blue': '#1d4ed8', 'Navy': '#1e3a5f', 'Light Blue': '#bae6fd',
    'Indigo': '#6366f1', 'Purple': '#a855f7', 'Violet': '#7c3aed', 'Magenta': '#d946ef',
    'Pink': '#ec4899', 'Brown': '#92400e', 'Dark Brown': '#713f12', 'Tan': '#d6a76a',
    'Black': '#1e293b', 'Dark Gray': '#374151', 'Gray': '#6b7280', 'Light Gray': '#d1d5db',
    'White': '#f1f5f9', 'Beige': '#e8d5b7', 'Cream': '#f5f0e8',
    'Unknown': '#475569',
};

function colorHex(name: string): string {
    return COLOR_HEX[name] || COLOR_HEX['Unknown'];
}

function isLight(name: string): boolean {
    const light = ['White', 'Beige', 'Cream', 'Light Gray', 'Light Yellow', 'Light Blue', 'Light Green'];
    return light.includes(name);
}

interface PersonProfile {
    personId: string;
    fullName: string;
    status: string;
    role: string;
    currentlyPresent: boolean;
    lastSeen: string;
    lastCameraId: string;
    totalDetections: number;
    cameraHistory: Array<{ cameraId: string; cameraName: string; location: string; visitCount: number; lastSeenAt: string }>;
    currentAppearance?: {
        upperClothingColor: string;
        upperClothingType: string;
        lowerClothingColor: string;
        lowerClothingType: string;
        bodyShape: string;
        estimatedHeightCm: number;
        helmet: boolean; vest: boolean; backpack: boolean; bag: boolean;
        glasses: boolean; mask: boolean; hairColor: string;
    };
    notes?: string;
}

interface PersonProfilePanelProps {
    detection: BoundingBox;
    cameraId: string;
    cameraName?: string;
    onClose: () => void;
}

// ── Status badge config
const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    KNOWN:     { label: "Ma'lum",      color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30', icon: ShieldCheck },
    ANONYMOUS: { label: "Noma'lum",   color: 'text-slate-400 bg-slate-500/15 border-slate-500/30',     icon: User },
    WATCHLIST: { label: 'Kuzatuvda',  color: 'text-amber-400 bg-amber-500/15 border-amber-500/30',     icon: ShieldAlert },
    BLOCKED:   { label: 'Bloklangan', color: 'text-rose-400 bg-rose-500/15 border-rose-500/30',        icon: ShieldOff },
    ARCHIVED:  { label: 'Arxivlangan',color: 'text-slate-500 bg-slate-500/10 border-slate-600/30',     icon: ShieldOff },
};

// ── Appearance from live detection (before profile fetch)
const AppearanceSummary: React.FC<{ appearance: DetectedAppearance }> = ({ appearance }) => (
    <div className="space-y-3">
        {/* Clothing row */}
        <div className="grid grid-cols-2 gap-2">
            <div className="bg-app-surface rounded-lg p-2.5 border border-white/5">
                <div className="text-[10px] font-mono text-text-secondary mb-1.5 uppercase tracking-wider flex items-center gap-1">
                    <Shirt size={10} /> Ustki kiyim
                </div>
                <div className="flex items-center gap-2">
                    <div
                        className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: colorHex(appearance.upperClothingColor) }}
                    />
                    <span className="text-xs font-semibold text-text-primary truncate">
                        {appearance.upperClothingColor}
                    </span>
                </div>
            </div>
            <div className="bg-app-surface rounded-lg p-2.5 border border-white/5">
                <div className="text-[10px] font-mono text-text-secondary mb-1.5 uppercase tracking-wider flex items-center gap-1">
                    <Footprints size={10} /> Pastki kiyim
                </div>
                <div className="flex items-center gap-2">
                    <div
                        className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: colorHex(appearance.lowerClothingColor) }}
                    />
                    <span className="text-xs font-semibold text-text-primary truncate">
                        {appearance.lowerClothingColor}
                    </span>
                </div>
                <div className="text-[10px] text-text-secondary mt-0.5">{appearance.clothingType}</div>
            </div>
        </div>

        {/* Body size/shape */}
        <div className="bg-app-surface rounded-lg p-2.5 border border-white/5">
            <div className="text-[10px] font-mono text-text-secondary mb-1.5 uppercase tracking-wider">
                Tana o'lchami
            </div>
            <div className="flex gap-2 flex-wrap">
                <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full px-2 py-0.5">
                    {appearance.bodySize === 'Tall' ? 'Baland bo\'y' : appearance.bodySize === 'Short' ? 'Past bo\'y' : 'O\'rtacha'}
                </span>
                <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2 py-0.5">
                    {appearance.bodyShape === 'Large' ? 'Yirik' : appearance.bodyShape === 'Slender' ? 'Ingichka' : 'O\'rtacha'}
                </span>
            </div>
        </div>

        {/* Accessories */}
        <div className="bg-app-surface rounded-lg p-2.5 border border-white/5">
            <div className="text-[10px] font-mono text-text-secondary mb-2 uppercase tracking-wider flex items-center gap-1">
                <Package size={10} /> Aksessuarlar
            </div>
            <div className="flex gap-2 flex-wrap">
                {appearance.helmet && (
                    <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
                        <HardHat size={10} /> Shlem
                    </span>
                )}
                {appearance.vest && (
                    <span className="flex items-center gap-1 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full px-2 py-0.5">
                        <Shirt size={10} /> Jilet
                    </span>
                )}
                {appearance.backpack && (
                    <span className="flex items-center gap-1 text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full px-2 py-0.5">
                        <Package size={10} /> Ryukzak
                    </span>
                )}
                {!appearance.helmet && !appearance.vest && !appearance.backpack && (
                    <span className="text-xs text-text-secondary italic">Aksessuar aniqlanmadi</span>
                )}
            </div>
        </div>
    </div>
);

export const PersonProfilePanel: React.FC<PersonProfilePanelProps> = ({
    detection,
    cameraId,
    cameraName,
    onClose,
}) => {
    const [profile, setProfile] = useState<PersonProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [watchlisted, setWatchlisted] = useState(false);
    const [watchlistLoading, setWatchlistLoading] = useState(false);

    // Fetch full profile when fusionId is available
    useEffect(() => {
        if (!detection.fusionId) return;
        setLoading(true);
        const token = localStorage.getItem('sentinel_token') || '';
        fetch(`/api/persons/by-fusion/${encodeURIComponent(detection.fusionId)}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) {
                    setProfile(data);
                    setWatchlisted(data.status === 'WATCHLIST');
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [detection.fusionId]);

    const handleWatchlist = useCallback(async () => {
        if (!detection.fusionId) return;
        setWatchlistLoading(true);
        const token = localStorage.getItem('sentinel_token') || '';
        try {
            await fetch(`/api/persons/${encodeURIComponent(detection.fusionId)}/watchlist`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: watchlisted ? 'remove' : 'add' })
            });
            setWatchlisted(v => !v);
        } catch {}
        setWatchlistLoading(false);
    }, [detection.fusionId, watchlisted]);

    const appearance = detection.appearance;
    const statusKey = (profile?.status || 'ANONYMOUS') as keyof typeof STATUS_CFG;
    const statusCfg = STATUS_CFG[statusKey] || STATUS_CFG.ANONYMOUS;
    const StatusIcon = statusCfg.icon;

    const personId = detection.fusionId
        ? `#${detection.fusionId.slice(-5)}`
        : `#TRK-${String(detection.id).slice(-4)}`;

    return (
        <div className="fixed right-0 top-0 h-full w-[340px] z-[1200] flex flex-col bg-app-panel border-l border-white/10 shadow-2xl animate-in slide-in-from-right-full duration-300">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-app-panel to-app-surface">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                        <User size={16} className="text-cyan-400" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-text-primary leading-none">
                            {profile?.fullName || `Shaxs ${personId}`}
                        </div>
                        <div className="text-[10px] text-text-secondary font-mono mt-0.5">
                            {detection.fusionId || `Kamera: ${cameraId}`}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Status badge */}
                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.color}`}>
                        <StatusIcon size={9} />
                        {statusCfg.label}
                    </span>
                    <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors">
                        <X size={14} className="text-text-secondary" />
                    </button>
                </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
                {/* Camera + timestamp info */}
                <div className="px-4 py-3 bg-app-surface/50 border-b border-white/5 flex items-center gap-4 text-xs text-text-secondary">
                    <div className="flex items-center gap-1.5">
                        <Camera size={11} className="text-cyan-400" />
                        <span className="font-mono">{cameraName || cameraId}</span>
                    </div>
                    {detection.firstSeenMs && (
                        <div className="flex items-center gap-1.5">
                            <Clock size={11} className="text-emerald-400" />
                            <span className="font-mono">{new Date(detection.firstSeenMs).toLocaleTimeString('uz-UZ')}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <Eye size={11} className="text-indigo-400" />
                        <span>{Math.round(detection.confidence * 100)}% ishonch</span>
                    </div>
                </div>

                <div className="px-4 py-4 space-y-4">
                    {/* Live appearance attributes */}
                    {appearance && (
                        <div>
                            <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <Activity size={11} className="text-cyan-400" />
                                AI tomonidan aniqlangan atributlar
                            </div>
                            <AppearanceSummary appearance={appearance} />
                        </div>
                    )}

                    {!appearance && (
                        <div className="bg-app-surface rounded-lg p-4 border border-white/5 text-center">
                            <Activity size={20} className="text-text-secondary mx-auto mb-2 opacity-40" />
                            <p className="text-xs text-text-secondary">
                                AI atributlarni tahlil qilmoqda…
                            </p>
                        </div>
                    )}

                    {/* Full profile data (when fetched) */}
                    {loading && (
                        <div className="flex items-center justify-center py-4 gap-2 text-text-secondary text-xs">
                            <Loader2 size={14} className="animate-spin text-cyan-400" />
                            Profil yuklanmoqda…
                        </div>
                    )}

                    {profile && !loading && (
                        <>
                            {/* Profile appearance (may be richer than live) */}
                            {profile.currentAppearance && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-app-surface rounded-lg p-2.5 border border-white/5">
                                        <div className="text-[10px] font-mono text-text-secondary mb-1 uppercase">Soch rangi</div>
                                        <div className="text-xs font-semibold text-text-primary">{profile.currentAppearance.hairColor}</div>
                                    </div>
                                    <div className="bg-app-surface rounded-lg p-2.5 border border-white/5">
                                        <div className="text-[10px] font-mono text-text-secondary mb-1 uppercase">Jami aniqlash</div>
                                        <div className="text-xs font-semibold text-cyan-400">{profile.totalDetections}×</div>
                                    </div>
                                </div>
                            )}

                            {/* Camera history */}
                            {profile.cameraHistory && profile.cameraHistory.length > 0 && (
                                <div>
                                    <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <MapPin size={11} className="text-indigo-400" />
                                        Kamera tarixi
                                    </div>
                                    <div className="space-y-1.5">
                                        {profile.cameraHistory.slice(0, 4).map((visit, i) => (
                                            <div key={i} className="flex items-center justify-between bg-app-surface rounded-lg px-3 py-2 border border-white/5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Camera size={11} className="text-text-secondary shrink-0" />
                                                    <span className="text-xs font-mono text-text-primary truncate">{visit.cameraName || visit.cameraId}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-[10px] text-text-secondary">{visit.visitCount}× ko'rildi</span>
                                                    <ChevronRight size={10} className="text-text-secondary" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {profile.notes && (
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                                    <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Izohlar</div>
                                    <p className="text-xs text-text-secondary leading-relaxed">{profile.notes}</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* No fusion ID — show only live appearance */}
                    {!detection.fusionId && !loading && (
                        <div className="bg-slate-500/5 border border-slate-500/20 rounded-lg p-3 text-center">
                            <Search size={16} className="text-text-secondary mx-auto mb-1.5 opacity-40" />
                            <p className="text-[11px] text-text-secondary">
                                AI bu shaxsni hali identifikatsiya qilmadi.<br />
                                Kamera yangi kadrlar olganda profil yaratiladi.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-white/10 px-4 py-3 flex gap-2 bg-app-panel">
                <button
                    onClick={handleWatchlist}
                    disabled={watchlistLoading || !detection.fusionId}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 px-3 rounded-lg border transition-all ${
                        watchlisted
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
                            : 'bg-app-surface text-text-secondary border-white/10 hover:text-amber-400 hover:border-amber-500/30'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                    {watchlistLoading
                        ? <Loader2 size={12} className="animate-spin" />
                        : <ShieldAlert size={12} />
                    }
                    {watchlisted ? 'Kuzatuvdan chiqarish' : 'Kuzatuvga qo\'shish'}
                </button>
                <button
                    onClick={() => {
                        const event = new CustomEvent('vms:open-person-intel', {
                            detail: { fusionId: detection.fusionId, cameraId }
                        });
                        window.dispatchEvent(event);
                        onClose();
                    }}
                    disabled={!detection.fusionId}
                    className="flex items-center gap-1.5 text-xs font-bold py-2 px-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Search size={12} />
                    Tekshirish
                </button>
            </div>
        </div>
    );
};
