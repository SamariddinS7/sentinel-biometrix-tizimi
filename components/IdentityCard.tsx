import React from 'react';
import { motion } from 'motion/react';
import { Eye, Bookmark, Search, Camera, Clock, Shield, ShieldAlert, User, LayoutList } from 'lucide-react';
import type { PersonProfile, PersonStatus } from '../services/personIntel/types/PersonProfile';
import { PersonNameLink } from '../context/PersonProfileContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function displayName(profile: PersonProfile): string {
  if (profile.fullName) return profile.fullName;
  return `Anonymous #${profile.personId.slice(-6)}`;
}

const STATUS_STYLES: Record<PersonStatus, { badge: string; dot: string; avatarBg: string }> = {
  KNOWN:     { badge: 'bg-teal-500/20 text-teal-400 border border-teal-500/40',     dot: 'bg-teal-400',  avatarBg: 'bg-teal-600' },
  ANONYMOUS: { badge: 'bg-gray-700 text-gray-300 border border-gray-600',            dot: 'bg-gray-400',  avatarBg: 'bg-gray-600' },
  WATCHLIST: { badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',   dot: 'bg-amber-400', avatarBg: 'bg-amber-700' },
  BLOCKED:   { badge: 'bg-red-500/20 text-red-400 border border-red-500/40',         dot: 'bg-red-400',   avatarBg: 'bg-red-700'   },
  ARCHIVED:  { badge: 'bg-gray-800 text-gray-500 border border-gray-700 opacity-60', dot: 'bg-gray-500',  avatarBg: 'bg-gray-700'  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface IdentityCardProps {
  profile: PersonProfile;
  selected?: boolean;
  compact?: boolean;
  onSelect?: () => void;
  onWatchlist?: () => void;
  onInvestigate?: () => void;
  onViewProfile?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const IdentityCard: React.FC<IdentityCardProps> = ({
  profile,
  selected = false,
  compact = false,
  onSelect,
  onWatchlist,
  onInvestigate,
  onViewProfile,
}) => {
  const s = STATUS_STYLES[profile.status] ?? STATUS_STYLES.ANONYMOUS;
  const name = displayName(profile);
  const initial = name.charAt(0).toUpperCase();
  const confidence = profile.totalDetections > 0
    ? Math.min(1, (profile.totalRecognitions ?? 0) / (profile.totalDetections + 1))
    : 0;
  const isWatchlisted = profile.status === 'WATCHLIST';

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={onSelect}
      className={[
        'relative rounded-lg border cursor-pointer transition-all duration-150',
        compact ? 'p-3' : 'p-4',
        selected
          ? 'bg-teal-500/10 border-teal-500/60 ring-2 ring-teal-500/40'
          : 'bg-gray-800/60 border-gray-700/50 hover:border-gray-600',
        profile.status === 'ARCHIVED' ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Watchlist indicator strip */}
      {isWatchlisted && (
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-lg bg-amber-500" />
      )}

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full ${s.avatarBg} flex items-center justify-center text-white font-bold text-sm`}>
          {initial}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Name + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <PersonNameLink personId={profile.personId} name={name} className="font-semibold text-white text-sm truncate" />
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.badge}`}>
              {profile.status}
            </span>
          </div>

          {/* Person ID */}
          <div className="text-[11px] font-mono text-gray-500 mt-0.5">{profile.personId}</div>

          {/* Department / position */}
          {!compact && (profile.department || profile.position) && (
            <div className="text-xs text-gray-400 mt-1 truncate">
              {[profile.position, profile.department].filter(Boolean).join(' · ')}
            </div>
          )}

          {/* Last seen */}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
            {profile.lastCameraId && (
              <span className="flex items-center gap-1">
                <Camera className="w-3 h-3" />
                <span className="truncate max-w-[80px]">{profile.lastCameraId}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {relativeTime(profile.lastSeen)}
            </span>
          </div>

          {/* Confidence bar */}
          {confidence > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                <span>Confidence</span>
                <span>{(confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(confidence * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats chips */}
          {!compact && (
            <div className="flex gap-2 mt-2">
              {(profile.totalDetections ?? 0) > 0 && (
                <span className="text-[10px] bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">
                  {profile.totalDetections} detections
                </span>
              )}
              {(profile.totalRecognitions ?? 0) > 0 && (
                <span className="text-[10px] bg-teal-500/10 text-teal-500 px-1.5 py-0.5 rounded">
                  {profile.totalRecognitions} recognized
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!compact && (onSelect || onWatchlist || onInvestigate || onViewProfile) && (
        <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-700/50">
          {onViewProfile && (
            <button
              onClick={e => { e.stopPropagation(); onViewProfile(); }}
              className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1 rounded bg-gray-700/50 hover:bg-cyan-500/20 hover:text-cyan-400 text-gray-400 transition-colors"
            >
              <LayoutList className="w-3 h-3" /> Profil
            </button>
          )}
          {onSelect && (
            <button
              onClick={e => { e.stopPropagation(); onSelect(); }}
              className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1 rounded bg-gray-700/50 hover:bg-teal-500/20 hover:text-teal-400 text-gray-400 transition-colors"
            >
              <Eye className="w-3 h-3" /> View
            </button>
          )}
          {onInvestigate && (
            <button
              onClick={e => { e.stopPropagation(); onInvestigate(); }}
              className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1 rounded bg-gray-700/50 hover:bg-blue-500/20 hover:text-blue-400 text-gray-400 transition-colors"
            >
              <Search className="w-3 h-3" /> Investigate
            </button>
          )}
          {onWatchlist && (
            <button
              onClick={e => { e.stopPropagation(); onWatchlist(); }}
              className={`flex items-center justify-center gap-1 text-[11px] py-1 px-2 rounded transition-colors ${
                isWatchlisted
                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-amber-500/10 hover:text-amber-400'
              }`}
            >
              <Bookmark className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};
