import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, MessageSquare, Eye, Loader2, ScanFace, User } from 'lucide-react';
import type { PersonProfile, PersonSearchResult, PersonStatus } from '../services/personIntel/types/PersonProfile';

// ── Helpers ────────────────────────────────────────────────────────────────────

function displayName(profile: PersonProfile): string {
  return profile.fullName ?? `Anonymous #${profile.personId.slice(-6)}`;
}

const STATUS_BADGE: Record<PersonStatus, string> = {
  KNOWN:     'bg-teal-500/20 text-teal-400',
  ANONYMOUS: 'bg-gray-700 text-gray-300',
  WATCHLIST: 'bg-amber-500/20 text-amber-400',
  BLOCKED:   'bg-red-500/20 text-red-400',
  ARCHIVED:  'bg-gray-800 text-gray-500 opacity-60',
};

type Tab = 'text' | 'nlq' | 'appearance';

// ── Skeleton ───────────────────────────────────────────────────────────────────

const ResultSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3 animate-pulse">
    <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-gray-700 rounded w-1/3" />
      <div className="h-2 bg-gray-800 rounded w-1/2" />
    </div>
    <div className="w-16 h-6 bg-gray-700 rounded" />
  </div>
);

// ── ResultRow ──────────────────────────────────────────────────────────────────

const ResultRow: React.FC<{ result: PersonSearchResult; onSelect: () => void }> = ({ result, onSelect }) => {
  const { profile, score, matchReason } = result;
  const name = displayName(profile);
  const initial = name.charAt(0).toUpperCase();
  const pct = Math.round((score ?? 0) * 100);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/60 border border-gray-700/50 hover:border-gray-600 transition-colors">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {initial}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white truncate">{name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_BADGE[profile.status] ?? STATUS_BADGE.ANONYMOUS}`}>
            {profile.status}
          </span>
        </div>
        <div className="text-[11px] text-gray-500 font-mono">{profile.personId}</div>
        {matchReason && (
          <div className="text-[11px] text-gray-400 mt-0.5 truncate">{matchReason}</div>
        )}
        {/* Score bar */}
        {score > 0 && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-gray-500 flex-shrink-0">{pct}%</span>
          </div>
        )}
      </div>

      {/* Select button */}
      <button
        onClick={onSelect}
        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-teal-500/20 border border-teal-500/40 text-teal-400 hover:bg-teal-500/30 transition-colors flex-shrink-0"
      >
        <Eye className="w-3 h-3" /> Select
      </button>
    </div>
  );
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface PersonSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (profile: PersonProfile) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const PersonSearchModal: React.FC<PersonSearchModalProps> = ({ open, onClose, onSelect }) => {
  const [tab, setTab] = useState<Tab>('text');
  const [textQuery, setTextQuery] = useState('');
  const [nlqQuery, setNlqQuery] = useState('');

  // Appearance filters
  const [appColor, setAppColor] = useState('');
  const [appUpperType, setAppUpperType] = useState('');
  const [appLowerType, setAppLowerType] = useState('');
  const [appHelmet, setAppHelmet] = useState(false);
  const [appVest, setAppVest] = useState(false);
  const [appBackpack, setAppBackpack] = useState(false);

  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setResults([]); setSearched(false); setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, tab]);

  // Keyboard: Escape closes, Enter submits
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && !e.shiftKey) handleSearch();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, tab, textQuery, nlqQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(async () => {
    setLoading(true); setError(null); setSearched(true);
    try {
      if (tab === 'text') {
        if (!textQuery.trim()) { setResults([]); setLoading(false); return; }
        const res = await fetch('/api/persons/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'PERSON_SEARCH', text: textQuery.trim(), limit: 20 }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setResults(json.data ?? []);

      } else if (tab === 'nlq') {
        if (!nlqQuery.trim()) { setResults([]); setLoading(false); return; }
        const res = await fetch('/api/persons/search/nlq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: nlqQuery.trim() }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        const raw = json.data;
        // Router returns { results: PersonProfile[], evidenceIds: string[] }
        const profiles: PersonProfile[] = Array.isArray(raw?.results) ? raw.results : (Array.isArray(raw) ? raw : []);
        setResults(profiles.map((p: PersonProfile) => ({
          profile: p,
          score: 0.6,
          matchReason: 'Natural language query match (possible correlation)',
          evidenceIds: raw?.evidenceIds ?? [],
        })));

      } else if (tab === 'appearance') {
        const attrs: Record<string, unknown> = {};
        if (appColor) attrs.upperClothingColor = appColor;
        if (appUpperType) attrs.upperClothingType = appUpperType;
        if (appLowerType) attrs.lowerClothingType = appLowerType;
        if (appHelmet) attrs.helmet = true;
        if (appVest) attrs.vest = true;
        if (appBackpack) attrs.backpack = true;
        const res = await fetch('/api/persons/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'APPEARANCE_SEARCH', appearanceAttrs: attrs, limit: 20 }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setResults(json.data ?? []);
      }
    } catch (e: any) {
      setError(e.message ?? 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [tab, textQuery, nlqQuery, appColor, appUpperType, appLowerType, appHelmet, appVest, appBackpack]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="bg-gray-900 border border-gray-700/50 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-700/50">
              <div className="flex items-center gap-2">
                <ScanFace className="w-5 h-5 text-teal-400" />
                <span className="text-white font-semibold">Person Intelligence Search</span>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 px-5 pt-3">
              {([['text', 'Text Search', Search], ['nlq', 'Natural Language', MessageSquare], ['appearance', 'Appearance', Eye]] as const).map(([t, label, Icon]) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setResults([]); setSearched(false); }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-2 border-b-2 transition-colors ${
                    tab === t
                      ? 'border-teal-500 text-teal-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Search input area */}
            <div className="px-5 pt-4 pb-3">
              {tab === 'text' && (
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={textQuery}
                      onChange={e => setTextQuery(e.target.value)}
                      placeholder="Search by name, ID, department…"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/60"
                    />
                  </div>
                  <button onClick={handleSearch} disabled={loading} className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                  </button>
                </div>
              )}

              {tab === 'nlq' && (
                <div className="space-y-2">
                  <textarea
                    value={nlqQuery}
                    onChange={e => setNlqQuery(e.target.value)}
                    placeholder="e.g. Person in red jacket seen near camera 3 between 2–4pm"
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/60 resize-none"
                  />
                  <button onClick={handleSearch} disabled={loading} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><MessageSquare className="w-4 h-4" /> Analyse</>}
                  </button>
                </div>
              )}

              {tab === 'appearance' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Upper clothing color</label>
                    <input
                      type="text"
                      value={appColor}
                      onChange={e => setAppColor(e.target.value)}
                      placeholder="e.g. red, dark blue"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/60"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Upper type</label>
                    <select value={appUpperType} onChange={e => setAppUpperType(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/60">
                      <option value="">Any</option>
                      <option>Jacket</option><option>Shirt</option><option>Hoodie</option>
                      <option>T-Shirt</option><option>Coat</option><option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Lower type</label>
                    <select value={appLowerType} onChange={e => setAppLowerType(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/60">
                      <option value="">Any</option>
                      <option>Jeans</option><option>Trousers</option><option>Shorts</option>
                      <option>Skirt</option><option>Other</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={appHelmet} onChange={e => setAppHelmet(e.target.checked)} className="accent-teal-500" /> Helmet
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={appVest} onChange={e => setAppVest(e.target.checked)} className="accent-teal-500" /> Safety Vest
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={appBackpack} onChange={e => setAppBackpack(e.target.checked)} className="accent-teal-500" /> Backpack
                    </label>
                  </div>
                  <div className="col-span-2">
                    <button onClick={handleSearch} disabled={loading} className="w-full px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Eye className="w-4 h-4" /> Search by Appearance</>}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2 min-h-0">
              {error && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>
              )}
              {loading && [0, 1, 2].map(i => <ResultSkeleton key={i} />)}
              {!loading && searched && results.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                  <User className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">No matches found</p>
                </div>
              )}
              {!loading && results.map(r => (
                <ResultRow
                  key={r.profile.personId}
                  result={r}
                  onSelect={() => { onSelect(r.profile); onClose(); }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
