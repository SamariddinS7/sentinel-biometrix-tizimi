import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Navigation, ScanFace, BarChart3, AlertTriangle, Settings,
  Bookmark, Camera, Clock, RefreshCw, Filter, ChevronDown,
} from 'lucide-react';
import type { TimelineEntry, TimelineEntryType } from '../services/personIntel/types/PersonProfile';

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleString();
}

// ── Entry type config ──────────────────────────────────────────────────────────

type FilterGroup = 'ALL' | 'DETECTION' | 'MOVEMENT' | 'RECOGNITION' | 'ANALYTICS' | 'ALERTS' | 'OPERATOR';

const FILTER_GROUPS: Record<FilterGroup, { label: string; types: TimelineEntryType[] }> = {
  ALL:         { label: 'All',         types: [] },
  DETECTION:   { label: 'Detection',   types: ['DETECTION'] },
  MOVEMENT:    { label: 'Movement',    types: ['MOVEMENT'] },
  RECOGNITION: { label: 'Recognition', types: ['RECOGNITION', 'APPEARANCE_UPDATE'] },
  ANALYTICS:   { label: 'Analytics',  types: ['ANALYTICS_EVENT', 'EVIDENCE'] },
  ALERTS:      { label: 'Alerts',      types: ['ALARM', 'WATCHLIST_ADDED', 'WATCHLIST_REMOVED'] },
  OPERATOR:    { label: 'Operator',    types: ['OPERATOR_ACTION', 'PROFILE_CREATED', 'PROFILE_UPDATED', 'PROFILE_MERGED'] },
};

interface EntryMeta {
  icon: React.ReactNode;
  dot: string;
  line: string;
}

function entryMeta(type: TimelineEntryType): EntryMeta {
  switch (type) {
    case 'DETECTION':          return { icon: <User className="w-3 h-3" />,         dot: 'bg-blue-500',   line: 'border-blue-500/30'   };
    case 'MOVEMENT':           return { icon: <Navigation className="w-3 h-3" />,    dot: 'bg-green-500',  line: 'border-green-500/30'  };
    case 'RECOGNITION':        return { icon: <ScanFace className="w-3 h-3" />,      dot: 'bg-teal-500',   line: 'border-teal-500/30'   };
    case 'APPEARANCE_UPDATE':  return { icon: <Filter className="w-3 h-3" />,        dot: 'bg-cyan-500',   line: 'border-cyan-500/30'   };
    case 'ANALYTICS_EVENT':    return { icon: <BarChart3 className="w-3 h-3" />,     dot: 'bg-purple-500', line: 'border-purple-500/30' };
    case 'EVIDENCE':           return { icon: <Camera className="w-3 h-3" />,        dot: 'bg-indigo-500', line: 'border-indigo-500/30' };
    case 'ALARM':              return { icon: <AlertTriangle className="w-3 h-3" />, dot: 'bg-red-500',    line: 'border-red-500/30'    };
    case 'WATCHLIST_ADDED':    return { icon: <Bookmark className="w-3 h-3" />,      dot: 'bg-amber-500',  line: 'border-amber-500/30'  };
    case 'WATCHLIST_REMOVED':  return { icon: <Bookmark className="w-3 h-3" />,      dot: 'bg-gray-400',   line: 'border-gray-500/30'   };
    case 'OPERATOR_ACTION':    return { icon: <Settings className="w-3 h-3" />,      dot: 'bg-gray-400',   line: 'border-gray-500/30'   };
    default:                   return { icon: <Clock className="w-3 h-3" />,          dot: 'bg-gray-500',   line: 'border-gray-600/30'   };
  }
}

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/40',
  HIGH:     'bg-orange-500/20 text-orange-400 border-orange-500/40',
  MEDIUM:   'bg-amber-500/20 text-amber-400 border-amber-500/40',
  LOW:      'bg-gray-700 text-gray-400 border-gray-600',
  INFO:     'bg-blue-500/20 text-blue-400 border-blue-500/40',
};

// ── Skeleton ───────────────────────────────────────────────────────────────────

const SkeletonRow: React.FC = () => (
  <div className="flex gap-3 py-3 animate-pulse">
    <div className="w-6 h-6 rounded-full bg-gray-700 flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-gray-700 rounded w-1/3" />
      <div className="h-2 bg-gray-800 rounded w-2/3" />
    </div>
    <div className="h-2 bg-gray-800 rounded w-16 flex-shrink-0 mt-1" />
  </div>
);

// ── Props ──────────────────────────────────────────────────────────────────────

interface PersonTimelineProps {
  personId: string;
  maxHeight?: string;
  showFilters?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const PersonTimeline: React.FC<PersonTimelineProps> = ({
  personId,
  maxHeight = '600px',
  showFilters = true,
}) => {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterGroup>('ALL');

  const load = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/persons/${personId}/timeline?limit=200`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Failed to load timeline');
      setEntries(json.data.entries ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => { load(); }, [load]);

  // Apply filter
  const filtered = filter === 'ALL'
    ? entries
    : entries.filter(e => FILTER_GROUPS[filter].types.includes(e.type));

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      {showFilters && (
        <div className="flex gap-1 flex-wrap pb-3 border-b border-gray-700/50 mb-3">
          {(Object.keys(FILTER_GROUPS) as FilterGroup[]).map(g => (
            <button
              key={g}
              onClick={() => setFilter(g)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                filter === g
                  ? 'bg-teal-500/20 border border-teal-500/50 text-teal-400'
                  : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {FILTER_GROUPS[g].label}
              {g !== 'ALL' && filter !== g && (
                <span className="ml-1 text-[10px] text-gray-600">
                  {entries.filter(e => FILTER_GROUPS[g].types.includes(e.type)).length}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={load}
            className="ml-auto text-gray-500 hover:text-gray-300 transition-colors"
            title="Refresh timeline"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Timeline list */}
      <div className="overflow-y-auto flex-1 pr-1" style={{ maxHeight }}>
        {loading ? (
          <div className="space-y-1">
            {[0, 1, 2].map(i => <SkeletonRow key={i} />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <AlertTriangle className="w-8 h-8 mb-2 text-red-500/60" />
            <p className="text-sm">{error}</p>
            <button onClick={load} className="mt-3 text-xs text-teal-400 hover:text-teal-300">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Clock className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No timeline events recorded</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-2.5 top-0 bottom-0 w-px bg-gray-700/50" />

            <AnimatePresence initial={false}>
              {filtered.map((entry, idx) => {
                const meta = entryMeta(entry.type);
                return (
                  <motion.div
                    key={entry.entryId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                    className="flex gap-3 pb-4 relative"
                  >
                    {/* Dot */}
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full ${meta.dot} flex items-center justify-center text-white z-10 mt-0.5`}>
                      {meta.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-white leading-tight">{entry.title}</span>
                        <span className="text-[10px] text-gray-500 flex-shrink-0 mt-0.5">{relativeTime(entry.timestamp)}</span>
                      </div>

                      {entry.description && (
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{entry.description}</p>
                      )}

                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {entry.cameraId && (
                          <span className="flex items-center gap-0.5 text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
                            <Camera className="w-2.5 h-2.5" /> {entry.cameraId}
                          </span>
                        )}
                        {entry.severity && entry.severity !== 'INFO' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_BADGE[entry.severity] ?? SEVERITY_BADGE.INFO}`}>
                            {entry.severity}
                          </span>
                        )}
                        {entry.operator && (
                          <span className="text-[10px] text-gray-600">by {entry.operator}</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer count */}
      {!loading && !error && (
        <div className="pt-2 border-t border-gray-700/50 text-[11px] text-gray-600 text-right">
          {filtered.length} of {entries.length} events
        </div>
      )}
    </div>
  );
};
